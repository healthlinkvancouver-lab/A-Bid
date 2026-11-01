import { apiRequest } from "@/lib/queryClient";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  avatar: string | null;
  createdAt: string;
}

export interface Property {
  id: number;
  ownerId: number;
  title: string;
  description: string;
  address: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  images: string;
  amenities: string;
  createdAt: string;
}

export interface TripRequest {
  id: number;
  guestId: number;
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  bedroomsNeeded: number;
  budgetTotal: number;
  budgetPerNight: number;
  notes: string | null;
  status: string;
  createdAt: string;
}

export interface Bid {
  id: number;
  tripRequestId: number;
  propertyId: number;
  ownerId: number;
  pricePerNight: number;
  totalPrice: number;
  message: string | null;
  status: string;
  createdAt: string;
}

export interface Booking {
  id: number;
  bidId: number;
  tripRequestId: number;
  propertyId: number;
  guestId: number;
  ownerId: number;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  damageDeposit: number;
  status: string;
  createdAt: string;
}

export interface Payment {
  id: number;
  bookingId: number;
  guestId: number;
  amount: number;
  type: string;
  status: string;
  dueDate: string;
  paidDate: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: number;
  ownerId: number;
  bookingId: number | null;
  type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  message: string;
  read: number;
  createdAt: string;
}

export interface OwnerStats {
  totalProperties: number;
  totalBookings: number;
  upcomingBookings: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  activeBids: number;
}

export interface GuestStats {
  activeTrips: number;
  totalBookings: number;
  upcomingBookings: number;
  totalPaid: number;
  totalPending: number;
  activeCoupons: number;
  totalRatings: number;
}

export interface Rating {
  id: number;
  bookingId: number;
  guestId: number;
  propertyId: number;
  ownerId: number;
  overallScore: number;
  cleanlinessScore: number;
  communicationScore: number;
  valueScore: number;
  review: string | null;
  createdAt: string;
}

export interface GuestRating {
  id: number;
  bookingId: number;
  ownerId: number;
  guestId: number;
  overallScore: number;
  cleanlinessScore: number;
  communicationScore: number;
  respectScore: number;
  review: string | null;
  createdAt: string;
}

