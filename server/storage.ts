import {
  users, properties, tripRequests, bids, bookings, payments, ledgerEntries, notifications, ratings, coupons, guestRatings,
  type User, type InsertUser,
  type Property, type InsertProperty,
  type TripRequest, type InsertTripRequest,
  type Bid, type InsertBid,
  type Booking, type InsertBooking,
  type Payment, type InsertPayment,
  type LedgerEntry, type InsertLedgerEntry,
  type Notification, type InsertNotification,
  type Rating, type InsertRating,
  type Coupon, type InsertCoupon,
  type GuestRating, type InsertGuestRating,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { eq, and, ne, sql } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

// ─── Schema bootstrap ───
// The prototype has no migration runner; tables were originally created with
// drizzle-kit push. On a fresh database (e.g. an ephemeral host filesystem) no
// tables exist at boot, so create them here first — IF NOT EXISTS keeps this a
// no-op for existing data.db files. DDL mirrors `npm run db:push` output for
// shared/schema.ts (as dumped from a known-good data.db); the column additions
// in runMigrations() below are applied afterwards as before.
const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS \`bids\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`trip_request_id\` integer NOT NULL,
	\`property_id\` integer NOT NULL,
	\`owner_id\` integer NOT NULL,
	\`price_per_night\` real NOT NULL,
	\`total_price\` real NOT NULL,
	\`message\` text,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`bookings\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`bid_id\` integer NOT NULL,
	\`trip_request_id\` integer NOT NULL,
	\`property_id\` integer NOT NULL,
	\`guest_id\` integer NOT NULL,
	\`owner_id\` integer NOT NULL,
	\`check_in\` text NOT NULL,
	\`check_out\` text NOT NULL,
	\`total_price\` real NOT NULL,
	\`damage_deposit\` real NOT NULL,
	\`status\` text DEFAULT 'upcoming' NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`coupons\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`guest_id\` integer NOT NULL,
	\`rating_id\` integer,
	\`code\` text NOT NULL,
	\`discount_percent\` integer DEFAULT 10 NOT NULL,
	\`status\` text DEFAULT 'active' NOT NULL,
	\`expires_at\` text NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS \`coupons_code_unique\` ON \`coupons\` (\`code\`);
CREATE TABLE IF NOT EXISTS \`guest_ratings\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`booking_id\` integer NOT NULL,
	\`owner_id\` integer NOT NULL,
	\`guest_id\` integer NOT NULL,
	\`overall_score\` integer NOT NULL,
	\`cleanliness_score\` integer NOT NULL,
	\`communication_score\` integer NOT NULL,
	\`respect_score\` integer NOT NULL,
	\`review\` text,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`ledger_entries\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`owner_id\` integer NOT NULL,
	\`booking_id\` integer,
	\`type\` text NOT NULL,
	\`category\` text NOT NULL,
	\`amount\` real NOT NULL,
	\`description\` text NOT NULL,
	\`date\` text NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`notifications\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`user_id\` integer NOT NULL,
	\`type\` text NOT NULL,
	\`message\` text NOT NULL,
	\`read\` integer DEFAULT 0 NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`payments\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`booking_id\` integer NOT NULL,
	\`guest_id\` integer NOT NULL,
	\`amount\` real NOT NULL,
	\`type\` text DEFAULT 'installment' NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`due_date\` text NOT NULL,
	\`paid_date\` text,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`properties\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`owner_id\` integer NOT NULL,
	\`title\` text NOT NULL,
	\`description\` text NOT NULL,
	\`address\` text NOT NULL,
	\`city\` text NOT NULL,
	\`bedrooms\` integer DEFAULT 1 NOT NULL,
	\`bathrooms\` integer DEFAULT 1 NOT NULL,
	\`max_guests\` integer DEFAULT 2 NOT NULL,
	\`nightly_rate\` real NOT NULL,
	\`images\` text DEFAULT '[]' NOT NULL,
	\`amenities\` text DEFAULT '[]' NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`ratings\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`booking_id\` integer NOT NULL,
	\`guest_id\` integer NOT NULL,
	\`property_id\` integer NOT NULL,
	\`owner_id\` integer NOT NULL,
	\`overall_score\` integer NOT NULL,
	\`cleanliness_score\` integer NOT NULL,
	\`communication_score\` integer NOT NULL,
	\`value_score\` integer NOT NULL,
	\`review\` text,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`trip_requests\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`guest_id\` integer NOT NULL,
	\`city\` text NOT NULL,
	\`check_in\` text NOT NULL,
	\`check_out\` text NOT NULL,
	\`guests\` integer DEFAULT 2 NOT NULL,
	\`bedrooms_needed\` integer DEFAULT 1 NOT NULL,
	\`budget_total\` real NOT NULL,
	\`budget_per_night\` real NOT NULL,
	\`notes\` text,
	\`status\` text DEFAULT 'active' NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`users\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`name\` text NOT NULL,
	\`email\` text NOT NULL,
	\`role\` text DEFAULT 'guest' NOT NULL,
	\`phone\` text,
	\`avatar\` text,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS \`users_email_unique\` ON \`users\` (\`email\`);
`;

function ensureSchema() {
  sqlite.exec(SCHEMA_DDL);
}
ensureSchema();

// ─── Lightweight startup migrations ───
// New columns are added idempotently here so existing data.db files keep working.
function columnExists(table: string, column: string): boolean {
  const info = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return info.some((c) => c.name === column);
}

function runMigrations() {
  const additions: [string, string, string][] = [
    ["users", "password_hash", "TEXT"],
    ["users", "stripe_account_id", "TEXT"],
    ["users", "stripe_onboarding_complete", "INTEGER NOT NULL DEFAULT 0"],
    ["payments", "stripe_payment_intent_id", "TEXT"],
  ];
  for (const [table, column, ddl] of additions) {
    if (!columnExists(table, column)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
      console.log(`[migrate] added ${table}.${column}`);
    }
  }
}
runMigrations();

export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getUsersByRole(role: string): User[];
  createUser(user: InsertUser): User;
  updateUser(id: number, patch: Partial<User>): User | undefined;
  // Properties
  getProperty(id: number): Property | undefined;
  getPropertiesByOwner(ownerId: number): Property[];
  getAllProperties(): Property[];
  createProperty(prop: InsertProperty): Property;
  // Trip Requests
  getTripRequest(id: number): TripRequest | undefined;
  getActiveTripRequests(): TripRequest[];
  getTripRequestsByGuest(guestId: number): TripRequest[];
  createTripRequest(req: InsertTripRequest): TripRequest;
  updateTripRequestStatus(id: number, status: string): void;
  // Bids
  getBid(id: number): Bid | undefined;
  getBidsByTripRequest(tripRequestId: number): Bid[];
  getBidsByOwner(ownerId: number): Bid[];
  createBid(bid: InsertBid): Bid;
  updateBidStatus(id: number, status: string): void;
  // Bookings
  getBooking(id: number): Booking | undefined;
  getBookingsByGuest(guestId: number): Booking[];
  getBookingsByOwner(ownerId: number): Booking[];
  getAllBookings(): Booking[];
  createBooking(booking: InsertBooking): Booking;
  updateBookingStatus(id: number, status: string): void;
  // Payments
  getPaymentsByBooking(bookingId: number): Payment[];
  getPaymentsByGuest(guestId: number): Payment[];
  getPayment(id: number): Payment | undefined;
  getPaymentByStripeIntent(intentId: string): Payment | undefined;
  createPayment(payment: InsertPayment): Payment;
  updatePaymentStatus(id: number, status: string, paidDate?: string): void;
  setPaymentStripeIntent(id: number, intentId: string): void;
  // Ledger
  getLedgerByOwner(ownerId: number): LedgerEntry[];
  createLedgerEntry(entry: InsertLedgerEntry): LedgerEntry;
  // Notifications
  getNotification(id: number): Notification | undefined;
  getNotificationsByUser(userId: number): Notification[];
  createNotification(notif: InsertNotification): Notification;
  markNotificationRead(id: number): void;
  // Ratings
  getRating(id: number): Rating | undefined;
  getRatingsByProperty(propertyId: number): Rating[];
  getRatingsByOwner(ownerId: number): Rating[];
  getRatingsByGuest(guestId: number): Rating[];
  getRatingByBooking(bookingId: number): Rating | undefined;
  createRating(rating: InsertRating): Rating;
  // Coupons
  getCouponsByGuest(guestId: number): Coupon[];
  createCoupon(coupon: InsertCoupon): Coupon;
  updateCouponStatus(id: number, status: string): void;
  // Guest Ratings (owner rates guest)
  getGuestRatingByBooking(bookingId: number): GuestRating | undefined;
  getGuestRatingsByGuest(guestId: number): GuestRating[];
  getGuestRatingsByOwner(ownerId: number): GuestRating[];
  createGuestRating(rating: InsertGuestRating): GuestRating;
}

