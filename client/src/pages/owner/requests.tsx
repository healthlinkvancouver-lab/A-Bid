import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { useUserLookup } from "@/lib/use-user-lookup";
import { API, formatCurrency, formatDate, daysBetween } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Inbox, Gavel, MapPin, Users, DollarSign, Clock, CheckCircle2 } from "lucide-react";

export default function OwnerRequests() {
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedTrip, setExpandedTrip] = useState<number | null>(null);
  const [bidPrice, setBidPrice] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [bidMessage, setBidMessage] = useState("");

  const { data: tripRequests } = useQuery({
    queryKey: ["/api/trip-requests"],
    queryFn: API.getActiveTripRequests,
  });

  const { data: properties } = useQuery({
    queryKey: ["/api/owners", user?.id, "properties"],
    queryFn: () => API.getOwnerProperties(user!.id),
    enabled: !!user,
  });

  const getGuest = useUserLookup(tripRequests?.map(t => t.guestId) || []);

  const { data: existingBids } = useQuery({
    queryKey: ["/api/owners", user?.id, "bids"],
    queryFn: () => API.getOwnerBids(user!.id),
    enabled: !!user,
  });

  const bidMutation = useMutation({
    mutationFn: (data: any) => API.createBid(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owners", user?.id, "bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", user?.id, "stats"] });
      toast({ title: "Bid submitted!", description: "The guest has been notified of your offer" });
      setExpandedTrip(null);
      setBidPrice("");
      setSelectedProperty("");
      setBidMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit bid", variant: "destructive" });
    },
  });

  const hasBidOn = (tripId: number) => existingBids?.some(b => b.tripRequestId === tripId);

  const handleSubmitBid = (tripId: number, budget: number, budgetPerNight: number) => {
    const propId = parseInt(selectedProperty, 10);
    const prop = properties?.find(p => p.id === propId);
    if (!prop) {
      toast({ title: "Select a property", description: "Please choose which property to bid with", variant: "destructive" });
      return;
    }
    const pricePerNight = parseFloat(bidPrice);
    if (!pricePerNight || pricePerNight < 30) {
      toast({ title: "Invalid price", description: "Enter a valid nightly price", variant: "destructive" });
      return;
    }
    const trip = tripRequests?.find(t => t.id === tripId);
    if (!trip) return;
    const nights = daysBetween(trip.checkIn, trip.checkOut);
    const totalPrice = pricePerNight * nights;

    bidMutation.mutate({
      tripRequestId: tripId,
      propertyId: propId,
      ownerId: user!.id,
      pricePerNight,
      totalPrice,
      message: bidMessage,
      status: "pending",
    });
  };

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Trip Requests</h1>
        <p className="text-sm text-muted-foreground">Active guest requests looking for accommodations — submit your best offer</p>
      </div>

      {tripRequests?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No active trip requests right now. Check back soon!</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {tripRequests?.map((trip) => {
          const guest = getGuest(trip.guestId);
          const alreadyBid = hasBidOn(trip.id);
          const nights = daysBetween(trip.checkIn, trip.checkOut);
          const isExpanded = expandedTrip === trip.id;

          return (
            <Card key={trip.id} data-testid={`card-request-${trip.id}`}>
              <CardContent className="p-5">
                {/* Trip header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-base">{trip.city}</span>
                      {alreadyBid && <Badge className="bg-primary/10 text-primary"><CheckCircle2 className="h-3 w-3 mr-1" />Bid Sent</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(trip.checkIn)} — {formatDate(trip.checkOut)} · {nights} nights · {trip.guests} guests · {trip.bedroomsNeeded} bedroom(s)
                    </p>
                    {trip.notes && (
                      <p className="mt-2 text-sm italic text-muted-foreground">"{trip.notes}"</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Guest Budget</p>
                    <p className="text-lg font-bold text-primary" data-testid={`text-budget-${trip.id}`}>{formatCurrency(trip.budgetTotal)}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(trip.budgetPerNight)}/night</p>
                  </div>
                </div>

                {/* Guest info */}
                <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {guest?.name?.split(" ").map(n => n[0]).join("") || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{guest?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{guest?.role}</p>
                  </div>
                </div>

                {/* Bid form or button */}
                {!alreadyBid && !isExpanded && (
                  <Button onClick={() => setExpandedTrip(trip.id)} data-testid={`button-bid-${trip.id}`}>
                    <Gavel className="h-4 w-4 mr-2" />
                    Submit a Bid
                  </Button>
                )}
                {!alreadyBid && isExpanded && (
                  <div className="space-y-4 border-t border-border pt-4">
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">Select Property</Label>
                      <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                        <SelectTrigger data-testid={`select-property-${trip.id}`}>
                          <SelectValue placeholder="Choose a property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties?.map(prop => (
                            <SelectItem key={prop.id} value={String(prop.id)}>
                              {prop.title} — {formatCurrency(prop.nightlyRate)}/night
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">Your Price Per Night (CAD)</Label>
                      <Input
                        type="number"
                        placeholder={String(trip.budgetPerNight)}
                        value={bidPrice}
                        onChange={(e) => setBidPrice(e.target.value)}
                        data-testid={`input-bid-price-${trip.id}`}
                      />
                      {bidPrice && parseFloat(bidPrice) <= trip.budgetPerNight && (
                        <p className="mt-1 text-xs text-accent-foreground" data-testid={`text-under-budget-${trip.id}`}>
                          Under budget — competitive offer!
                        </p>
                      )}
                      {bidPrice && parseFloat(bidPrice) > trip.budgetPerNight && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(parseFloat(bidPrice) - trip.budgetPerNight)}/night above budget
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">Message to Guest (optional)</Label>
                      <Textarea
                        placeholder="Tell the guest why your property is perfect for their trip..."
                        value={bidMessage}
                        onChange={(e) => setBidMessage(e.target.value)}
                        rows={2}
                        data-testid={`input-bid-message-${trip.id}`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSubmitBid(trip.id, trip.budgetTotal, trip.budgetPerNight)}
                        disabled={bidMutation.isPending}
                        data-testid={`button-submit-bid-${trip.id}`}
                      >
                        {bidMutation.isPending ? "Submitting..." : "Submit Bid"}
                      </Button>
                      <Button variant="outline" onClick={() => setExpandedTrip(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
                {alreadyBid && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    You've already submitted a bid for this request
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
