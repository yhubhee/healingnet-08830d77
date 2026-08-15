# Paystack webhook + hospital plan tracking

## What exists today (verified)

- Edge functions: `paystack-initialize` (creates a Paystack transaction + a `pending` row in `payments`) and `paystack-verify` (manual verify, called by browser polling in `useCollectPayment`). There is **no webhook function** — so if the browser tab closes or polling times out, the payment stays `pending` forever. That is the stuck-status bug.
- Payment status lives in `payments.status` (`pending` / `success` / `failed` / `abandoned`), keyed by `payments.paystack_reference`, with `purpose` limited to `billing` / `pharmacy` / `consultation`.
- Plan selection happens in `src/pages/Signup.tsx` (`emr` vs `telemedicine`) and is passed to the `create-hospital` function, which immediately inserts an **active** `hospital_subscriptions` row — no payment is required today.
- `hospitals` has no plan column. Feature gating reads `hospital_subscriptions.plan` via `useSubscription` / `hasPlan` / `RequirePlan`.

## Decisions applied

- Both plans are paid; access unlocks only after the webhook confirms payment.
- Plan values stay `emr` and `telemedicine` (no rename).

## Changes

### 1. Database
- Add to `hospitals`: `active_plan` (`none` | `emr` | `telemedicine`, default `none`) and `subscription_status` (`inactive` | `pending` | `active` | `expired`, default `inactive`). This is the field feature gating reads.
- Allow `subscription` in the `payments.purpose` check constraint, and add a `plan` text column on `payments` so the chosen plan is stored **with the pending transaction** (survives reloads, available when the webhook fires later).
- Backfill: existing hospitals with an active subscription get `active_plan` from `hospital_subscriptions.plan` and `subscription_status = 'active'`, so nobody currently working loses access.

Final plan/subscription schema:

```text
hospitals.active_plan          text  NOT NULL default 'none'   -- none | emr | telemedicine
hospitals.subscription_status  text  NOT NULL default 'inactive' -- inactive | pending | active | expired
payments.plan                  text  NULL                      -- emr | telemedicine (subscription payments)
payments.purpose               text  -- billing | pharmacy | consultation | subscription
hospital_subscriptions.plan/status  -- kept, updated by the webhook
```

### 2. New edge function `paystack-webhook`
- POST only, `verify_jwt = false` (Paystack sends no JWT).
- Reads the **raw** body, computes HMAC SHA512 with `PAYSTACK_SECRET_KEY` from `Deno.env`, compares to `x-paystack-signature`; mismatch → 401, nothing written.
- On `charge.success`: looks up `payments` by reference, sets `status = 'success'`, `paid_at`, `channel`. Then by purpose:
  - `subscription` → sets `hospitals.active_plan` = the plan stored on the payment row, `subscription_status = 'active'`, and upserts the `hospital_subscriptions` row to `status = 'active'`.
  - `billing` / `pharmacy` → same record updates `paystack-verify` already does (idempotent, no behaviour change).
- Ignores unknown events, returns 200 immediately after the DB write; all work is short so Paystack gets a fast ack. Idempotent — re-delivery of the same reference is a no-op.
- `paystack-verify` stays as-is for the in-app collection flows, and is also mirrored to write the plan fields so a manual verify can't disagree with the webhook.

### 3. Sign-up flow
- `create-hospital` creates the hospital + admin staff as today, but the subscription starts `pending` and `hospitals.subscription_status = 'pending'`, `active_plan = 'none'`.
- After the hospital is created, sign-up initialises a Paystack transaction with `purpose: 'subscription'`, the selected `plan`, and the new hospital id, then sends the user to a new `/hospital/confirming-payment` route.
- That page polls `hospitals.subscription_status` (plus a realtime subscription) and only routes into the dashboard once the **webhook** has flipped it to `active`. No unlocking based on the Paystack redirect alone.
- `useSubscription` / `hasPlan` / `RequirePlan` read `hospitals.active_plan` + `subscription_status` (falling back to the subscriptions table), so Telemedicine UI stays gated until the webhook lands.

### 4. Webhook URL to paste into the Paystack dashboard

```text
https://cjjbfrckrfuaqyrkmbfn.functions.supabase.co/paystack-webhook
```

### 5. Secrets / `.env`
- `PAYSTACK_SECRET_KEY` and `DAILY_API_KEY` are already backend secrets; I'll update them to the new values you gave (Daily key, and the Paystack key from the stored secret) via the secrets store — never in code.
- `.env` is generated and owned by the platform: it must keep `VITE_SUPABASE_*` for the build, but I'll strip `VITE_PAYSTACK_SECRET_KEY` and the raw `DAILY_API_KEY` from it since a `VITE_` secret key is shipped to every browser. Note: git operations are managed by the platform, so I can't edit `.gitignore` history — the fix is removing the secrets from the file, and rotating the Paystack test key that was exposed.

## Out of scope
No changes to pricing, other payment flows, or unrelated sign-up steps/UI.
