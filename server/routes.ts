import type { Express } from "express";
import type { Server } from "node:http";
import { storage, db, seedDatabase } from "./storage";
import {
  insertPropertySchema, insertTripRequestSchema,
  insertBidSchema, insertLedgerEntrySchema,
  insertRatingSchema, insertGuestRatingSchema,
} from "@shared/schema";
import {
  registerAuthRoutes, requireAuth, requireRole, selfOrAdmin, currentUser, safeUser, publicUser,
} from "./auth";
import {
  isStripeConfigured, getStripe, getWebhookSecret,
  PUBLISHABLE_KEY, PLATFORM_FEE_PERCENT,
  createOwnerOnboardingLink, isOwnerOnboarded, createBookingPaymentIntent,
} from "./stripe";

const BOOKING_STATUSES = ["upcoming", "active", "completed", "cancelled"] as const;

// Client must never set ownership ids — the server injects them from the session.
const tripRequestInputSchema = insertTripRequestSchema.omit({ guestId: true });
const bidInputSchema = insertBidSchema.omit({ ownerId: true });
const propertyInputSchema = insertPropertySchema.omit({ ownerId: true });

function validScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

/** Express 5 types headers as string | string[] — collapse to a single string. */
function headerValue(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

/** Express 5 types route params as string | string[] — parse the id safely. */
function paramId(req: { params: Record<string, string | string[] | undefined> }, name = "id"): number {
  const raw = req.params[name];
  return parseInt(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "", 10);
}

/**
 * Single place where a payment transitions to "paid".
 * Cash-basis accounting (P0-2 fix): owner income is recognized exactly once,
 * here, when money actually arrives — never at bid-accept time.
 * Used by the manual demo pay path and the Stripe webhook alike.
 */
function recordPaymentReceived(paymentId: number) {
  const payment = storage.getPayment(paymentId);
  if (!payment || payment.status === "paid") return;
  const today = new Date().toISOString().split("T")[0];
  storage.updatePaymentStatus(paymentId, "paid", today);
  const booking = storage.getBooking(payment.bookingId);
  if (booking) {
    storage.createLedgerEntry({
      ownerId: booking.ownerId,
      bookingId: booking.id,
      type: "income",
      category: "booking_revenue",
      amount: payment.amount,
      description: `Payment received — Booking #${booking.id} (${payment.type})`,
      date: today,
    });
    storage.createNotification({
      userId: booking.ownerId,
      type: "payment_received",
      message: `Payment of $${payment.amount} received for booking #${booking.id}`,
      read: 0,
    });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed demo data on startup
  seedDatabase();

  // ─── Auth (public) ───
  registerAuthRoutes(app);

  // ─── Public config (publishable key + fee %, no secrets) ───
  app.get("/api/config", (_req, res) => {
    res.json({
      stripeConfigured: isStripeConfigured(),
      stripePublishableKey: PUBLISHABLE_KEY || null,
      platformFeePercent: PLATFORM_FEE_PERCENT,
    });
  });

  // ─── Users ───
  app.get("/api/users", requireRole("admin"), (_req, res) => {
    res.json(
      storage.getUsersByRole("guest")
        .concat(storage.getUsersByRole("owner"), storage.getUsersByRole("admin"))
        .map(safeUser)
    );
  });

  app.get("/api/users/:id", requireAuth, (req, res) => {
    const id = paramId(req);
    const user = storage.getUser(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    // Full profile (incl. email/phone) for self and admins; public projection for others.
    if (selfOrAdmin(req, id)) return res.json(safeUser(user));
    res.json(publicUser(user));
  });

  // Batch name/avatar lookup for users the requester interacts with.
  // Returns the public projection only — never emails, phones, or hashes.
  app.post("/api/users/lookup", requireAuth, (req, res) => {
    const raw = req.body?.ids;
    const ids = Array.isArray(raw)
      ? raw.filter((n) => Number.isInteger(n)).slice(0, 100)
      : [];
    res.json(
      ids
        .map((id) => {
          const u = storage.getUser(id);
          return u ? publicUser(u) : null;
        })
        .filter(Boolean)
    );
  });

  // ─── Properties ───
  app.get("/api/properties", (_req, res) => {
    res.json(storage.getAllProperties());
  });

  app.get("/api/properties/:id", (req, res) => {
    const prop = storage.getProperty(paramId(req));
    if (!prop) return res.status(404).json({ message: "Property not found" });
    res.json(prop);
  });

  app.get("/api/owners/:id/properties", requireAuth, (req, res) => {
    res.json(storage.getPropertiesByOwner(paramId(req)));
  });

  app.post("/api/properties", requireRole("owner", "admin"), (req, res) => {
    const me = currentUser(req)!;
    const parsed = propertyInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    // Owners can only list under their own account.
    res.status(201).json(storage.createProperty({ ...parsed.data, ownerId: me.id }));
  });

  // ─── Trip Requests ───
  app.get("/api/trip-requests", (_req, res) => {
    res.json(storage.getActiveTripRequests());
  });

  app.get("/api/guests/:id/trip-requests", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getTripRequestsByGuest(id));
  });

  app.get("/api/trip-requests/:id", requireAuth, (req, res) => {
    const tr = storage.getTripRequest(paramId(req));
    if (!tr) return res.status(404).json({ message: "Trip request not found" });
    res.json(tr);
  });

  app.get("/api/trip-requests/:id/bids", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const trip = storage.getTripRequest(paramId(req));
    if (!trip) return res.status(404).json({ message: "Trip request not found" });
    // The guest who posted it, an admin, or an owner who bid on it.
    const myBid = storage.getBidsByTripRequest(trip.id).some(b => b.ownerId === me.id);
    if (me.role !== "admin" && trip.guestId !== me.id && !myBid) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(storage.getBidsByTripRequest(trip.id));
  });

  app.post("/api/trip-requests", requireRole("guest", "admin"), (req, res) => {
    const me = currentUser(req)!;
    const parsed = tripRequestInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const trip = storage.createTripRequest({ ...parsed.data, guestId: me.id });
    // Notify all owners
    const owners = storage.getUsersByRole("owner");
    const guest = storage.getUser(trip.guestId);
    owners.forEach(owner => {
      storage.createNotification({
        userId: owner.id,
        type: "new_request",
        message: `New trip request from ${guest?.name || "a guest"}: ${trip.city}, ${trip.checkIn} to ${trip.checkOut}, budget $${trip.budgetTotal}`,
        read: 0,
      });
    });
    res.status(201).json(trip);
  });

  // ─── Bids ───
  app.get("/api/bids/:id", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const bid = storage.getBid(paramId(req));
    if (!bid) return res.status(404).json({ message: "Bid not found" });
    const trip = storage.getTripRequest(bid.tripRequestId);
    if (me.role !== "admin" && bid.ownerId !== me.id && trip?.guestId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(bid);
  });

  app.get("/api/owners/:id/bids", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getBidsByOwner(id));
  });

  app.post("/api/bids", requireRole("owner", "admin"), (req, res) => {
    const me = currentUser(req)!;
    const parsed = bidInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    // P1-2 fix (done with the auth work): an owner can only bid their own property.
    const property = storage.getProperty(parsed.data.propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (me.role !== "admin" && property.ownerId !== me.id) {
      return res.status(403).json({ message: "You can only bid with your own property" });
    }
    const trip = storage.getTripRequest(parsed.data.tripRequestId);
    if (!trip || trip.status !== "active") {
      return res.status(400).json({ message: "Trip request is not open for bids" });
    }
    if (parsed.data.totalPrice <= 0 || parsed.data.pricePerNight <= 0) {
      return res.status(400).json({ message: "Bid prices must be positive" });
    }
    const bid = storage.createBid({ ...parsed.data, ownerId: me.id });
    // Notify the guest
    const owner = storage.getUser(bid.ownerId);
    const prop = storage.getProperty(bid.propertyId);
    storage.createNotification({
      userId: trip.guestId,
      type: "bid_received",
      message: `${owner?.name || "A host"} bid $${bid.pricePerNight}/night on ${prop?.title || "their property"}`,
      read: 0,
    });
    res.status(201).json(bid);
  });

  // Accept a bid → creates booking + payment plan + rejects other bids.
  // P0-1 fix: the plan below is computed in integer cents and the stay
  // payments (installment + final) are asserted to sum to EXACTLY 100% of the
  // agreed total before anything is persisted. The damage deposit is a
  // separate refundable hold collected on top, not part of the stay total.
  // P0-2 fix: no ledger entry is written here. Owner income is recognized on
  // a cash basis — one entry per payment, written only when the payment is
  // marked paid (recordPaymentReceived). Booking it here too double-counted
  // revenue.
  app.post("/api/bids/:id/accept", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const bidId = paramId(req);
    const bid = storage.getBid(bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });
    if (bid.status !== "pending") {
      return res.status(400).json({ message: "Bid is no longer pending" });
    }

    const trip = storage.getTripRequest(bid.tripRequestId);
    if (!trip) return res.status(404).json({ message: "Trip request not found" });
    if (trip.status !== "active") {
      return res.status(400).json({ message: "Trip request is no longer active" });
    }
    // Only the guest who posted the trip request can accept a bid on it.
    if (me.role !== "admin" && trip.guestId !== me.id) {
      return res.status(403).json({ message: "Only the trip requester can accept a bid" });
    }

    // Accept this bid
    storage.updateBidStatus(bidId, "accepted");
    // Reject all other bids for this trip request
    const allBids = storage.getBidsByTripRequest(trip.id);
    allBids.forEach(b => {
      if (b.id !== bidId) storage.updateBidStatus(b.id, "rejected");
    });
    // Close the trip request
    storage.updateTripRequestStatus(trip.id, "closed");

    // ── Payment plan (integer cents — no float drift) ──
    const totalCents = Math.round(bid.totalPrice * 100);
    if (totalCents <= 0) {
      return res.status(400).json({ message: "Bid total must be positive" });
    }
    const damageDeposit = Math.round(totalCents * 0.2) / 100; // refundable hold, on top
    const installmentCents = Math.round(totalCents * 0.4);
    const finalCents = totalCents - installmentCents; // remainder absorbs rounding
    if (installmentCents + finalCents !== totalCents || installmentCents <= 0 || finalCents <= 0) {
      return res.status(500).json({ message: "Payment plan calculation error" });
    }
    const installment = installmentCents / 100;
    const final = finalCents / 100;

    // Create booking
    const booking = storage.createBooking({
      bidId: bid.id,
      tripRequestId: trip.id,
      propertyId: bid.propertyId,
      guestId: trip.guestId,
      ownerId: bid.ownerId,
      checkIn: trip.checkIn,
      checkOut: trip.checkOut,
      totalPrice: Math.round(totalCents) / 100,
      damageDeposit,
      status: "upcoming",
    });

    // Create payment plan: refundable damage-deposit hold + stay in two parts
    const today = new Date();
    const checkInDate = new Date(trip.checkIn);
    const daysUntilCheckIn = Math.max(1, Math.ceil((checkInDate.getTime() - today.getTime()) / 86400000));
    const midPoint = Math.floor(daysUntilCheckIn / 2);

    storage.createPayment({
      bookingId: booking.id, guestId: trip.guestId,
      amount: damageDeposit, type: "deposit", status: "pending",
      dueDate: today.toISOString().split("T")[0],
    });
    storage.createPayment({
      bookingId: booking.id, guestId: trip.guestId,
      amount: installment,
      type: "installment", status: "pending",
      dueDate: new Date(today.getTime() + midPoint * 86400000).toISOString().split("T")[0],
    });
    storage.createPayment({
      bookingId: booking.id, guestId: trip.guestId,
      amount: final,
      type: "final", status: "pending",
      dueDate: new Date(checkInDate.getTime() - 86400000).toISOString().split("T")[0],
    });

    // Notify owner
    const guest = storage.getUser(trip.guestId);
    storage.createNotification({
      userId: bid.ownerId,
      type: "bid_accepted",
      message: `${guest?.name || "Guest"} accepted your bid of $${bid.pricePerNight}/night`,
      read: 0,
    });

    res.status(201).json(booking);
  });

  app.post("/api/bids/:id/reject", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const bid = storage.getBid(paramId(req));
    if (!bid) return res.status(404).json({ message: "Bid not found" });
    const trip = storage.getTripRequest(bid.tripRequestId);
    if (me.role !== "admin" && bid.ownerId !== me.id && trip?.guestId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    storage.updateBidStatus(bid.id, "rejected");
    res.json({ success: true });
  });

  // ─── Bookings ───
  app.get("/api/bookings", requireRole("admin"), (_req, res) => {
    res.json(storage.getAllBookings());
  });

  app.get("/api/guests/:id/bookings", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getBookingsByGuest(id));
  });

  app.get("/api/owners/:id/bookings", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getBookingsByOwner(id));
  });

  app.get("/api/bookings/:id", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const booking = storage.getBooking(paramId(req));
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.guestId !== me.id && booking.ownerId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(booking);
  });

  app.get("/api/bookings/:id/payments", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const booking = storage.getBooking(paramId(req));
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.guestId !== me.id && booking.ownerId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(storage.getPaymentsByBooking(booking.id));
  });

  app.patch("/api/bookings/:id/status", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const booking = storage.getBooking(paramId(req));
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.guestId !== me.id && booking.ownerId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { status } = req.body;
    if (!(BOOKING_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${BOOKING_STATUSES.join(", ")}` });
    }
    storage.updateBookingStatus(booking.id, status);
    res.json({ success: true });
  });

  // ─── Payments ───
  app.get("/api/guests/:id/payments", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getPaymentsByGuest(id));
  });

  // Manual "mark paid" — demo/testing path for when Stripe is not configured.
  // Only the booking's guest can mark their own payment paid.
  app.post("/api/payments/:id/pay", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const paymentId = paramId(req);
    const payment = storage.getPayment(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const booking = storage.getBooking(payment.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.guestId !== me.id) {
      return res.status(403).json({ message: "Only the booking guest can pay" });
    }
    recordPaymentReceived(paymentId);
    res.json({ success: true });
  });

  // ─── Stripe Connect (P0-4) ───

  // Owner onboarding: returns a one-time Stripe-hosted onboarding URL.
  app.post("/api/connect/onboard", requireRole("owner", "admin"), async (req, res) => {
    const me = currentUser(req)!;
    try {
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const base = `${headerValue(proto as string | string[])}://${headerValue(req.get("host"))}`;
      const { url, accountId } = await createOwnerOnboardingLink(
        me,
        `${base}/#/owner/accounting?connect=refresh`,
        `${base}/#/owner/accounting?connect=return`
      );
      res.json({ url, accountId });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Could not start Stripe onboarding" });
    }
  });

  // Owner Connect status: account id + whether charges/payouts are enabled.
  app.get("/api/connect/status", requireRole("owner", "admin"), async (req, res) => {
    const me = currentUser(req)!;
    const onboarded = await isOwnerOnboarded(me);
    res.json({
      stripeAccountId: me.stripeAccountId || null,
      onboarded,
      stripeConfigured: isStripeConfigured(),
    });
  });

  // Guest checkout: create (or reuse) the PaymentIntent for one installment.
  // Returns the clientSecret for Stripe.js confirmation.
  app.post("/api/payments/:id/checkout", requireAuth, async (req, res) => {
    const me = currentUser(req)!;
    const payment = storage.getPayment(paramId(req));
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const booking = storage.getBooking(payment.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.guestId !== me.id) {
      return res.status(403).json({ message: "Only the booking guest can pay" });
    }
    try {
      const owner = storage.getUser(booking.ownerId);
      if (!owner) return res.status(404).json({ message: "Owner not found" });
      const intent = await createBookingPaymentIntent(payment, booking, owner);
      res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Could not create payment" });
    }
  });

  // Stripe webhook — signature-verified; uses the raw body captured in index.ts.
  app.post("/api/stripe/webhook", async (req: any, res) => {
    const s = getStripe();
    const secret = getWebhookSecret();
    if (!s || !secret) {
      return res.status(503).json({ message: "Stripe webhook not configured" });
    }
    let event;
    try {
      event = s.webhooks.constructEvent(req.rawBody, headerValue(req.headers["stripe-signature"]), secret);
    } catch (err: any) {
      console.error("[stripe] webhook signature failed:", err.message);
      return res.status(400).json({ message: "Invalid signature" });
    }
    try {
      if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object as { id: string };
        const payment = storage.getPaymentByStripeIntent(intent.id);
        if (payment) recordPaymentReceived(payment.id);
      } else if (event.type === "payment_intent.payment_failed") {
        const intent = event.data.object as { id: string };
        const payment = storage.getPaymentByStripeIntent(intent.id);
        if (payment && payment.status !== "paid") {
          storage.updatePaymentStatus(payment.id, "failed");
          const booking = storage.getBooking(payment.bookingId);
          if (booking) {
            storage.createNotification({
              userId: booking.guestId,
              type: "payment_due",
              message: `Payment of $${payment.amount} for booking #${booking.id} failed — please try again`,
              read: 0,
            });
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("[stripe] webhook handler error:", err.message);
      res.status(500).json({ message: "Webhook handler error" });
    }
  });

  // ─── Ledger (Owner Accounting) ───
  app.get("/api/owners/:id/ledger", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getLedgerByOwner(id));
  });

  app.post("/api/owners/:id/ledger", requireAuth, (req, res) => {
    const ownerId = paramId(req);
    if (!selfOrAdmin(req, ownerId)) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertLedgerEntrySchema.safeParse({ ...req.body, ownerId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createLedgerEntry(parsed.data));
  });

  // ─── Notifications ───
  app.get("/api/users/:id/notifications", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getNotificationsByUser(id));
  });

  app.post("/api/notifications/:id/read", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const notif = storage.getNotification(paramId(req));
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    if (me.role !== "admin" && notif.userId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    storage.markNotificationRead(notif.id);
    res.json({ success: true });
  });

  // ─── Ratings ───
  app.get("/api/properties/:id/ratings", (req, res) => {
    res.json(storage.getRatingsByProperty(paramId(req)));
  });

  app.get("/api/owners/:id/ratings", (req, res) => {
    res.json(storage.getRatingsByOwner(paramId(req)));
  });

  app.get("/api/guests/:id/ratings", (req, res) => {
    res.json(storage.getRatingsByGuest(paramId(req)));
  });

  app.get("/api/bookings/:id/rating", (req, res) => {
    const rating = storage.getRatingByBooking(paramId(req));
    res.json(rating || null);
  });

  app.post("/api/bookings/:id/rate", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const bookingId = paramId(req);
    const booking = storage.getBooking(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.guestId !== me.id) {
      return res.status(403).json({ message: "Only the booking guest can rate this stay" });
    }

    // Check if already rated
    const existing = storage.getRatingByBooking(bookingId);
    if (existing) return res.status(400).json({ message: "Booking already rated" });

    const { overallScore, cleanlinessScore, communicationScore, valueScore } = req.body ?? {};
    for (const [label, s] of Object.entries({ overallScore, cleanlinessScore, communicationScore, valueScore })) {
      if (!validScore(s)) return res.status(400).json({ message: `${label} must be an integer from 1 to 5` });
    }

    const parsed = insertRatingSchema.safeParse({
      ...req.body,
      bookingId,
      guestId: booking.guestId,
      propertyId: booking.propertyId,
      ownerId: booking.ownerId,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const rating = storage.createRating(parsed.data);

    // Generate a discount coupon as a reward
    const code = `STAY${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);
    const coupon = storage.createCoupon({
      guestId: booking.guestId,
      ratingId: rating.id,
      code,
      discountPercent: 10,
      status: "active",
      expiresAt: expiresAt.toISOString().split("T")[0],
    });

    // Notify the owner about the review
    const guest = storage.getUser(booking.guestId);
    storage.createNotification({
      userId: booking.ownerId,
      type: "bid_accepted",
      message: `${guest?.name || "Guest"} left a ${rating.overallScore}-star review on your property`,
      read: 0,
    });

    res.status(201).json({ rating, coupon });
  });

  // ─── Coupons ───
  app.get("/api/guests/:id/coupons", requireAuth, (req, res) => {
    const id = paramId(req);
    if (!selfOrAdmin(req, id)) return res.status(403).json({ message: "Forbidden" });
    res.json(storage.getCouponsByGuest(id));
  });

  // ─── Guest Ratings (owner rates guest) ───
  app.get("/api/bookings/:id/guest-rating", (req, res) => {
    const rating = storage.getGuestRatingByBooking(paramId(req));
    res.json(rating || null);
  });

  app.get("/api/guests/:id/guest-ratings", (req, res) => {
    res.json(storage.getGuestRatingsByGuest(paramId(req)));
  });

  app.get("/api/owners/:id/guest-ratings", (req, res) => {
    res.json(storage.getGuestRatingsByOwner(paramId(req)));
  });

  app.post("/api/bookings/:id/rate-guest", requireAuth, (req, res) => {
    const me = currentUser(req)!;
    const bookingId = paramId(req);
    const booking = storage.getBooking(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.ownerId !== me.id) {
      return res.status(403).json({ message: "Only the booking host can rate this guest" });
    }

    const existing = storage.getGuestRatingByBooking(bookingId);
    if (existing) return res.status(400).json({ message: "Guest already rated" });

    const { overallScore, cleanlinessScore, communicationScore, respectScore } = req.body ?? {};
    for (const [label, s] of Object.entries({ overallScore, cleanlinessScore, communicationScore, respectScore })) {
      if (!validScore(s)) return res.status(400).json({ message: `${label} must be an integer from 1 to 5` });
    }

    const parsed = insertGuestRatingSchema.safeParse({
      ...req.body,
      bookingId,
      ownerId: booking.ownerId,
      guestId: booking.guestId,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const rating = storage.createGuestRating(parsed.data);
    const owner = storage.getUser(booking.ownerId);
    storage.createNotification({
      userId: booking.guestId,
      type: "bid_accepted",
      message: `${owner?.name || "Your host"} left you a ${rating.overallScore}-star review`,
      read: 0,
    });

    res.status(201).json(rating);
  });

  // ─── Dashboard Stats ───
  app.get("/api/owners/:id/stats", requireAuth, (req, res) => {
    const ownerId = paramId(req);
    if (!selfOrAdmin(req, ownerId)) return res.status(403).json({ message: "Forbidden" });
    const ownerProps = storage.getPropertiesByOwner(ownerId);
    const ownerBookings = storage.getBookingsByOwner(ownerId);
    const ledger = storage.getLedgerByOwner(ownerId);
    const income = ledger.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expenses = ledger.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const activeBids = storage.getBidsByOwner(ownerId).filter(b => b.status === "pending");
    res.json({
      totalProperties: ownerProps.length,
      totalBookings: ownerBookings.length,
      upcomingBookings: ownerBookings.filter(b => b.status === "upcoming").length,
      totalRevenue: income,
      totalExpenses: expenses,
      netProfit: income - expenses,
      activeBids: activeBids.length,
    });
  });

  app.get("/api/guests/:id/stats", requireAuth, (req, res) => {
    const guestId = paramId(req);
    if (!selfOrAdmin(req, guestId)) return res.status(403).json({ message: "Forbidden" });
    const trips = storage.getTripRequestsByGuest(guestId);
    const guestBookings = storage.getBookingsByGuest(guestId);
    const paymentsList = storage.getPaymentsByGuest(guestId);
    const coupons = storage.getCouponsByGuest(guestId);
    const activeCoupons = coupons.filter(c => c.status === "active");
    res.json({
      activeTrips: trips.filter(t => t.status === "active").length,
      totalBookings: guestBookings.length,
      upcomingBookings: guestBookings.filter(b => b.status === "upcoming").length,
      totalPaid: paymentsList.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0),
      totalPending: paymentsList.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0),
      activeCoupons: activeCoupons.length,
      totalRatings: storage.getRatingsByGuest(guestId).length,
    });
  });

  return httpServer;
}