export class DatabaseStorage implements IStorage {
  // ─── Users ───
  getUser(id: number) { return db.select().from(users).where(eq(users.id, id)).get(); }
  getUserByEmail(email: string) { return db.select().from(users).where(eq(users.email, email)).get(); }
  getUsersByRole(role: string) { return db.select().from(users).where(eq(users.role, role)).all(); }
  createUser(data: InsertUser) { return db.insert(users).values(data).returning().get(); }
  updateUser(id: number, patch: Partial<User>) {
    const { id: _omit, ...rest } = patch;
    db.update(users).set(rest).where(eq(users.id, id)).run();
    return this.getUser(id);
  }

  // ─── Properties ───
  getProperty(id: number) { return db.select().from(properties).where(eq(properties.id, id)).get(); }
  getPropertiesByOwner(ownerId: number) { return db.select().from(properties).where(eq(properties.ownerId, ownerId)).all(); }
  getAllProperties() { return db.select().from(properties).all(); }
  createProperty(data: InsertProperty) { return db.insert(properties).values(data).returning().get(); }

  // ─── Trip Requests ───
  getTripRequest(id: number) { return db.select().from(tripRequests).where(eq(tripRequests.id, id)).get(); }
  getActiveTripRequests() { return db.select().from(tripRequests).where(eq(tripRequests.status, "active")).all(); }
  getTripRequestsByGuest(guestId: number) { return db.select().from(tripRequests).where(eq(tripRequests.guestId, guestId)).all(); }
  createTripRequest(data: InsertTripRequest) { return db.insert(tripRequests).values(data).returning().get(); }
  updateTripRequestStatus(id: number, status: string) {
    db.update(tripRequests).set({ status }).where(eq(tripRequests.id, id)).run();
  }

