# Finish the Paystack plan-gating work: secrets cleanup

The payment fix itself is already built and deployed — verified in the project right now:

- `paystack-webhook` exists and is configured to run without JWT verification, alongside `paystack-initialize` and `paystack-verify`.
- `hospitals.active_plan` / `hospitals.subscription_status` and `payments.plan` are in the database.
- Sign-up stores the chosen plan on the pending payment row and lands on the confirming-payment page, which waits for the webhook.

Webhook URL for the Paystack dashboard:

```text
https://cjjbfrckrfuaqyrkmbfn.functions.supabase.co/paystack-webhook
```

Final plan/subscription fields:

```text
hospitals.active_plan          text NOT NULL default 'none'      -- none | emr | telemedicine
hospitals.subscription_status  text NOT NULL default 'inactive'  -- inactive | pending | active | expired
payments.plan                  text                              -- emr | telemedicine
payments.status                text                              -- pending | success | failed
```

What is left is the secrets hygiene part of your message.

## 1. Stop tracking secret-bearing config

Add `.env` (and `.env.*`, excluding `.env.example`) to `.gitignore`.

Important caveat: `.env` currently holds only public values — the backend URL, the publishable/anon key, the project id, and the Paystack **public** key. Vite inlines those at build time, and the published app breaks without them, so the file itself stays on disk. Ignoring it means secrets can never be added to a tracked file later; the public build values keep working from the local file and from build-time injection.

## 2. Remove the last client-side secret reference

`src/services/paystack.ts` still reads `VITE_PAYSTACK_SECRET_KEY`, which no longer exists. Any call path through it silently fails and would have shipped a secret to the browser. Strip the secret-key paths from that service so every privileged Paystack call goes through the edge functions, and adjust the callers that still use it.

## 3. Rotate the two credentials you pasted

Both keys were pasted into chat, so treat them as exposed and rotate at the provider before storing:

- `DAILY_API_KEY` — the Daily.co key.
- `PAYSTACK_SECRET_KEY` — the new Paystack secret.

I will open the secure secret form for each; the values go straight to the backend secret store and are never written to a file. The webhook and initialize functions read `PAYSTACK_SECRET_KEY` from there, so the signature check starts passing with the new key as soon as it is saved.

## Out of scope

No changes to pricing, sign-up steps, unrelated payment logic, or UI.