export interface Coupon {
  id: number;
  guestId: number;
  ratingId: number | null;
  code: string;
  discountPercent: number;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export const API = {
  // Users
  getUsers: () => apiRequest("GET", "/api/users").then(r => r.json()) as Promise<User[]>,
  getUser: (id: number) => apiRequest("GET", `/api/users/${id}`).then(r => r.json()) as Promise<User>,
  lookupUsers: (ids: number[]) => apiRequest("POST", "/api/users/lookup", { ids }).then(r => r.json()) as Promise<Pick<User, "id" | "name" | "role" | "avatar">[]>,
  // Properties
  getProperties: () => apiRequest("GET", "/api/properties").then(r => r.json()) as Promise<Property[]>,
  getProperty: (id: number) => apiRequest("GET", `/api/properties/${id}`).then(r => r.json()) as Promise<Property>,
  createProperty: (data: any) => apiRequest("POST", "/api/properties", data).then(r => r.json()) as Promise<Property>,
  getOwnerProperties: (ownerId: number) => apiRequest("GET", `/api/owners/${ownerId}/properties`).then(r => r.json()) as Promise<Property[]>,
  // Trip Requests
  getActiveTripRequests: () => apiRequest("GET", "/api/trip-requests").then(r => r.json()) as Promise<TripRequest[]>,
  getGuestTripRequests: (guestId: number) => apiRequest("GET", `/api/guests/${guestId}/trip-requests`).then(r => r.json()) as Promise<TripRequest[]>,
  getTripRequest: (id: number) => apiRequest("GET", `/api/trip-requests/${id}`).then(r => r.json()) as Promise<TripRequest>,
  getTripRequestBids: (id: number) => apiRequest("GET", `/api/trip-requests/${id}/bids`).then(r => r.json()) as Promise<Bid[]>,
  createTripRequest: (data: any) => apiRequest("POST", "/api/trip-requests", data).then(r => r.json()),
  // Bids
  getOwnerBids: (ownerId: number) => apiRequest("GET", `/api/owners/${ownerId}/bids`).then(r => r.json()) as Promise<Bid[]>,
  createBid: (data: any) => apiRequest("POST", "/api/bids", data).then(r => r.json()),
  acceptBid: (id: number) => apiRequest("POST", `/api/bids/${id}/accept`).then(r => r.json()),
  rejectBid: (id: number) => apiRequest("POST", `/api/bids/${id}/reject`).then(r => r.json()),
  // Bookings
  getAllBookings: () => apiRequest("GET", "/api/bookings").then(r => r.json()) as Promise<Booking[]>,
  getBooking: (id: number) => apiRequest("GET", `/api/bookings/${id}`).then(r => r.json()) as Promise<Booking>,
  getGuestBookings: (guestId: number) => apiRequest("GET", `/api/guests/${guestId}/bookings`).then(r => r.json()) as Promise<Booking[]>,
  getOwnerBookings: (ownerId: number) => apiRequest("GET", `/api/owners/${ownerId}/bookings`).then(r => r.json()) as Promise<Booking[]>,
  getBookingPayments: (id: number) => apiRequest("GET", `/api/bookings/${id}/payments`).then(r => r.json()) as Promise<Payment[]>,
  updateBookingStatus: (id: number, status: string) => apiRequest("PATCH", `/api/bookings/${id}/status`, { status }).then(r => r.json()),
  // Payments
  getGuestPayments: (guestId: number) => apiRequest("GET", `/api/guests/${guestId}/payments`).then(r => r.json()) as Promise<Payment[]>,
  payPayment: (id: number) => apiRequest("POST", `/api/payments/${id}/pay`).then(r => r.json()),
  // Ledger
  getOwnerLedger: (ownerId: number) => apiRequest("GET", `/api/owners/${ownerId}/ledger`).then(r => r.json()) as Promise<LedgerEntry[]>,
  createLedgerEntry: (ownerId: number, data: any) => apiRequest("POST", `/api/owners/${ownerId}/ledger`, data).then(r => r.json()),
  // Notifications
  getUserNotifications: (userId: number) => apiRequest("GET", `/api/users/${userId}/notifications`).then(r => r.json()) as Promise<Notification[]>,
  markNotificationRead: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`).then(r => r.json()),
  // Stats
  getOwnerStats: (ownerId: number) => apiRequest("GET", `/api/owners/${ownerId}/stats`).then(r => r.json()) as Promise<OwnerStats>,
  getGuestStats: (guestId: number) => apiRequest("GET", `/api/guests/${guestId}/stats`).then(r => r.json()) as Promise<GuestStats>,
  // Ratings (guest rates property)
  getOwnerRatings: (ownerId: number) => apiRequest("GET", `/api/owners/${ownerId}/ratings`).then(r => r.json()) as Promise<Rating[]>,
  getBookingRating: (bookingId: number) => apiRequest("GET", `/api/bookings/${bookingId}/rating`).then(r => r.json()) as Promise<Rating | null>,
  rateBooking: (bookingId: number, data: any) => apiRequest("POST", `/api/bookings/${bookingId}/rate`, data).then(r => r.json()),
  getPropertyRatings: (propertyId: number) => apiRequest("GET", `/api/properties/${propertyId}/ratings`).then(r => r.json()) as Promise<Rating[]>,
  getGuestRatings: (guestId: number) => apiRequest("GET", `/api/guests/${guestId}/ratings`).then(r => r.json()) as Promise<Rating[]>,
  // Coupons
  getGuestCoupons: (guestId: number) => apiRequest("GET", `/api/guests/${guestId}/coupons`).then(r => r.json()) as Promise<Coupon[]>,
  // Guest Ratings (owner rates guest)
  getBookingGuestRating: (bookingId: number) => apiRequest("GET", `/api/bookings/${bookingId}/guest-rating`).then(r => r.json()) as Promise<GuestRating | null>,
  rateGuest: (bookingId: number, data: any) => apiRequest("POST", `/api/bookings/${bookingId}/rate-guest`, data).then(r => r.json()),
  getOwnerGuestRatings: (ownerId: number) => apiRequest("GET", `/api/owners/${ownerId}/guest-ratings`).then(r => r.json()) as Promise<GuestRating[]>,
  getGuestReceivedRatings: (guestId: number) => apiRequest("GET", `/api/guests/${guestId}/guest-ratings`).then(r => r.json()) as Promise<GuestRating[]>,
  // Auth (P0-3)
  login: (email: string, password: string) => apiRequest("POST", "/api/auth/login", { email, password }).then(r => r.json()) as Promise<User>,
  register: (name: string, email: string, password: string, role: "guest" | "owner") => apiRequest("POST", "/api/auth/register", { name, email, password, role }).then(r => r.json()) as Promise<User>,
  logout: () => apiRequest("POST", "/api/auth/logout").then(r => r.json()),
  getMe: () => apiRequest("GET", "/api/auth/me").then(r => r.json()) as Promise<User>,
  // Stripe (P0-4)
  getConfig: () => apiRequest("GET", "/api/config").then(r => r.json()) as Promise<{ stripeConfigured: boolean; stripePublishableKey: string | null; platformFeePercent: number }>,
  createCheckout: (paymentId: number) => apiRequest("POST", `/api/payments/${paymentId}/checkout`).then(r => r.json()) as Promise<{ clientSecret: string; paymentIntentId: string }>,
  onboardConnect: () => apiRequest("POST", "/api/connect/onboard").then(r => r.json()) as Promise<{ url: string | null; accountId: string }>,
  getConnectStatus: () => apiRequest("GET", "/api/connect/status").then(r => r.json()) as Promise<{ stripeAccountId: string | null; onboarded: boolean; stripeConfigured: boolean }>,
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export function daysBetween(checkIn: string, checkOut: string): number {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(diff / 86400000));
}

export function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}