  // ─── Bids ───
  getBid(id: number) { return db.select().from(bids).where(eq(bids.id, id)).get(); }
  getBidsByTripRequest(tripRequestId: number) { return db.select().from(bids).where(eq(bids.tripRequestId, tripRequestId)).all(); }
  getBidsByOwner(ownerId: number) { return db.select().from(bids).where(eq(bids.ownerId, ownerId)).all(); }
  createBid(data: InsertBid) { return db.insert(bids).values(data).returning().get(); }
  updateBidStatus(id: number, status: string) {
    db.update(bids).set({ status }).where(eq(bids.id, id)).run();
  }

  // ─── Bookings ───
  getBooking(id: number) { return db.select().from(bookings).where(eq(bookings.id, id)).get(); }
  getBookingsByGuest(guestId: number) { return db.select().from(bookings).where(eq(bookings.guestId, guestId)).all(); }
  getBookingsByOwner(ownerId: number) { return db.select().from(bookings).where(eq(bookings.ownerId, ownerId)).all(); }
  getAllBookings() { return db.select().from(bookings).all(); }
  createBooking(data: InsertBooking) { return db.insert(bookings).values(data).returning().get(); }
  updateBookingStatus(id: number, status: string) {
    db.update(bookings).set({ status }).where(eq(bookings.id, id)).run();
  }

