import { createClient } from 'npm:@supabase/supabase-js@2'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sign(raw: string, key: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(raw)))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!PAYSTACK_SECRET_KEY) {
    console.error('paystack-webhook: PAYSTACK_SECRET_KEY missing')
    return new Response('Not configured', { status: 500 })
  }

  const raw = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const expected = await sign(raw, PAYSTACK_SECRET_KEY)
  if (!signature || !timingSafeEqual(signature, expected)) {
    console.warn('paystack-webhook: invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return new Response('Bad payload', { status: 400 })
  }

  if (event?.event !== 'charge.success') {
    return new Response('ok', { status: 200 })
  }

  try {
    const tx = event.data ?? {}
    const reference = String(tx.reference ?? '')
    if (!reference) return new Response('ok', { status: 200 })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: payment } = await admin
      .from('payments')
      .select('*')
      .eq('paystack_reference', reference)
      .maybeSingle()

    if (!payment) {
      console.warn('paystack-webhook: no payment row for', reference)
      return new Response('ok', { status: 200 })
    }

    // Idempotent: already settled, nothing to do.
    if (payment.status !== 'success') {
      await admin.from('payments').update({
        status: 'success',
        channel: tx.channel ?? null,
        paid_at: tx.paid_at ?? new Date().toISOString(),
      }).eq('id', payment.id)
    }

    if (payment.purpose === 'subscription' && payment.hospital_id) {
      const plan = payment.plan === 'telemedicine' ? 'telemedicine' : 'emr'
      await admin.from('hospitals').update({
        active_plan: plan,
        subscription_status: 'active',
      }).eq('id', payment.hospital_id)

      const { data: sub } = await admin
        .from('hospital_subscriptions')
        .select('id')
        .eq('hospital_id', payment.hospital_id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sub) {
        await admin.from('hospital_subscriptions')
          .update({ plan, status: 'active' })
          .eq('id', sub.id)
      } else {
        await admin.from('hospital_subscriptions').insert({
          hospital_id: payment.hospital_id, plan, status: 'active', billing_cycle: 'monthly',
        })
      }
    } else if (payment.purpose === 'billing' && payment.reference_id) {
      await admin.from('hospital_billing').update({
        payment_status: 'paid',
        payment_method: tx.channel ?? 'paystack',
        paid_at: tx.paid_at ?? new Date().toISOString(),
      }).eq('id', payment.reference_id)
    } else if (payment.purpose === 'pharmacy' && payment.reference_id) {
      await admin.from('pharmacy_dispensing')
        .update({ payment_status: 'paid' })
        .eq('id', payment.reference_id)
    }
  } catch (e) {
    console.error('paystack-webhook error', e)
  }

  return new Response('ok', { status: 200 })
})
