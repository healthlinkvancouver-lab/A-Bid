import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./lib/theme";
import { UserProvider, useUser } from "./lib/user-context";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import GuestDashboard from "@/pages/guest/dashboard";
import NewTripRequest from "@/pages/guest/new-trip";
import TripDetails from "@/pages/guest/trip-details";
import BookingDetails from "@/pages/guest/booking-details";
import GuestRatings from "@/pages/guest/ratings";
import OwnerDashboard from "@/pages/owner/dashboard";
import OwnerRequests from "@/pages/owner/requests";
import OwnerBookings from "@/pages/owner/bookings";
import OwnerAccounting from "@/pages/owner/accounting";
import OwnerRatings from "@/pages/owner/ratings";
import OwnerProperties from "@/pages/owner/properties";
import AdminDashboard from "@/pages/admin/dashboard";

/** Redirects to /login when there is no signed-in session (P0-3). */
function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useUser();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to="/" />;
  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      {/* Guest */}
      <Route path="/guest/dashboard">{() => <RequireAuth roles={["guest", "admin"]}><GuestDashboard /></RequireAuth>}</Route>
      <Route path="/guest/new-trip">{() => <RequireAuth roles={["guest", "admin"]}><NewTripRequest /></RequireAuth>}</Route>
      <Route path="/guest/trip/:id">{() => <RequireAuth roles={["guest", "admin"]}><TripDetails /></RequireAuth>}</Route>
      <Route path="/guest/booking/:id">{() => <RequireAuth roles={["guest", "admin"]}><BookingDetails /></RequireAuth>}</Route>
      <Route path="/guest/ratings">{() => <RequireAuth roles={["guest", "admin"]}><GuestRatings /></RequireAuth>}</Route>
      {/* Owner */}
      <Route path="/owner/dashboard">{() => <RequireAuth roles={["owner", "admin"]}><OwnerDashboard /></RequireAuth>}</Route>
      <Route path="/owner/requests">{() => <RequireAuth roles={["owner", "admin"]}><OwnerRequests /></RequireAuth>}</Route>
      <Route path="/owner/bookings">{() => <RequireAuth roles={["owner", "admin"]}><OwnerBookings /></RequireAuth>}</Route>
      <Route path="/owner/accounting">{() => <RequireAuth roles={["owner", "admin"]}><OwnerAccounting /></RequireAuth>}</Route>
      <Route path="/owner/ratings">{() => <RequireAuth roles={["owner", "admin"]}><OwnerRatings /></RequireAuth>}</Route>
      <Route path="/owner/properties">{() => <RequireAuth roles={["owner", "admin"]}><OwnerProperties /></RequireAuth>}</Route>
      {/* Admin */}
      <Route path="/admin/dashboard">{() => <RequireAuth roles={["admin"]}><AdminDashboard /></RequireAuth>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ThemeProvider>
          <UserProvider>
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </UserProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