  // ─── Payments ───
  getPaymentsByBooking(bookingId: number) { return db.select().from(payments).where(eq(payments.bookingId, bookingId)).all(); }
  getPaymentsByGuest(guestId: number) { return db.select().from(payments).where(eq(payments.guestId, guestId)).all(); }
  getPayment(id: number) { return db.select().from(payments).where(eq(payments.id, id)).get(); }
  getPaymentByStripeIntent(intentId: string) {
    return db.select().from(payments).where(eq(payments.stripePaymentIntentId, intentId)).get();
  }
  createPayment(data: InsertPayment) { return db.insert(payments).values(data).returning().get(); }
  updatePaymentStatus(id: number, status: string, paidDate?: string) {
    const update = paidDate ? { status, paidDate } : { status };
    db.update(payments).set(update).where(eq(payments.id, id)).run();
  }
  setPaymentStripeIntent(id: number, intentId: string) {
    db.update(payments).set({ stripePaymentIntentId: intentId }).where(eq(payments.id, id)).run();
  }

  // ─── Ledger ───
  getLedgerByOwner(ownerId: number) { return db.select().from(ledgerEntries).where(eq(ledgerEntries.ownerId, ownerId)).all(); }
  createLedgerEntry(data: InsertLedgerEntry) { return db.insert(ledgerEntries).values(data).returning().get(); }

  // ─── Notifications ───
  getNotification(id: number) { return db.select().from(notifications).where(eq(notifications.id, id)).get(); }
  getNotificationsByUser(userId: number) { return db.select().from(notifications).where(eq(notifications.userId, userId)).all(); }
  createNotification(data: InsertNotification) { return db.insert(notifications).values(data).returning().get(); }
  markNotificationRead(id: number) {
    db.update(notifications).set({ read: 1 }).where(eq(notifications.id, id)).run();
  }

  // ─── Ratings ───
  getRating(id: number) { return db.select().from(ratings).where(eq(ratings.id, id)).get(); }
  getRatingsByProperty(propertyId: number) { return db.select().from(ratings).where(eq(ratings.propertyId, propertyId)).all(); }
  getRatingsByOwner(ownerId: number) { return db.select().from(ratings).where(eq(ratings.ownerId, ownerId)).all(); }
  getRatingsByGuest(guestId: number) { return db.select().from(ratings).where(eq(ratings.guestId, guestId)).all(); }
  getRatingByBooking(bookingId: number) { return db.select().from(ratings).where(eq(ratings.bookingId, bookingId)).get(); }
  createRating(data: InsertRating) { return db.insert(ratings).values(data).returning().get(); }

  // ─── Coupons ───
  getCouponsByGuest(guestId: number) { return db.select().from(coupons).where(eq(coupons.guestId, guestId)).all(); }
  createCoupon(data: InsertCoupon) { return db.insert(coupons).values(data).returning().get(); }
  updateCouponStatus(id: number, status: string) {
    db.update(coupons).set({ status }).where(eq(coupons.id, id)).run();
  }

  // ─── Guest Ratings (owner rates guest) ───
  getGuestRatingByBooking(bookingId: number) { return db.select().from(guestRatings).where(eq(guestRatings.bookingId, bookingId)).get(); }
  getGuestRatingsByGuest(guestId: number) { return db.select().from(guestRatings).where(eq(guestRatings.guestId, guestId)).all(); }
  getGuestRatingsByOwner(ownerId: number) { return db.select().from(guestRatings).where(eq(guestRatings.ownerId, ownerId)).all(); }
  createGuestRating(data: InsertGuestRating) { return db.insert(guestRatings).values(data).returning().get(); }
}

