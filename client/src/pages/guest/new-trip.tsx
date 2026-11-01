import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Gavel } from "lucide-react";

export default function NewTripRequest() {
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [city, setCity] = useState("Vancouver");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [bedroomsNeeded, setBedroomsNeeded] = useState("1");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => API.createTripRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "trip-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "stats"] });
      toast({ title: "Trip request posted!", description: "All hosts in the area have been notified. Bids incoming!" });
      window.location.hash = "#/guest/dashboard";
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post trip request", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    if (nights < 1) {
      toast({ title: "Invalid dates", description: "Check-out must be after check-in", variant: "destructive" });
      return;
    }
    const total = parseFloat(budgetTotal);
    if (!total || total < 50) {
      toast({ title: "Invalid budget", description: "Please enter a budget of at least $50", variant: "destructive" });
      return;
    }
    mutation.mutate({
      guestId: user!.id,
      city,
      checkIn,
      checkOut,
      guests: parseInt(guests),
      bedroomsNeeded: parseInt(bedroomsNeeded),
      budgetTotal: total,
      budgetPerNight: Math.round(total / nights),
      notes,
      status: "active",
    });
  };

  const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0;
  const perNight = budgetTotal && nights ? Math.round(parseFloat(budgetTotal) / nights) : 0;

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <Link href="/guest/dashboard">
          <Button variant="ghost" size="sm" className="mb-2 gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Post a Trip Request</h1>
        <p className="text-sm text-muted-foreground">Tell us what you need and your budget — hosts will bid to win your booking</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-5 w-5 text-primary" />
              Trip Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger id="city" data-testid="select-city">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vancouver">Vancouver</SelectItem>
                      <SelectItem value="North Vancouver">North Vancouver</SelectItem>
                      <SelectItem value="Burnaby">Burnaby</SelectItem>
                      <SelectItem value="Richmond">Richmond</SelectItem>
                      <SelectItem value="Surrey">Surrey</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guests">Guests</Label>
                  <Select value={guests} onValueChange={setGuests}>
                    <SelectTrigger id="guests" data-testid="select-guests">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "guest" : "guests"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="checkIn">Check-in Date</Label>
                  <Input id="checkIn" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required data-testid="input-checkin" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOut">Check-out Date</Label>
                  <Input id="checkOut" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required data-testid="input-checkout" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms Needed</Label>
                <Select value={bedroomsNeeded} onValueChange={setBedroomsNeeded}>
                  <SelectTrigger id="bedrooms" data-testid="select-bedrooms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "bedroom" : "bedrooms"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Total Budget (CAD)</Label>
                <Input
                  id="budget"
                  type="number"
                  min="50"
                  step="10"
                  placeholder="500"
                  value={budgetTotal}
                  onChange={(e) => setBudgetTotal(e.target.value)}
                  required
                  data-testid="input-budget"
                />
                {nights > 0 && perNight > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="text-per-night">
                    {nights} nights at approximately {formatCurrency(perNight)}/night
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes for Hosts (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Tell hosts what you're looking for — location preferences, amenities, occasion, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  data-testid="input-notes"
                />
              </div>

              <div className="rounded-lg border border-accent bg-accent/20 p-4 text-sm">
                <p className="font-medium text-accent-foreground">How it works</p>
                <ol className="mt-2 space-y-1 text-muted-foreground">
                  <li>1. Post your trip details and budget</li>
                  <li>2. All hosts in your city are notified instantly</li>
                  <li>3. Hosts submit their best offers to compete for your booking</li>
                  <li>4. Pick the offer you like best — accept and book</li>
                </ol>
              </div>

              <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-trip">
                {mutation.isPending ? "Posting..." : "Post Request & Notify Hosts"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
