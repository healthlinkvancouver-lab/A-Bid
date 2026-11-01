import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, dashboardRouteFor } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function Login() {
  const { user, loading, login, register } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // register form
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [role, setRole] = useState<"guest" | "owner">("guest");

  if (!loading && user) {
    setLocation(dashboardRouteFor(user.role));
    return null;
  }

  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message.replace(/^\d+:\s*/, "") : "Something went wrong";
    try {
      const parsed = JSON.parse(msg.replace(/^[^{]*/, ""));
      toast({ title: "Couldn't sign in", description: parsed.message || msg, variant: "destructive" });
    } catch {
      toast({ title: "Couldn't sign in", description: msg, variant: "destructive" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      toast({ title: `Welcome back, ${u.name}` });
      setLocation(dashboardRouteFor(u.role));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register(name, regEmail, regPassword, role);
      toast({ title: `Welcome, ${u.name}`, description: `Account created as ${role}` });
      setLocation(dashboardRouteFor(u.role));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>ABid</CardTitle>
          <CardDescription>Sign in to your account or create a new one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-login">Sign in</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email" placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="input-password" />
                </div>
                <Button type="submit" className="w-full" disabled={busy} data-testid="button-login">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Demo accounts: sarah@example.com, jen@example.com, admin@example.com — password <code>abid-demo-2026</code>
                </p>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={name} onChange={e => setName(e.target.value)} data-testid="input-name" placeholder="Alex Rivera" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regEmail">Email</Label>
                  <Input id="regEmail" type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} data-testid="input-register-email" placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regPassword">Password (min 8 characters)</Label>
                  <Input id="regPassword" type="password" required minLength={8} value={regPassword} onChange={e => setRegPassword(e.target.value)} data-testid="input-register-password" />
                </div>
                <div className="space-y-2">
                  <Label>I am a…</Label>
                  <RadioGroup value={role} onValueChange={v => setRole(v as "guest" | "owner")} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="guest" id="role-guest" />
                      <Label htmlFor="role-guest">Traveler</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="owner" id="role-owner" />
                      <Label htmlFor="role-owner">Property owner</Label>
                    </div>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={busy} data-testid="button-register">
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
