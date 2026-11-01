import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency, formatDate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gavel, CalendarDays, DollarSign, Plus, TrendingUp } from "lucide-react";

export default function GuestDashboard() {
  const { user } = useUser();
  const navItems = useNavItems();

  const { data: stats } = useQuery({
    queryKey: ["/api/guests", user?.id, "stats"],
    queryFn: () => API.getGuestStats(user!.id),
    enabled: !!user,
  });

  const { data: trips } = useQuery({
    queryKey: ["/api/guests", user?.id, "trip-requests"],
    queryFn: () => API.getGuestTripRequests(user!.id),
    enabled: !!user,
  });

  const { data: bookings } = useQuery({
    queryKey: ["/api/guests", user?.id, "bookings"],
    queryFn: () => API.getGuestBookings(user!.id),
    enabled: !!user,
  });

  const { data: payments } = useQuery({
    queryKey: ["/api/guests", user?.id, "payments"],
    queryFn: () => API.getGuestPayments(user!.id),
    enabled: !!user,
  });

  const pendingPayments = payments?.filter(p => p.status === "pending") || [];

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Welcome back, {user?.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Manage your trip requests, bookings, and payments</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Gavel} label="Active Trips" value={stats?.activeTrips ?? 0} />
        <StatCard icon={CalendarDays} label="Upcoming Stays" value={stats?.upcomingBookings ?? 0} />
        <StatCard icon={DollarSign} label="Total Paid" value={formatCurrency(stats?.totalPaid ?? 0)} />
        <StatCard icon={TrendingUp} label="Pending Payments" value={formatCurrency(stats?.totalPending ?? 0)} />
      </div>

      {/* Quick action */}
      <div className="mb-6">
        <Link href="/guest/new-trip">
          <Button data-testid="button-new-trip" className="gap-2">
            <Plus className="h-4 w-4" />
            Post a New Trip Request
          </Button>
        </Link>
      </div>

      {/* Pending payments alert */}
      {pendingPayments.length > 0 && (
        <Card className="mb-6 border-accent bg-accent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-accent-foreground" />
              Payment Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingPayments.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {p.type === "deposit" ? "Damage deposit" : p.type === "final" ? "Final payment" : "Installment"} — due {formatDate(p.dueDate)}
                </span>
                <span className="font-semibold">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trip requests */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Your Trip Requests</h2>
        <div className="space-y-3">
          {trips?.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Gavel className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="mb-4 text-muted-foreground">No trip requests yet. Post one and let hosts compete!</p>
                <Link href="/guest/new-trip">
                  <Button>Create Your First Request</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {trips?.map((trip) => (
            <Link key={trip.id} href={`/guest/trip/${trip.id}`}>
              <Card className="cursor-pointer transition-all hover-elevate hover:shadow-md" data-testid={`card-trip-${trip.id}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{trip.city}</span>
                      <Badge variant={trip.status === "active" ? "default" : "secondary"} data-testid={`status-trip-${trip.id}`}>
                        {trip.status === "active" ? "Active" : "Closed"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(trip.checkIn)} — {formatDate(trip.checkOut)} · {trip.guests} guests · Budget {formatCurrency(trip.budgetTotal)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Bookings */}
      {bookings && bookings.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Your Bookings</h2>
          <div className="space-y-3">
            {bookings.map((booking) => (
              <Link key={booking.id} href={`/guest/booking/${booking.id}`}>
                <Card className="cursor-pointer transition-all hover-elevate hover:shadow-md" data-testid={`card-booking-${booking.id}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Booking #{booking.id}</span>
                        <Badge variant={booking.status === "upcoming" ? "default" : "secondary"}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)} · {formatCurrency(booking.totalPrice)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
