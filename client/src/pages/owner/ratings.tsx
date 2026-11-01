import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { useUserLookup } from "@/lib/use-user-lookup";
import { API, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Star, UserCheck, AlertTriangle, Shield, CheckCircle2 } from "lucide-react";
import { RatingConsentDialog } from "@/components/rating-consent";

export default function OwnerRatings() {
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookings } = useQuery({
    queryKey: ["/api/owners", user?.id, "bookings"],
    queryFn: () => API.getOwnerBookings(user!.id),
    enabled: !!user,
  });

  const { data: propertyRatings } = useQuery({
    queryKey: ["/api/owners", user?.id, "ratings"],
    queryFn: () => API.getOwnerRatings(user!.id),
    enabled: !!user,
  });

  const { data: guestRatingsGiven } = useQuery({
    queryKey: ["/api/owners", user?.id, "guest-ratings"],
    queryFn: () => API.getOwnerGuestRatings(user!.id),
    enabled: !!user,
  });

  const { data: properties } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: API.getProperties,
  });

  const getGuest = useUserLookup(bookings?.map(b => b.guestId) || []);

  const ownerProps = properties?.filter(p => p.ownerId === user?.id) || [];
  const ownerPropIds = new Set(ownerProps.map(p => p.id));

  // All ratings on owner's properties
  const allPropertyRatings = propertyRatings || [];
  // Bookings completed but guest not yet rated by owner
  const completedBookings = bookings?.filter(b => b.status === "completed") || [];
  const ratedBookingIds = new Set(guestRatingsGiven?.map((g: any) => g.bookingId) || []);
  const unratedBookings = completedBookings.filter(b => !ratedBookingIds.has(b.id));
  const ratedBookings = completedBookings.filter(b => ratedBookingIds.has(b.id));

  const getProperty = (propId: number) => properties?.find(p => p.id === propId);

  // Average scores
  const avgScore = allPropertyRatings.length > 0
    ? (allPropertyRatings.reduce((s: number, r: any) => s + r.overallScore, 0) / allPropertyRatings.length).toFixed(1)
    : null;

  return (
    <AppLayout navItems={navItems}>
      <RatingConsentDialog />
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Guest Reviews</h1>
        <p className="text-sm text-muted-foreground">Rate your guests, screen for problem renters, and view property reviews</p>
      </div>

      {/* Reputation overview */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Star className="h-3 w-3" /> Avg Property Rating
            </div>
            <p className="text-2xl font-bold" data-testid="text-avg-rating">{avgScore ? `${avgScore}/5` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <UserCheck className="h-3 w-3" /> Guests Rated
            </div>
            <p className="text-2xl font-bold" data-testid="text-guests-rated">{guestRatingsGiven?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Shield className="h-3 w-3" /> Total Reviews
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-reviews">{allPropertyRatings.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Guest screening notice */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-2 text-sm">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Guest Reputation Database</p>
              <p className="text-muted-foreground mt-1">
                Every guest review contributes to a shared database. When a new trip request comes in, you'll see the guest's reputation score
                — helping you flag guests with a history of damage, noise complaints, or poor communication before accepting their booking.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate guests from completed bookings */}
      <div className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          <UserCheck className="h-4 w-4 text-primary" />
          Rate Your Guests
          {unratedBookings.length > 0 && (
            <Badge className="bg-primary text-primary-foreground">{unratedBookings.length} pending</Badge>
          )}
        </h2>
        <div className="space-y-3">
          {unratedBookings.length === 0 && (
            <Card>
              <CardContent className="flex items-center py-10 text-center">
                <div className="w-full">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">All completed bookings have been rated.</p>
                </div>
              </CardContent>
            </Card>
          )}
          {unratedBookings.map((booking) => {
            const guest = getGuest(booking.guestId);
            const prop = getProperty(booking.propertyId);
            return (
              <RateGuestCard
                key={booking.id}
                bookingId={booking.id}
                guestName={guest?.name || "Guest"}
                guestAvatar={guest?.avatar}
                propertyTitle={prop?.title || "Property"}
                checkIn={booking.checkIn}
                checkOut={booking.checkOut}
                onRated={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/owners", user?.id, "guest-ratings"] });
                  toast({ title: "Guest review submitted!", description: "Your review helps protect other hosts." });
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Guest reviews you've given */}
      {ratedBookings.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Guest Reviews You've Written</h2>
          <div className="space-y-3">
            {ratedBookings.map((booking) => {
              const gr = guestRatingsGiven?.find((g: any) => g.bookingId === booking.id);
              const guest = getGuest(booking.guestId);
              if (!gr) return null;
              return (
                <Card key={booking.id} data-testid={`card-guest-review-${booking.id}`}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{guest?.name}</span>
                        <p className="text-sm text-muted-foreground">{formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}</p>
                      </div>
                      <div className="flex gap-0.5">
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Property reviews */}
      {allPropertyRatings.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Reviews on Your Properties</h2>
          <div className="space-y-3">
            {allPropertyRatings.map((rating: any) => {
              const prop = getProperty(rating.propertyId);
              const guest = getGuest(rating.guestId);
              return (
                <Card key={rating.id} data-testid={`card-prop-review-${rating.id}`}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{prop?.title}</span>
                        <p className="text-sm text-muted-foreground">by {guest?.name} · {formatDate(rating.createdAt)}</p>
                      </div>
                      <div className="flex gap-0.5">
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
    </AppLayout>
  );
}

function RateGuestCard({ bookingId, guestName, guestAvatar, propertyTitle, checkIn, checkOut, onRated }: {
  bookingId: number; guestName: string; guestAvatar: string | null | undefined;
  propertyTitle: string; checkIn: string; checkOut: string; onRated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overall, setOverall] = useState(5);
  const [cleanliness, setCleanliness] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [respect, setRespect] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await API.rateGuest(bookingId, { overallScore: overall, cleanlinessScore: cleanliness, communicationScore: communication, respectScore: respect, review });
      onRated();
      setExpanded(false);
    } catch {
      // handled by toast
    }
    setSubmitting(false);
  };

  return (
    <Card data-testid={`card-rate-guest-${bookingId}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">{guestName}</span>
            <p className="text-sm text-muted-foreground">{propertyTitle} · {formatDate(checkIn)} — {formatDate(checkOut)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)} data-testid={`button-rate-guest-${bookingId}`}>
            {expanded ? "Cancel" : "Rate Guest"}
          </Button>
        </div>
        {expanded && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <StarRow label="Overall Experience" value={overall} onChange={setOverall} testId={`stars-g-overall-${bookingId}`} />
            <StarRow label="Cleanliness" value={cleanliness} onChange={setCleanliness} testId={`stars-g-clean-${bookingId}`} />
            <StarRow label="Communication" value={communication} onChange={setCommunication} testId={`stars-g-comm-${bookingId}`} />
            <StarRow label="Respect for Property" value={respect} onChange={setRespect} testId={`stars-g-respect-${bookingId}`} />
            <Textarea
              placeholder="Notes about this guest (damage, noise, communication, etc.)..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              data-testid={`input-guest-review-${bookingId}`}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSubmit} disabled={submitting} data-testid={`button-submit-guest-review-${bookingId}`}>
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3 text-primary" />
                Added to guest reputation database
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
          <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5" data-testid={`${testId}-${n}`} aria-label={`${n} star`}>
            <Star className={`h-5 w-5 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

