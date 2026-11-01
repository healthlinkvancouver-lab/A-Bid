import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency, formatDate, daysBetween } from "@/lib/api";
import { useUserLookup } from "@/lib/use-user-lookup";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Gavel, Check, X, MapPin, Users, BedDouble, DollarSign, Clock } from "lucide-react";
import { useQuery as useQueryProperties } from "@tanstack/react-query";

export default function TripDetails() {
  const { id } = useParams();
  const tripId = parseInt(id!, 10);
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trip } = useQuery({
    queryKey: ["/api/trip-requests", tripId],
    queryFn: () => API.getTripRequest(tripId),
  });

  const { data: bids } = useQuery({
    queryKey: ["/api/trip-requests", tripId, "bids"],
    queryFn: () => API.getTripRequestBids(tripId),
  });

  const { data: properties } = useQueryProperties({
    queryKey: ["/api/properties"],
    queryFn: API.getProperties,
  });

  const getOwner = useUserLookup(bids?.map(b => b.ownerId) || []);

  const acceptMutation = useMutation({
    mutationFn: (bidId: number) => API.acceptBid(bidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests", tripId, "bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "stats"] });
      toast({ title: "Booking confirmed!", description: "Your payment plan has been set up. Check your bookings." });
      window.location.hash = "#/guest/dashboard";
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (bidId: number) => API.rejectBid(bidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests", tripId, "bids"] });
      toast({ title: "Bid rejected", description: "The host has been notified" });
    },
  });

  const getProperty = (propId: number) => properties?.find(p => p.id === propId);
  const nights = trip ? daysBetween(trip.checkIn, trip.checkOut) : 0;

  const sortedBids = [...(bids || [])].sort((a, b) => a.pricePerNight - b.pricePerNight);

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <Link href="/guest/dashboard">
          <Button variant="ghost" size="sm" className="mb-2 gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Trip Request Details</h1>
      </div>

      {/* Trip summary */}
      {trip && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant={trip.status === "active" ? "default" : "secondary"} data-testid="status-trip-detail">
                {trip.status === "active" ? "Active — accepting bids" : "Closed"}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem icon={MapPin} label="City" value={trip.city} />
              <InfoItem icon={Clock} label="Dates" value={`${formatDate(trip.checkIn)} — ${formatDate(trip.checkOut)}`} />
              <InfoItem icon={Users} label="Guests" value={`${trip.guests} guests · ${trip.bedroomsNeeded} bedroom(s)`} />
              <InfoItem icon={DollarSign} label="Budget" value={`${formatCurrency(trip.budgetTotal)} (${formatCurrency(trip.budgetPerNight)}/night)`} />
            </div>
            {trip.notes && (
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <span className="font-medium">Notes: </span>
                <span className="text-muted-foreground">{trip.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bids */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Host Bids ({sortedBids.length})
          </h2>
          {trip?.status === "active" && (
            <Badge variant="secondary" className="gap-1">
              <Gavel className="h-3 w-3" />
              {sortedBids.filter(b => b.status === "pending").length} pending
            </Badge>
          )}
        </div>

        {sortedBids.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Gavel className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No bids yet. Hosts are being notified — check back soon!</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {sortedBids.map((bid, idx) => {
            const prop = getProperty(bid.propertyId);
            const owner = getOwner(bid.ownerId);
            const images = prop ? JSON.parse(prop.images || "[]") : [];
            const amenities = prop ? JSON.parse(prop.amenities || "[]") : [];
            const isBestPrice = idx === 0 && bid.status === "pending";
            const savings = trip ? trip.budgetTotal - bid.totalPrice : 0;

            return (
              <Card
                key={bid.id}
                className={bid.status === "accepted" ? "border-primary" : isBestPrice ? "border-accent" : ""}
                data-testid={`card-bid-${bid.id}`}
              >
                <CardContent className="p-5">
                  {/* Bid header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {images[0] && (
                        <img src={images[0]} alt={prop?.title} className="h-16 w-16 rounded-lg object-cover" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{prop?.title}</h3>
                          {isBestPrice && (
                            <Badge className="bg-accent text-accent-foreground" data-testid={`badge-best-price-${bid.id}`}>
                              Best Price
                            </Badge>
                          )}
                          {bid.status === "accepted" && (
                            <Badge className="bg-primary text-primary-foreground" data-testid={`badge-accepted-${bid.id}`}>
                              Accepted
                            </Badge>
                          )}
                          {bid.status === "rejected" && (
                            <Badge variant="secondary">Rejected</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{prop?.address}, {prop?.city}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary" data-testid={`text-bid-price-${bid.id}`}>
                        {formatCurrency(bid.pricePerNight)}
                        <span className="text-sm font-normal text-muted-foreground">/night</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(bid.totalPrice)} total</p>
                      {savings > 0 && bid.status === "pending" && (
                        <p className="text-xs font-medium text-accent-foreground" data-testid={`text-savings-${bid.id}`}>
                          {formatCurrency(savings)} under budget
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Property details */}
                  <div className="grid gap-3 sm:grid-cols-3 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BedDouble className="h-4 w-4" />
                      {prop?.bedrooms} bed · {prop?.bathrooms} bath
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Up to {prop?.maxGuests} guests
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Listed at {formatCurrency(prop?.nightlyRate || 0)}/night
                    </div>
                  </div>

                  {/* Amenities */}
                  {amenities.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {amenities.map((a: string) => (
                        <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Host message */}
                  {bid.message && (
                    <div className="mb-4 rounded-lg bg-muted p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={owner?.avatar || undefined} alt={owner?.name} />
                          <AvatarFallback className="text-[10px]">{owner?.name?.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{owner?.name}</span>
                      </div>
                      <p className="text-muted-foreground">{bid.message}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {bid.status === "pending" && trip?.status === "active" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => acceptMutation.mutate(bid.id)}
                        disabled={acceptMutation.isPending}
                        data-testid={`button-accept-${bid.id}`}
                      >
                        <Check className="h-4 w-4" />
                        Accept & Book
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => rejectMutation.mutate(bid.id)}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-${bid.id}`}
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
