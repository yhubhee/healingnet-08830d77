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
    const purpose = body?.purpose
    const amount = Number(body?.amount)
    const email = String(body?.email ?? '').trim()

    if (!['billing', 'pharmacy', 'consultation'].includes(purpose)) {
      return new Response(JSON.stringify({ error: 'Invalid purpose' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'A valid payer email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reference = `hn_${purpose}_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
    const callbackUrl = typeof body?.callbackUrl === 'string' ? body.callbackUrl : undefined

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        reference,
        callback_url: callbackUrl,
        metadata: { purpose, reference_id: body?.referenceId ?? null },
      }),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok || payload?.status !== true) {
      console.error('Paystack initialize failed', res.status, JSON.stringify(payload))
      return new Response(JSON.stringify({ error: payload?.message ?? 'Paystack initialize failed' }), {
        status: res.status === 200 ? 502 : res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error: insertError } = await admin.from('payments').insert({
      hospital_id: body?.hospitalId ?? null,
      patient_id: body?.patientId ?? null,
      purpose,
      reference_id: body?.referenceId ?? null,
      amount,
      email,
      paystack_reference: reference,
      status: 'pending',
      authorization_url: payload.data.authorization_url,
      metadata: body?.metadata ?? {},
    })
    if (insertError) throw insertError

    return new Response(
      JSON.stringify({
        reference,
        authorization_url: payload.data.authorization_url,
        access_code: payload.data.access_code,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('paystack-initialize error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
