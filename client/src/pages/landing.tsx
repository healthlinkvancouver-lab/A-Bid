import { Link } from "wouter";
import { useUser, dashboardRouteFor } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { Gavel, Home, ArrowRight, Sparkles } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

export default function Landing() {
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill="hsl(var(--primary))" />
            <path d="M9 22V13l7-5 7 5v9h-4v-5h-6v5H9z" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="16" cy="10" r="1.5" fill="hsl(35 80% 55%)" />
          </svg>
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>ABid</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </header>

      {/* Hero */}
      <section className="px-6 py-12 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent-foreground" />
            Reverse-bidding marketplace for short-term rentals
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
            Name your price.
            <br />
            <span className="text-primary">Let hosts compete for your stay.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Post your trip details and budget. Verified property owners bid against each other to win your booking — you get the best possible price, every time.
          </p>
        </div>
      </section>

      {/* Get started */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-3 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Ready to name your price?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Create a free account as a traveler to post trip requests, or as a property owner to start bidding on them.
          </p>
          <div className="flex justify-center gap-3">
            {user ? (
              <Link href={dashboardRouteFor(user.role)}>
                <Button size="lg" data-testid="button-dashboard">
                  Go to your dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="lg" data-testid="button-get-started">
                    Get started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" data-testid="button-sign-in">
                    Sign in
                  </Button>
                </Link>
              </>
            )}
          </div>
          {!user && (
            <p className="mt-6 text-xs text-muted-foreground">
              Exploring the demo? Sign in with sarah@example.com (traveler), jen@example.com (owner), or admin@example.com — password <code>abid-demo-2026</code>
            </p>
          )}
        </div>
      </section>

      {/* Feature highlights */}
      <section className="border-t border-border bg-card/50 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          <FeatureHighlight
            icon={Gavel}
            title="Reverse Bidding"
            description="Guests post their budget. Hosts compete with their best offers. Everyone wins with market-driven pricing."
          />
          <FeatureHighlight
            icon={Sparkles}
            title="Payment Plans"
            description="Split bookings into deposits, installments, and final payments. Damage deposits held securely."
          />
          <FeatureHighlight
            icon={Home}
            title="Owner Tools"
            description="Accounting, scheduling, and booking management at the touch of a button. Track revenue and expenses."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureHighlight({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div>
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
