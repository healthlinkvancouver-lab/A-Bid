import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

// ─── Users ───
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // bcrypt hash; null only for legacy seed rows until migrated
  role: text("role").notNull().default("guest"), // guest | owner | admin
  phone: text("phone"),
  avatar: text("avatar"),
  stripeAccountId: text("stripe_account_id"), // owner Connect account id (P0-4)
  stripeOnboardingComplete: integer("stripe_onboarding_complete").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// ─── Properties ───
export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  bedrooms: integer("bedrooms").notNull().default(1),
  bathrooms: integer("bathrooms").notNull().default(1),
  maxGuests: integer("max_guests").notNull().default(2),
  nightlyRate: real("nightly_rate").notNull(),
  images: text("images").notNull().default("[]"), // JSON array of URLs
  amenities: text("amenities").notNull().default("[]"), // JSON array
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
});

// ─── Trip Requests (Guest posts budget → all owners see it) ───
export const tripRequests = sqliteTable("trip_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guestId: integer("guest_id").notNull(),
  city: text("city").notNull(),
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out").notNull(),
  guests: integer("guests").notNull().default(2),
  bedroomsNeeded: integer("bedrooms_needed").notNull().default(1),
  budgetTotal: real("budget_total").notNull(),
  budgetPerNight: real("budget_per_night").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("active"), // active | closed
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertTripRequestSchema = createInsertSchema(tripRequests).omit({
  id: true,
  createdAt: true,
});

// ─── Bids (Owners bid on guest's trip request) ───
export const bids = sqliteTable("bids", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripRequestId: integer("trip_request_id").notNull(),
  propertyId: integer("property_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  pricePerNight: real("price_per_night").notNull(),
  totalPrice: real("total_price").notNull(),
  message: text("message"),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected | expired
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertBidSchema = createInsertSchema(bids).omit({
  id: true,
  createdAt: true,
});

// ─── Bookings ───
export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bidId: integer("bid_id").notNull(),
  tripRequestId: integer("trip_request_id").notNull(),
  propertyId: integer("property_id").notNull(),
  guestId: integer("guest_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out").notNull(),
  totalPrice: real("total_price").notNull(),
  damageDeposit: real("damage_deposit").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming | active | completed | cancelled
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
});

// ─── Payment Plans (installments for paying over time) ───
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: integer("booking_id").notNull(),
  guestId: integer("guest_id").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull().default("installment"), // deposit | installment | final
  status: text("status").notNull().default("pending"), // pending | paid | failed
  dueDate: text("due_date").notNull(),
  paidDate: text("paid_date"),
  stripePaymentIntentId: text("stripe_payment_intent_id"), // set when a Stripe PI is created (P0-4)
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

// ─── Ledger Entries (Owner accounting) ───
export const ledgerEntries = sqliteTable("ledger_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id").notNull(),
  bookingId: integer("booking_id"),
  type: text("type").notNull(), // income | expense
  category: text("category").notNull(), // booking_revenue | cleaning | maintenance | taxes | insurance | other
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntries).omit({
  id: true,
  createdAt: true,
});

// ─── Notifications ───
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // bid_received | bid_accepted | bid_rejected | booking_confirmed | payment_due | payment_received | new_request
  message: text("message").notNull(),
  read: integer("read").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// ─── Ratings (Guest reviews their stay after checkout) ───
export const ratings = sqliteTable("ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: integer("booking_id").notNull(),
  guestId: integer("guest_id").notNull(),
  propertyId: integer("property_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  overallScore: integer("overall_score").notNull(), // 1-5
  cleanlinessScore: integer("cleanliness_score").notNull(),
  communicationScore: integer("communication_score").notNull(),
  valueScore: integer("value_score").notNull(),
  review: text("review"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
});

// ─── Discount Coupons (Earned by leaving ratings) ───
export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guestId: integer("guest_id").notNull(),
  ratingId: integer("rating_id"),
  code: text("code").notNull().unique(),
  discountPercent: integer("discount_percent").notNull().default(10),
  status: text("status").notNull().default("active"), // active | used | expired
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
});

// ─── Guest Ratings (Owners rate guests after checkout) ───
export const guestRatings = sqliteTable("guest_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: integer("booking_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  guestId: integer("guest_id").notNull(),
  overallScore: integer("overall_score").notNull(), // 1-5
  cleanlinessScore: integer("cleanliness_score").notNull(),
  communicationScore: integer("communication_score").notNull(),
  respectScore: integer("respect_score").notNull(),
  review: text("review"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertGuestRatingSchema = createInsertSchema(guestRatings).omit({
  id: true,
  createdAt: true,
});

// ─── Types ───
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type TripRequest = typeof tripRequests.$inferSelect;
export type InsertTripRequest = z.infer<typeof insertTripRequestSchema>;
export type Bid = typeof bids.$inferSelect;
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type GuestRating = typeof guestRatings.$inferSelect;
export type InsertGuestRating = z.infer<typeof insertGuestRatingSchema>;
