import Stripe from "stripe";
import { storage } from "./storage";
import type { User, Payment, Booking } from "@shared/schema";

/**
 * Stripe Connect integration for A-Bid's on-platform settlement.
 *
 * Money flow (destination charges):
 *   guest pays the full installment amount to the A-Bid platform account;
 *   Stripe splits it — application_fee_amount (A-Bid's take rate) stays with
 *   the platform, the remainder transfers automatically to the owner's
 *   connected Express account (transfer_data.destination).
 *
 * Configuration (see STRIPE_SETUP.md):
 *   STRIPE_SECRET_KEY      sk_test_... / sk_live_...  (server-side API calls)
 *   STRIPE_PUBLISHABLE_KEY pk_test_... / pk_live_...  (client-side card form)
 *   STRIPE_WEBHOOK_SECRET  whsec_...                  (webhook signature check)
 *   PLATFORM_FEE_PERCENT   take rate, default 12      (Business Plan §6)
 */

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
export const PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";
export const PLATFORM_FEE_PERCENT = Math.max(
  0,
  parseFloat(process.env.PLATFORM_FEE_PERCENT || "12") || 12
);

let stripe: Stripe | null = null;
let warned = false;

export function isStripeConfigured(): boolean {
  return SECRET_KEY.startsWith("sk_test_") || SECRET_KEY.startsWith("sk_live_");
}

export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) {
    if (!warned) {
      console.warn("[stripe] STRIPE_SECRET_KEY not set — Stripe payments are disabled (demo pay path only)");
      warned = true;
    }
    return null;
  }
  if (!stripe) stripe = new Stripe(SECRET_KEY);
  return stripe;
}

export function getWebhookSecret(): string {
  return WEBHOOK_SECRET;
}

/** A-Bid's take on a payment, in cents. */
export function platformFeeCents(amountCents: number): number {
  return Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100);
}

/**
 * Create (or reuse) the owner's Express account and return a one-time
 * onboarding link. The owner completes identity verification + payout details
 * on Stripe's hosted page, then returns to returnUrl.
 */
export async function createOwnerOnboardingLink(
  owner: User,
  refreshUrl: string,
  returnUrl: string
): Promise<{ url: string | null; accountId: string }> {
  const s = getStripe();
  if (!s) throw new Error("Stripe is not configured");
  let accountId = owner.stripeAccountId;
  if (!accountId) {
    const account = await s.accounts.create({
      type: "express",
      country: "CA",
      email: owner.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { abid_user_id: String(owner.id) },
    });
    accountId = account.id;
    storage.updateUser(owner.id, { stripeAccountId: accountId });
  }
  const link = await s.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return { url: link.url, accountId };
}

/** Has the owner finished Connect onboarding (charges + payouts enabled)? */
export async function isOwnerOnboarded(owner: User): Promise<boolean> {
  const s = getStripe();
  if (!s || !owner.stripeAccountId) return false;
  try {
    const account = await s.accounts.retrieve(owner.stripeAccountId);
    const ready = !!account.charges_enabled && !!account.payouts_enabled;
    if (ready && !owner.stripeOnboardingComplete) {
      storage.updateUser(owner.id, { stripeOnboardingComplete: 1 });
    }
    return ready;
  } catch {
    return false;
  }
}

/**
 * Create (or retrieve) the PaymentIntent for one installment payment.
 * Idempotent per payment row: a second call returns the existing intent.
 */
export async function createBookingPaymentIntent(
  payment: Payment,
  booking: Booking,
  owner: User
): Promise<Stripe.PaymentIntent> {
  const s = getStripe();
  if (!s) throw new Error("Stripe is not configured");
  if (!owner.stripeAccountId) {
    throw new Error("Owner has not connected their Stripe payout account yet");
  }
  if (payment.status === "paid") {
    throw new Error("Payment is already paid");
  }
  if (payment.stripePaymentIntentId) {
    return s.paymentIntents.retrieve(payment.stripePaymentIntentId);
  }
  const amountCents = Math.round(payment.amount * 100);
  const intent = await s.paymentIntents.create({
    amount: amountCents,
    currency: "cad",
    application_fee_amount: platformFeeCents(amountCents),
    transfer_data: { destination: owner.stripeAccountId },
    description: `A-Bid booking #${booking.id} — ${payment.type} payment`,
    metadata: {
      abid_payment_id: String(payment.id),
      abid_booking_id: String(booking.id),
      abid_owner_id: String(owner.id),
    },
  });
  storage.setPaymentStripeIntent(payment.id, intent.id);
  return intent;
}
