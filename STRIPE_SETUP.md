# A-Bid — Stripe Setup Guide

A-Bid settles **on-platform** via **Stripe Connect** (destination charges):

- The guest's card is charged by the A-Bid platform account.
- Stripe automatically splits each payment: A-Bid's take rate (`PLATFORM_FEE_PERCENT`, default **12%**, see Business Plan §6) stays with the platform, the rest transfers to the owner's connected Express account.
- Owners onboard through Stripe's hosted flow (identity verification + bank details) — A-Bid never touches bank numbers.

Without keys configured, the app still runs: owners see a "not configured" notice and guest payments use the manual demo path.

## 1. Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Example | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe Dashboard → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Same page |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Developers → Webhooks → your endpoint → Signing secret |
| `PLATFORM_FEE_PERCENT` | `12` | Your take rate; change any time, no code change needed |
| `SESSION_SECRET` | random string | Generate: `openssl rand -hex 32` |

> Never commit `.env`. Use **test** keys (`sk_test_`) until you're ready for real money.

## 2. Stripe Dashboard steps (test mode)

1. **Create a Stripe account** at https://dashboard.stripe.com/register (country: Canada, currency: CAD).
2. **Get API keys:** Developers → API keys → copy the *Publishable key* (`pk_test_...`) and *Secret key* (`sk_test_...`) into `.env`.
3. **Enable Connect:** Settings → Connect → enable. (Express accounts are used; no extra config needed for test mode.)
4. **Branding (optional but recommended):** Settings → Public details → set business name "A-Bid" and support email — owners see this during onboarding.
5. **Create the webhook endpoint:**
   - Developers → Webhooks → Add endpoint.
   - URL: `https://<your-domain>/api/stripe/webhook` (for local testing see §4).
   - Events to send: `payment_intent.succeeded`, `payment_intent.payment_failed`.
   - Copy the **Signing secret** (`whsec_...`) into `.env` as `STRIPE_WEBHOOK_SECRET`.
6. **Restart the server** so it picks up the new env vars.

## 3. How it works in the app

- **Owner:** Accounting page → *Connect with Stripe* → completes Stripe's hosted onboarding → returns to A-Bid; the card flips to "Payouts connected".
- **Guest:** Booking details → *Pay Now* on a pending installment → card form (Stripe Elements) → confirms the PaymentIntent. The webhook then marks the payment paid, writes the owner's ledger entry, and notifies the owner.
- **Admin/demo:** the old "mark paid" path still exists for testing, but is now restricted to the booking's guest.

## 4. Local webhook testing

Stripe can't reach `localhost`. Use the Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

Copy the printed `whsec_...` into `.env` as `STRIPE_WEBHOOK_SECRET`, restart, and pay with the test card **4242 4242 4242 4242** (any future expiry, any CVC).

## 5. Going live checklist

- [ ] Switch all three keys to **live** values (`sk_live_`, `pk_live_`, new `whsec_`).
- [ ] Set a strong `SESSION_SECRET`.
- [ ] Complete Stripe's business verification (Settings → Connect) — required before live payouts.
- [ ] Re-create the webhook endpoint against the production URL and update `STRIPE_WEBHOOK_SECRET`.
- [ ] Confirm the take rate in `PLATFORM_FEE_PERCENT` matches your pricing decision.
- [ ] Test a real (small) payment end-to-end, then refund it from the Dashboard.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Stripe is not configured" on checkout | `STRIPE_SECRET_KEY` missing or not starting with `sk_test_`/`sk_live_` |
| Webhook returns 400 "Invalid signature" | `STRIPE_WEBHOOK_SECRET` doesn't match the endpoint's signing secret |
| Payment succeeds but stays "pending" | Webhook isn't reaching the server (see §4) |
| Owner sees "not connected" after onboarding | They didn't finish all Stripe steps — have them retry via *Connect with Stripe* |
