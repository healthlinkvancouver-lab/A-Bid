import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency, formatDate, daysBetween } from "@/lib/api";
import { useUserLookup } from "@/lib/use-user-lookup";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Star, Gift, ArrowLeft, CheckCircle2, AlertTriangle, UserCheck } from "lucide-react";
import { RatingConsentDialog } from "@/components/rating-consent";

export default function GuestRatings() {
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ratings } = useQuery({
    queryKey: ["/api/guests", user?.id, "ratings"],
    queryFn: () => API.getGuestRatings(user!.id),
    enabled: !!user,
  });

  const { data: coupons } = useQuery({
    queryKey: ["/api/guests", user?.id, "coupons"],
    queryFn: () => API.getGuestCoupons(user!.id),
    enabled: !!user,
  });

  const { data: receivedRatings } = useQuery({
    queryKey: ["/api/guests", user?.id, "guest-ratings"],
    queryFn: () => API.getGuestReceivedRatings(user!.id),
    enabled: !!user,
  });

  const { data: bookings } = useQuery({
    queryKey: ["/api/guests", user?.id, "bookings"],
    queryFn: () => API.getGuestBookings(user!.id),
    enabled: !!user,
  });

  const { data: properties } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: API.getProperties,
  });

  const getOwner = useUserLookup(bookings?.map(b => b.ownerId) || []);

  // Bookings that are completed and not yet rated
  const completedBookings = bookings?.filter(b => b.status === "completed") || [];
  const ratedBookingIds = new Set(ratings?.map(r => r.bookingId) || []);
  const unratedBookings = completedBookings.filter(b => !ratedBookingIds.has(b.id));
  const ratedBookings = completedBookings.filter(b => ratedBookingIds.has(b.id));

  const activeCoupons = coupons?.filter(c => c.status === "active") || [];
  const usedCoupons = coupons?.filter(c => c.status === "used") || [];

  const getProperty = (propId: number) => properties?.find(p => p.id === propId);

  return (
    <AppLayout navItems={navItems}>
      <RatingConsentDialog />
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Ratings & Rewards</h1>
        <p className="text-sm text-muted-foreground">Rate your stays, earn discounts, and build your guest reputation</p>
      </div>

      {/* Coupons section */}
      {activeCoupons.length > 0 && (
        <Card className="mb-6 border-accent bg-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-5 w-5 text-accent-foreground" />
              Your Discount Coupons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeCoupons.map((coupon) => (
              <div key={coupon.id} className="flex items-center justify-between rounded-lg border border-accent bg-card p-3" data-testid={`card-coupon-${coupon.id}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/30">
                    <Gift className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-bold tracking-wider" data-testid={`text-coupon-code-${coupon.id}`}>{coupon.code}</p>
                    <p className="text-xs text-muted-foreground">Expires {formatDate(coupon.expiresAt)}</p>
                  </div>
                </div>
                <Badge className="bg-accent text-accent-foreground" data-testid={`badge-coupon-discount-${coupon.id}`}>
                  {coupon.discountPercent}% OFF
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Apply coupon codes at checkout on your next booking to save on your stay.</p>
          </CardContent>
        </Card>
      )}

      {/* Unrated completed bookings */}
      <div className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          <Star className="h-4 w-4 text-accent-foreground" />
          Rate Your Recent Stays
          {unratedBookings.length > 0 && (
            <Badge className="bg-accent text-accent-foreground">{unratedBookings.length} pending</Badge>
          )}
        </h2>
        <div className="space-y-3">
          {unratedBookings.length === 0 && (
            <Card>
              <CardContent className="flex items-center py-10 text-center">
                <div className="w-full">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">All your completed stays have been rated. Thank you!</p>
                </div>
              </CardContent>
            </Card>
          )}
          {unratedBookings.map((booking) => {
            const prop = getProperty(booking.propertyId);
            const owner = getOwner(booking.ownerId);
            const nights = daysBetween(booking.checkIn, booking.checkOut);
            return (
              <RateBookingCard
                key={booking.id}
                bookingId={booking.id}
                propertyTitle={prop?.title || "Property"}
                propertyName={prop?.address || ""}
                ownerName={owner?.name || ""}
                checkIn={booking.checkIn}
                checkOut={booking.checkOut}
                nights={nights}
                onRated={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "ratings"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "coupons"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "stats"] });
                  toast({ title: "Review submitted!", description: "You've earned a 10% discount coupon for your next booking!" });
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Past reviews you've written */}
      {ratedBookings.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Reviews You've Written</h2>
          <div className="space-y-3">
            {ratedBookings.map((booking) => {
              const rating = ratings?.find(r => r.bookingId === booking.id);
              const prop = getProperty(booking.propertyId);
              if (!rating) return null;
              return (
                <Card key={booking.id} data-testid={`card-review-written-${booking.id}`}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{prop?.title}</span>
                        <p className="text-sm text-muted-foreground">{formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}</p>
                      </div>
                      <div className="flex gap-0.5" data-testid={`stars-written-${booking.id}`}>
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`h-4 w-4 ${n <= rating.overallScore ? "fill-accent-foreground text-accent-foreground" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </div>
                    {rating.review && <p className="text-sm text-muted-foreground">{rating.review}</p>}
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                      <span>Cleanliness: {rating.cleanlinessScore}/5</span>
                      <span>Communication: {rating.communicationScore}/5</span>
                      <span>Value: {rating.valueScore}/5</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Your guest reputation */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          <UserCheck className="h-4 w-4 text-primary" />
          Your Guest Reputation
        </h2>
        {receivedRatings && receivedRatings.length > 0 ? (
          <div className="space-y-3">
            {receivedRatings.map((gr) => {
              const booking = bookings?.find(b => b.id === gr.bookingId);
              const prop = booking ? getProperty(booking.propertyId) : null;
              const owner = getOwner(gr.ownerId);
              return (
                <Card key={gr.id} data-testid={`card-guest-rating-${gr.id}`}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{prop?.title || "Property"}</span>
                        <p className="text-sm text-muted-foreground">Host: {owner?.name}</p>
                      </div>
                      <div className="flex gap-0.5" data-testid={`stars-guest-${gr.id}`}>
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`h-4 w-4 ${n <= gr.overallScore ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </div>
                    {gr.review && <p className="text-sm text-muted-foreground">{gr.review}</p>}
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                      <span>Cleanliness: {gr.cleanlinessScore}/5</span>
                      <span>Communication: {gr.communicationScore}/5</span>
                      <span>Respect: {gr.respectScore}/5</span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => toast({ title: "Correction request submitted", description: "ABid support will review this rating within 48 hours. You will be notified of the outcome." })}
                        data-testid={`button-dispute-${gr.id}`}
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Request Correction
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center py-10 text-center">
              <div className="w-full">
                <UserCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No host reviews yet. Complete a stay to build your guest reputation.</p>
              </div>
            </CardContent>
          </Card>
        )}
        {receivedRatings && receivedRatings.length > 0 && (
          <Card className="mt-3 border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">
                  Your reputation score is visible to all hosts. Maintaining a high score helps you win future bookings.
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function RateBookingCard({ bookingId, propertyTitle, propertyName, ownerName, checkIn, checkOut, nights, onRated }: {
  bookingId: number; propertyTitle: string; propertyName: string; ownerName: string;
  checkIn: string; checkOut: string; nights: number; onRated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overall, setOverall] = useState(5);
  const [cleanliness, setCleanliness] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [value, setValue] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await API.rateBooking(bookingId, { overallScore: overall, cleanlinessScore: cleanliness, communicationScore: communication, valueScore: value, review });
      onRated();
      setExpanded(false);
    } catch {
      // error handled by toast
    }
    setSubmitting(false);
  };

  return (
    <Card data-testid={`card-rate-booking-${bookingId}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">{propertyTitle}</span>
            <p className="text-sm text-muted-foreground">{formatDate(checkIn)} — {formatDate(checkOut)} · {nights} nights · Host: {ownerName}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)} data-testid={`button-rate-${bookingId}`}>
            {expanded ? "Cancel" : "Rate Stay"}
          </Button>
        </div>
        {expanded && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <StarRow label="Overall Experience" value={overall} onChange={setOverall} testId={`stars-overall-${bookingId}`} />
            <StarRow label="Cleanliness" value={cleanliness} onChange={setCleanliness} testId={`stars-clean-${bookingId}`} />
            <StarRow label="Host Communication" value={communication} onChange={setCommunication} testId={`stars-comm-${bookingId}`} />
            <StarRow label="Value for Money" value={value} onChange={setValue} testId={`stars-value-${bookingId}`} />
            <Textarea
              placeholder="Share details about your stay (optional)..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              data-testid={`input-review-${bookingId}`}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSubmit} disabled={submitting} data-testid={`button-submit-review-${bookingId}`}>
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Gift className="h-3 w-3 text-accent-foreground" />
                Earn a 10% discount coupon on submission
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StarRow({ label, value, onChange, testId }: { label: string; value: number; onChange: (v: number) => void; testId: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-1" data-testid={testId}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5"
            data-testid={`${testId}-${n}`}
            aria-label={`${n} star`}
          >
            <Star className={`h-5 w-5 ${n <= value ? "fill-accent-foreground text-accent-foreground" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
