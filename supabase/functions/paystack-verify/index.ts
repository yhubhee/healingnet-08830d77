import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Paystack is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null)
    const reference = String(body?.reference ?? '').trim()
    if (!reference || reference.length > 100) {
      return new Response(JSON.stringify({ error: 'A payment reference is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok || payload?.status !== true) {
      console.error('Paystack verify failed', res.status, JSON.stringify(payload))
      return new Response(JSON.stringify({ error: payload?.message ?? 'Paystack verify failed' }), {
        status: res.status === 200 ? 502 : res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tx = payload.data
    const status = tx.status === 'success' ? 'success' : tx.status === 'abandoned' ? 'abandoned' : 'failed'

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: payment, error: fetchError } = await admin
      .from('payments')
      .select('*')
      .eq('paystack_reference', reference)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!payment) {
      return new Response(JSON.stringify({ error: 'Payment record not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await admin.from('payments').update({
      status,
      channel: tx.channel ?? null,
      paid_at: tx.paid_at ?? null,
    }).eq('id', payment.id)

    if (status === 'success' && payment.reference_id) {
      if (payment.purpose === 'billing') {
        await admin.from('hospital_billing').update({
          payment_status: 'paid',
          payment_method: tx.channel ?? 'paystack',
          paid_at: tx.paid_at ?? new Date().toISOString(),
        }).eq('id', payment.reference_id)
      } else if (payment.purpose === 'pharmacy') {
        await admin.from('pharmacy_dispensing').update({ payment_status: 'paid' }).eq('id', payment.reference_id)
      }
    }

    return new Response(JSON.stringify({ status, amount: tx.amount / 100, reference }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('paystack-verify error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
