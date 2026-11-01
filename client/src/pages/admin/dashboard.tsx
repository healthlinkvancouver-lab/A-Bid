import { useQuery } from "@tanstack/react-query";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { API, formatCurrency, formatDate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Home, Gavel, DollarSign, CalendarDays, Star, Shield } from "lucide-react";

export default function AdminDashboard() {
  const navItems = useNavItems();

  const { data: users } = useQuery({ queryKey: ["/api/users"], queryFn: API.getUsers });
  const { data: properties } = useQuery({ queryKey: ["/api/properties"], queryFn: API.getProperties });
  const { data: bookings } = useQuery({ queryKey: ["/api/bookings"], queryFn: API.getAllBookings });
  const { data: tripRequests } = useQuery({ queryKey: ["/api/trip-requests"], queryFn: API.getActiveTripRequests });

  const guests = users?.filter(u => u.role === "guest") || [];
  const owners = users?.filter(u => u.role === "owner") || [];
  const totalRevenue = bookings?.reduce((s, b) => s + b.totalPrice, 0) || 0;
  const upcomingBookings = bookings?.filter(b => b.status === "upcoming") || [];
  const completedBookings = bookings?.filter(b => b.status === "completed") || [];

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Admin Overview</h1>
        <p className="text-sm text-muted-foreground">Platform-wide metrics and activity monitoring</p>
      </div>

      {/* Platform stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={users?.length || 0} subtext={`${guests.length} guests, ${owners.length} owners`} />
        <StatCard icon={Home} label="Properties" value={properties?.length || 0} />
        <StatCard icon={Gavel} label="Active Requests" value={tripRequests?.length || 0} />
        <StatCard icon={DollarSign} label="Total Bookings" value={bookings?.length || 0} subtext={formatCurrency(totalRevenue)} />
      </div>

      {/* Revenue + booking status */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="h-3 w-3" /> Platform Revenue</div>
            <p className="text-2xl font-bold text-primary" data-testid="text-platform-revenue">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CalendarDays className="h-3 w-3" /> Upcoming</div>
            <p className="text-2xl font-bold" data-testid="text-admin-upcoming">{upcomingBookings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Star className="h-3 w-3" /> Completed</div>
            <p className="text-2xl font-bold" data-testid="text-admin-completed">{completedBookings.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-border/50" data-testid={`row-user-${u.id}`}>
                    <td className="py-2.5 pr-4 font-medium">{u.name}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={u.role === "admin" ? "destructive" : u.role === "owner" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{u.email}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* All bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">Dates</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Total</th>
                  <th className="pb-2 text-right font-medium">Deposit</th>
                </tr>
              </thead>
              <tbody>
                {bookings?.map((b) => (
                  <tr key={b.id} className="border-b border-border/50" data-testid={`row-admin-booking-${b.id}`}>
                    <td className="py-2.5 pr-4 font-medium">#{b.id}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(b.checkIn)} — {formatDate(b.checkOut)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={b.status === "upcoming" ? "default" : "secondary"}>{b.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 font-medium">{formatCurrency(b.totalPrice)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{formatCurrency(b.damageDeposit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, subtext }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; subtext?: string }) {
  return (
    <Card data-testid={`card-admin-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
          </div>
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