export const storage = new DatabaseStorage();

// ─── Seed Data ───
// Documented demo password for all seeded accounts (see README.md).
export const DEMO_PASSWORD = "abid-demo-2026";

export function seedDatabase() {
  const existingUsers = storage.getUsersByRole("admin");
  if (existingUsers.length > 0) {
    // Backfill password hashes for seed rows created before auth existed.
    const demoHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
    for (const u of storage.getUsersByRole("guest")
      .concat(storage.getUsersByRole("owner"), existingUsers)) {
      if (!u.passwordHash) storage.updateUser(u.id, { passwordHash: demoHash });
    }
    return;
  }
  const demoHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // Create demo users
  const sarahGuest = storage.createUser({
    name: "Sarah Chen", email: "sarah@example.com", role: "guest", passwordHash: demoHash, phone: "+1-604-555-0142",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
  });
  const mikeGuest = storage.createUser({
    name: "Mike Torres", email: "mike@example.com", role: "guest", passwordHash: demoHash, phone: "+1-604-555-0198",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike",
  });
  const owner1 = storage.createUser({
    name: "Jennifer Walsh", email: "jen@example.com", role: "owner", passwordHash: demoHash, phone: "+1-604-555-0201",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jen",
  });
  const owner2 = storage.createUser({
    name: "David Kim", email: "david@example.com", role: "owner", passwordHash: demoHash, phone: "+1-604-555-0233",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
  });
  const owner3 = storage.createUser({
    name: "Maria Santos", email: "maria@example.com", role: "owner", passwordHash: demoHash, phone: "+1-604-555-0277",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=maria",
  });
  const admin = storage.createUser({
    name: "Admin", email: "admin@example.com", role: "admin", passwordHash: demoHash, phone: "+1-604-555-0100",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
  });

  // Create properties
  const prop1 = storage.createProperty({
    ownerId: owner1.id, title: "Downtown Loft with City Views",
    description: "Modern loft in the heart of downtown. Floor-to-ceiling windows, fully equipped kitchen, and walking distance to everything.",
    address: "456 Homer St", city: "Vancouver", bedrooms: 1, bathrooms: 1, maxGuests: 2,
    nightlyRate: 185,
    images: JSON.stringify(["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80"]),
    amenities: JSON.stringify(["WiFi", "Kitchen", "Parking", "AC", "Washer"]),
  });
  const prop2 = storage.createProperty({
    ownerId: owner2.id, title: "Cozy Kitsilano Beach Suite",
    description: "Bright suite steps from Kitsilano Beach. Open-concept living, private entrance, garden patio.",
    address: "1234 Yew St", city: "Vancouver", bedrooms: 2, bathrooms: 1, maxGuests: 4,
    nightlyRate: 220,
    images: JSON.stringify(["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80"]),
    amenities: JSON.stringify(["WiFi", "Kitchen", "Patio", "Parking", "AC", "TV"]),
  });
  const prop3 = storage.createProperty({
    ownerId: owner3.id, title: "Gastown Heritage Studio",
    description: "Charming heritage studio in historic Gastown. Exposed brick, original beams, modern amenities.",
    address: "88 Water St", city: "Vancouver", bedrooms: 1, bathrooms: 1, maxGuests: 2,
    nightlyRate: 165,
    images: JSON.stringify(["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80"]),
    amenities: JSON.stringify(["WiFi", "Kitchen", "AC", "TV"]),
  });
  const prop4 = storage.createProperty({
    ownerId: owner1.id, title: "North Shore Mountain View House",
    description: "Spacious family home with panoramic mountain views. Large deck, BBQ, and games room.",
    address: "789 Harbourside Dr", city: "North Vancouver", bedrooms: 3, bathrooms: 2, maxGuests: 6,
    nightlyRate: 310,
    images: JSON.stringify(["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80"]),
    amenities: JSON.stringify(["WiFi", "Kitchen", "Parking", "AC", "Washer", "BBQ", "Fireplace"]),
  });
  const prop5 = storage.createProperty({
    ownerId: owner2.id, title: "Yaletown Modern Condo",
    description: "Sleek downtown condo near the seawall. Building has gym, pool, and hot tub. Walk to restaurants.",
    address: "321 Davie St", city: "Vancouver", bedrooms: 2, bathrooms: 2, maxGuests: 4,
    nightlyRate: 245,
    images: JSON.stringify(["https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80"]),
    amenities: JSON.stringify(["WiFi", "Kitchen", "Gym", "Pool", "Parking", "AC", "TV"]),
  });

  // Create an active trip request
  const trip1 = storage.createTripRequest({
    guestId: sarahGuest.id, city: "Vancouver",
    checkIn: "2026-10-15", checkOut: "2026-10-18", guests: 2, bedroomsNeeded: 1,
    budgetTotal: 500, budgetPerNight: 167,
    notes: "Looking for something walkable to downtown. Need a clean, modern space for a weekend getaway.",
    status: "active",
  });

  // Create bids for the trip request
  const bid1 = storage.createBid({
    tripRequestId: trip1.id, propertyId: prop1.id, ownerId: owner1.id,
    pricePerNight: 155, totalPrice: 465,
    message: "I can offer my downtown loft at $155/night — below your budget! It's perfectly located for a weekend getaway.",
    status: "pending",
  });
  const bid2 = storage.createBid({
    tripRequestId: trip1.id, propertyId: prop3.id, ownerId: owner3.id,
    pricePerNight: 145, totalPrice: 435,
    message: "My Gastown studio at $145/night fits your budget perfectly. Exposed brick, very charming for a couples weekend.",
    status: "pending",
  });
  const bid3 = storage.createBid({
    tripRequestId: trip1.id, propertyId: prop2.id, ownerId: owner2.id,
    pricePerNight: 180, totalPrice: 540,
    message: "Beach suite at $180/night — slightly above your budget but includes free parking and is steps from the ocean.",
    status: "pending",
  });

  // Create a completed booking with payment plan
  const completedBid = storage.createBid({
    tripRequestId: 0, propertyId: prop4.id, ownerId: owner1.id,
    pricePerNight: 280, totalPrice: 840,
    message: "Weekend mountain retreat", status: "accepted",
  });
  const booking1 = storage.createBooking({
    bidId: completedBid.id, tripRequestId: 0, propertyId: prop4.id,
    guestId: mikeGuest.id, ownerId: owner1.id,
    checkIn: "2026-09-05", checkOut: "2026-09-08",
    totalPrice: 840, damageDeposit: 200, status: "upcoming",
  });

  // Payment plan for booking1
  const today = new Date();
  const paymentDates = [
    { due: new Date(today.getTime() - 14 * 86400000).toISOString().split("T")[0], status: "paid", type: "deposit", amount: 200 },
    { due: new Date(today.getTime() - 7 * 86400000).toISOString().split("T")[0], status: "paid", type: "installment", amount: 320 },
    { due: new Date(today.getTime() + 3 * 86400000).toISOString().split("T")[0], status: "pending", type: "final", amount: 520 },
  ];
  paymentDates.forEach(p => {
    storage.createPayment({
      bookingId: booking1.id, guestId: mikeGuest.id,
      amount: p.amount, type: p.type, status: p.status,
      dueDate: p.due,
      paidDate: p.status === "paid" ? p.due : null,
    });
  });

  // Ledger entries for owner1
  storage.createLedgerEntry({ ownerId: owner1.id, bookingId: booking1.id, type: "income", category: "booking_revenue", amount: 520, description: "Booking #1 — North Shore House deposit + installment", date: paymentDates[0].due });
  storage.createLedgerEntry({ ownerId: owner1.id, bookingId: booking1.id, type: "expense", category: "cleaning", amount: 85, description: "Deep clean — North Shore House", date: today.toISOString().split("T")[0] });
  storage.createLedgerEntry({ ownerId: owner1.id, bookingId: booking1.id, type: "expense", category: "maintenance", amount: 150, description: "Plumbing repair — kitchen faucet", date: new Date(today.getTime() - 3 * 86400000).toISOString().split("T")[0] });
  storage.createLedgerEntry({ ownerId: owner1.id, bookingId: booking1.id, type: "income", category: "booking_revenue", amount: 465, description: "Booking #2 — Downtown Loft (Oct 15-18)", date: "2026-10-15" });
  storage.createLedgerEntry({ ownerId: owner1.id, type: "expense", category: "insurance", amount: 120, description: "Monthly property insurance", date: new Date(today.getTime() - 10 * 86400000).toISOString().split("T")[0] });
  storage.createLedgerEntry({ ownerId: owner1.id, type: "expense", category: "taxes", amount: 95, description: "Municipal accommodation tax (Sept)", date: new Date(today.getTime() - 5 * 86400000).toISOString().split("T")[0] });

  // Ledger entries for owner2
  storage.createLedgerEntry({ ownerId: owner2.id, type: "income", category: "booking_revenue", amount: 540, description: "Booking — Kitsilano Beach Suite", date: "2026-09-20" });
  storage.createLedgerEntry({ ownerId: owner2.id, type: "expense", category: "cleaning", amount: 65, description: "Turnover clean — Kitsilano suite", date: "2026-09-21" });
  storage.createLedgerEntry({ ownerId: owner2.id, type: "income", category: "booking_revenue", amount: 735, description: "Booking — Yaletown Condo (3 nights)", date: "2026-09-28" });
  storage.createLedgerEntry({ ownerId: owner2.id, type: "expense", category: "maintenance", amount: 200, description: "Replace dishwasher — Yaletown condo", date: "2026-09-15" });

  // Notifications
  storage.createNotification({ userId: sarahGuest.id, type: "bid_received", message: "Jennifer Walsh bid $155/night on your Vancouver trip request", read: 0 });
  storage.createNotification({ userId: sarahGuest.id, type: "bid_received", message: "Maria Santos bid $145/night on your Vancouver trip request", read: 0 });
  storage.createNotification({ userId: sarahGuest.id, type: "bid_received", message: "David Kim bid $180/night on your Vancouver trip request", read: 1 });
  storage.createNotification({ userId: owner1.id, type: "new_request", message: "New trip request from Sarah Chen: Vancouver, Oct 15-18, budget $500", read: 0 });
  storage.createNotification({ userId: owner2.id, type: "new_request", message: "New trip request from Sarah Chen: Vancouver, Oct 15-18, budget $500", read: 0 });
  storage.createNotification({ userId: owner3.id, type: "new_request", message: "New trip request from Sarah Chen: Vancouver, Oct 15-18, budget $500", read: 0 });
  storage.createNotification({ userId: owner1.id, type: "payment_received", message: "Payment of $320 received for North Shore Mountain View House", read: 1 });
  storage.createNotification({ userId: mikeGuest.id, type: "payment_due", message: "Final payment of $520 due in 3 days for North Shore Mountain View House", read: 0 });

  // Past completed booking with rating + coupon for demo
  const pastBid = storage.createBid({
    tripRequestId: 0, propertyId: prop5.id, ownerId: owner2.id,
    pricePerNight: 220, totalPrice: 660,
    message: "Yaletown condo weekend", status: "accepted",
  });
  const pastBooking = storage.createBooking({
    bidId: pastBid.id, tripRequestId: 0, propertyId: prop5.id,
    guestId: mikeGuest.id, ownerId: owner2.id,
    checkIn: "2026-08-10", checkOut: "2026-08-13",
    totalPrice: 660, damageDeposit: 132, status: "completed",
  });
  ["2026-07-10", "2026-07-27", "2026-08-09"].forEach((due, i) => {
    const amounts = [132, 264, 396];
    const types = ["deposit", "installment", "final"];
    storage.createPayment({
      bookingId: pastBooking.id, guestId: mikeGuest.id,
      amount: amounts[i], type: types[i], status: "paid",
      dueDate: due, paidDate: due,
    });
  });
  // Guest rating (guest rates property/owner)
  const pastRating = storage.createRating({
    bookingId: pastBooking.id, guestId: mikeGuest.id,
    propertyId: prop5.id, ownerId: owner2.id,
    overallScore: 5, cleanlinessScore: 5, communicationScore: 4, valueScore: 5,
    review: "Amazing stay! The condo was spotless and had incredible views. David was a great host.",
  });
  // Coupon earned from that rating
  storage.createCoupon({
    guestId: mikeGuest.id, ratingId: pastRating.id,
    code: "STAYVIP10", discountPercent: 10, status: "active",
    expiresAt: "2026-12-15",
  });
  // Owner-to-guest rating (owner rates guest)
  storage.createGuestRating({
    bookingId: pastBooking.id, ownerId: owner2.id, guestId: mikeGuest.id,
    overallScore: 5, cleanlinessScore: 5, communicationScore: 5, respectScore: 5,
    review: "Mike was an excellent guest. Left the place spotless and communicated clearly throughout.",
  });

  // ── Sarah Chen completed booking (so guest #1 sees the full demo experience) ──
  const sarahBid = storage.createBid({
    tripRequestId: 0, propertyId: prop1.id, ownerId: owner1.id,
    pricePerNight: 160, totalPrice: 480,
    message: "Downtown loft weekend", status: "accepted",
  });
  const sarahBooking = storage.createBooking({
    bidId: sarahBid.id, tripRequestId: 0, propertyId: prop1.id,
    guestId: sarahGuest.id, ownerId: owner1.id,
    checkIn: "2026-08-20", checkOut: "2026-08-23",
    totalPrice: 480, damageDeposit: 96, status: "completed",
  });
  ["2026-07-20", "2026-08-05", "2026-08-19"].forEach((due, i) => {
    const amounts = [96, 192, 288];
    const types = ["deposit", "installment", "final"];
    storage.createPayment({
      bookingId: sarahBooking.id, guestId: sarahGuest.id,
      amount: amounts[i], type: types[i], status: "paid",
      dueDate: due, paidDate: due,
    });
  });
  const sarahRating = storage.createRating({
    bookingId: sarahBooking.id, guestId: sarahGuest.id,
    propertyId: prop1.id, ownerId: owner1.id,
    overallScore: 5, cleanlinessScore: 5, communicationScore: 5, valueScore: 4,
    review: "Loved the downtown loft — amazing city views and walkable to everything. Jennifer was super responsive.",
  });
  storage.createCoupon({
    guestId: sarahGuest.id, ratingId: sarahRating.id,
    code: "SARAH10", discountPercent: 10, status: "active",
    expiresAt: "2026-12-31",
  });
  storage.createGuestRating({
    bookingId: sarahBooking.id, ownerId: owner1.id, guestId: sarahGuest.id,
    overallScore: 5, cleanlinessScore: 5, communicationScore: 5, respectScore: 5,
    review: "Sarah was a wonderful guest — respectful, clean, and easy to communicate with. Would host again anytime.",
  });
  storage.createLedgerEntry({ ownerId: owner1.id, bookingId: sarahBooking.id, type: "income", category: "booking_revenue", amount: 480, description: "Booking — Downtown Loft (Sarah Chen, Aug 20-23)", date: "2026-08-20" });
  storage.createLedgerEntry({ ownerId: owner1.id, bookingId: sarahBooking.id, type: "expense", category: "cleaning", amount: 75, description: "Turnover clean — Downtown Loft", date: "2026-08-23" });
}
