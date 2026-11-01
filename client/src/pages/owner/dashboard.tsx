import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency, formatDate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, CalendarDays, DollarSign, TrendingUp, Gavel, Inbox, Plus } from "lucide-react";

export default function OwnerDashboard() {
  const { user } = useUser();
  const navItems = useNavItems();

  const { data: stats } = useQuery({
    queryKey: ["/api/owners", user?.id, "stats"],
    queryFn: () => API.getOwnerStats(user!.id),
    enabled: !!user,
  });

  const { data: properties } = useQuery({
    queryKey: ["/api/owners", user?.id, "properties"],
    queryFn: () => API.getOwnerProperties(user!.id),
    enabled: !!user,
  });

  const { data: bookings } = useQuery({
    queryKey: ["/api/owners", user?.id, "bookings"],
    queryFn: () => API.getOwnerBookings(user!.id),
    enabled: !!user,
  });

  const { data: tripRequests } = useQuery({
    queryKey: ["/api/trip-requests"],
    queryFn: API.getActiveTripRequests,
  });

  const { data: bids } = useQuery({
    queryKey: ["/api/owners", user?.id, "bids"],
    queryFn: () => API.getOwnerBids(user!.id),
    enabled: !!user,
  });

  const pendingBids = bids?.filter(b => b.status === "pending") || [];
  const upcomingBookings = bookings?.filter(b => b.status === "upcoming") || [];

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Owner Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back, {user?.name.split(" ")[0]} — here's your property overview</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Home} label="Properties" value={stats?.totalProperties ?? 0} />
        <StatCard icon={Gavel} label="Active Bids" value={stats?.activeBids ?? 0} />
        <StatCard icon={DollarSign} label="Net Profit" value={formatCurrency(stats?.netProfit ?? 0)} />
        <StatCard icon={CalendarDays} label="Upcoming" value={stats?.upcomingBookings ?? 0} />
      </div>

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/owner/requests">
          <Button variant="outline" className="gap-2" data-testid="button-view-requests">
            <Inbox className="h-4 w-4" />
            View Trip Requests ({tripRequests?.length || 0})
          </Button>
        </Link>
        <Link href="/owner/accounting">
          <Button variant="outline" className="gap-2" data-testid="button-accounting">
            <DollarSign className="h-4 w-4" />
            Accounting
          </Button>
        </Link>
      </div>

      {/* Active trip requests alert */}
      {tripRequests && tripRequests.length > 0 && (
        <Card className="mb-6 border-accent bg-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-5 w-5 text-accent-foreground" />
              New Trip Requests to Bid On
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tripRequests.slice(0, 3).map((trip) => (
              <Link key={trip.id} href="/owner/requests">
                <div className="flex items-center justify-between rounded-lg border border-accent bg-card p-3 cursor-pointer hover-elevate" data-testid={`card-trip-request-${trip.id}`}>
                  <div>
                    <span className="font-medium">{trip.city}</span>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(trip.checkIn)} — {formatDate(trip.checkOut)} · Budget {formatCurrency(trip.budgetTotal)} ({formatCurrency(trip.budgetPerNight)}/night)
                    </p>
                  </div>
                  <Badge className="bg-accent text-accent-foreground">Bid Now</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Properties */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Your Properties</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {properties?.map((prop) => {
            const images = JSON.parse(prop.images || "[]");
            return (
              <Card key={prop.id} data-testid={`card-property-${prop.id}`}>
                <CardContent className="p-4">
                  {images[0] && (
                    <img src={images[0]} alt={prop.title} className="mb-3 h-32 w-full rounded-lg object-cover" />
                  )}
                  <h3 className="font-semibold">{prop.title}</h3>
                  <p className="text-sm text-muted-foreground">{prop.address}, {prop.city}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{prop.bedrooms} bed · {prop.bathrooms} bath · {prop.maxGuests} guests</span>
                    <span className="font-semibold text-primary">{formatCurrency(prop.nightlyRate)}/night</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Upcoming bookings */}
      {upcomingBookings.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Upcoming Bookings</h2>
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <Card key={booking.id} data-testid={`card-upcoming-booking-${booking.id}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <span className="font-medium">Booking #{booking.id}</span>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)} · {formatCurrency(booking.totalPrice)}
                    </p>
                  </div>
                  <Badge variant="default">Upcoming</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <Card data-testid={`card-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold" data-testid={`text-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
          </div>
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
