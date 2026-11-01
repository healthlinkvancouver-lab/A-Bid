import { useQuery } from "@tanstack/react-query";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { useUserLookup } from "@/lib/use-user-lookup";
import { API, formatCurrency, formatDate, daysBetween } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Home, DollarSign } from "lucide-react";

export default function OwnerBookings() {
  const { user } = useUser();
  const navItems = useNavItems();

  const { data: bookings } = useQuery({
    queryKey: ["/api/owners", user?.id, "bookings"],
    queryFn: () => API.getOwnerBookings(user!.id),
    enabled: !!user,
  });

  const { data: properties } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: API.getProperties,
  });

  const getProperty = (propId: number) => properties?.find(p => p.id === propId);
  const getGuest = useUserLookup(bookings?.map(b => b.guestId) || []);

  const upcoming = bookings?.filter(b => b.status === "upcoming") || [];
  const completed = bookings?.filter(b => b.status === "completed") || [];

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Bookings</h1>
        <p className="text-sm text-muted-foreground">Manage your upcoming and past guest stays</p>
      </div>

      {/* Schedule summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CalendarDays className="h-3 w-3" /> Upcoming</div>
            <p className="text-2xl font-bold" data-testid="text-upcoming-count">{upcoming.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Home className="h-3 w-3" /> Completed</div>
            <p className="text-2xl font-bold" data-testid="text-completed-count">{completed.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="h-3 w-3" /> Total Revenue</div>
            <p className="text-2xl font-bold" data-testid="text-total-revenue">
              {formatCurrency(bookings?.reduce((s, b) => s + b.totalPrice, 0) || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming bookings */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Upcoming Stays</h2>
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No upcoming bookings</CardContent></Card>
          )}
          {upcoming.map((booking) => {
            const prop = getProperty(booking.propertyId);
            const guest = getGuest(booking.guestId);
            const nights = daysBetween(booking.checkIn, booking.checkOut);
            const images = prop ? JSON.parse(prop.images || "[]") : [];
            return (
              <Card key={booking.id} data-testid={`card-booking-${booking.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    {images[0] && <img src={images[0]} alt={prop?.title} className="h-20 w-28 rounded-lg object-cover" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{prop?.title}</h3>
                        <Badge variant="default">Upcoming</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(booking.checkIn)} — {formatDate(booking.checkOut)} · {nights} nights</p>
                      <p className="text-sm text-muted-foreground">Guest: {getGuest(booking.guestId)?.name} · Sleeps {prop?.maxGuests}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatCurrency(booking.totalPrice)}</p>
                      <p className="text-xs text-muted-foreground">Deposit: {formatCurrency(booking.damageDeposit)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Completed bookings */}
      {completed.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Past Stays</h2>
          <div className="space-y-3">
            {completed.map((booking) => {
              const prop = getProperty(booking.propertyId);
              const guest = getGuest(booking.guestId);
              const nights = daysBetween(booking.checkIn, booking.checkOut);
              const images = prop ? JSON.parse(prop.images || "[]") : [];
              return (
                <Card key={booking.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start gap-4">
                      {images[0] && <img src={images[0]} alt={prop?.title} className="h-20 w-28 rounded-lg object-cover opacity-75" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{prop?.title}</h3>
                          <Badge variant="secondary">Completed</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{formatDate(booking.checkIn)} — {formatDate(booking.checkOut)} · {nights} nights</p>
                        <p className="text-sm text-muted-foreground">Guest: {guest?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(booking.totalPrice)}</p>
                        <p className="text-xs text-muted-foreground">Deposit returned</p>
                      </div>
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
