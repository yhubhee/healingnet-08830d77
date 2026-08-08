import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')

function wrap(title: string, message: string, actionUrl?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0b1220;border-radius:12px 12px 0 0;padding:20px 24px">
      <span style="color:#22d3ee;font-size:18px;font-weight:bold;letter-spacing:.5px">HealingNet</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px">
      <h1 style="margin:0 0 12px;font-size:18px;color:#0b1220">${title}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155">${message}</p>
      ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;background:#06b6d4;color:#04212a;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px;font-size:14px">View in HealingNet</a>` : ''}
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">You are receiving this because of activity on your HealingNet account. Manage email preferences in your account settings.</p>
    </div>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Gmail SMTP is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null)
    const to = String(body?.to ?? '').trim()
    const subject = String(body?.subject ?? '').trim()
    const message = String(body?.message ?? '').trim()
    const userId = body?.userId as string | undefined
    const category = body?.category as string | undefined

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return new Response(JSON.stringify({ error: 'Valid recipient email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!subject || subject.length > 200 || !message || message.length > 5000) {
      return new Response(JSON.stringify({ error: 'Subject and message are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Respect the recipient's saved email preferences when we know who they are.
    if (userId) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: prefs } = await admin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (prefs) {
        const columnByCategory: Record<string, string> = {
          appointment: 'email_appointments',
          lab: 'email_lab_results',
          prescription: 'email_prescriptions',
          letter: 'email_letters',
          billing: 'email_billing',
        }
        const col = category ? columnByCategory[category] : undefined
        const enabled = prefs.email_enabled && (!col || (prefs as Record<string, unknown>)[col] !== false)
        if (!enabled) {
          return new Response(JSON.stringify({ skipped: true, reason: 'opted_out' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    })

    await client.send({
      from: `HealingNet <${GMAIL_USER}>`,
      to,
      subject,
      content: message,
      html: wrap(subject, message, typeof body?.actionUrl === 'string' ? body.actionUrl : undefined),
    })
    await client.close()

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-email error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
