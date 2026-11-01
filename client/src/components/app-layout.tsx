import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/user-context";
import { useTheme } from "@/lib/theme";
import { API, formatTimeAgo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Gavel, CalendarDays, Calculator, Inbox,
  Home, Sun, Moon, Bell, LogOut, Menu, X, Star, Check,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const guestNav: NavItem[] = [
  { href: "/guest/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/guest/new-trip", label: "New Trip Request", icon: Gavel },
  { href: "/guest/ratings", label: "Ratings & Rewards", icon: Star },
];

const ownerNav: NavItem[] = [
  { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/properties", label: "Properties", icon: Home },
  { href: "/owner/requests", label: "Trip Requests", icon: Inbox },
  { href: "/owner/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/owner/accounting", label: "Accounting", icon: Calculator },
  { href: "/owner/ratings", label: "Guest Reviews", icon: Star },
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
];

export function AppLayout({ children, navItems }: { children: React.ReactNode; navItems: NavItem[] }) {
  const { user, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["/api/users", user?.id, "notifications"],
    queryFn: () => API.getUserNotifications(user!.id),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications?.filter(n => !n.read) || [];
      await Promise.all(unread.map(n => API.markNotificationRead(n.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "notifications"] });
    },
  });

  if (!user) {
    return <>{children}</>;
  }

  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const roleColor = user.role === "guest" ? "bg-accent text-accent-foreground" : user.role === "owner" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-40 h-full w-64 shrink-0 border-r border-border bg-sidebar transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="hsl(var(--primary))" />
              <path d="M9 22V13l7-5 7 5v9h-4v-5h-6v5H9z" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="16" cy="10" r="1.5" fill="hsl(35 80% 55%)" />
            </svg>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>ABid</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-3 rounded-lg p-2">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback>{user.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${roleColor}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={async () => {
                await logout();
                toast({ title: "Signed out", description: "See you soon" });
                setLocation("/");
              }}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0" data-testid="popover-notifications">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto text-xs text-primary"
                      onClick={() => markAllReadMutation.mutate()}
                      data-testid="button-mark-all-read"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications?.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <Bell className="mx-auto mb-2 h-6 w-6 opacity-40" />
                      No notifications yet
                    </div>
                  )}
                  {notifications?.map((n) => (
                    <div
                      key={n.id}
                      className={`border-b border-border/50 px-4 py-3 text-sm ${n.read ? "opacity-60" : "bg-accent/20"}`}
                      data-testid={`notification-${n.id}`}
                    >
                      <p className="leading-snug">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatTimeAgo(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function useNavItems() {
  const { user } = useUser();
  if (!user) return [];
  if (user.role === "guest") return guestNav;
  if (user.role === "owner") return ownerNav;
  if (user.role === "admin") return adminNav;
  return [];
}
