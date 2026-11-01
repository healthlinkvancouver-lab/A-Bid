import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Plus, DollarSign, Calculator, Download } from "lucide-react";

export default function OwnerAccounting() {
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [entryType, setEntryType] = useState("expense");
  const [category, setCategory] = useState("cleaning");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: ledger } = useQuery({
    queryKey: ["/api/owners", user?.id, "ledger"],
    queryFn: () => API.getOwnerLedger(user!.id),
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/owners", user?.id, "stats"],
    queryFn: () => API.getOwnerStats(user!.id),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => API.createLedgerEntry(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owners", user?.id, "ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", user?.id, "stats"] });
      toast({ title: "Entry added", description: "Ledger updated successfully" });
      setShowAddForm(false);
      setAmount(""); setDescription(""); setCategory("cleaning"); setEntryType("expense");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    addMutation.mutate({ type: entryType, category, amount: parseFloat(amount), description, date });
  };

  const sortedLedger = [...(ledger || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExportCSV = () => {
    const headers = ["Date", "Type", "Category", "Amount", "Description"];
    const rows = sortedLedger.map(e => [e.date, e.type, e.category, e.amount, e.description]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `accounting-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "CSV downloaded" });
  };

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Accounting</h1>
        <p className="text-sm text-muted-foreground">Track income, expenses, and profitability at a glance</p>
      </div>

      {/* Stripe Connect onboarding (P0-4) */}
      <ConnectCard />

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold text-primary" data-testid="text-revenue">{formatCurrency(stats?.totalRevenue ?? 0)}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-bold text-destructive" data-testid="text-expenses">{formatCurrency(stats?.totalExpenses ?? 0)}</p>
              </div>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Net Profit</p>
                <p className="text-lg font-bold" data-testid="text-profit">{formatCurrency(stats?.netProfit ?? 0)}</p>
              </div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Margin</p>
                <p className="text-lg font-bold" data-testid="text-margin">
                  {stats && stats.totalRevenue > 0 ? Math.round((stats.netProfit / stats.totalRevenue) * 100) : 0}%
                </p>
              </div>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2" data-testid="button-add-entry">
          <Plus className="h-4 w-4" />
          Add Entry
        </Button>
        <Button variant="outline" onClick={handleExportCSV} className="gap-2" data-testid="button-export">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">New Ledger Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={entryType} onValueChange={setEntryType}>
                    <SelectTrigger data-testid="select-entry-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {entryType === "income" ? (
                        <SelectItem value="booking_revenue">Booking Revenue</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="cleaning">Cleaning</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="taxes">Taxes</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem>
                          <SelectItem value="utilities">Utilities</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Amount (CAD)</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required data-testid="input-amount" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} required data-testid="input-date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} required data-testid="input-description" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={addMutation.isPending} data-testid="button-save-entry">
                  {addMutation.isPending ? "Saving..." : "Save Entry"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ledger table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedLedger.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50" data-testid={`row-ledger-${entry.id}`}>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(entry.date)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={entry.type === "income" ? "text-primary font-medium" : "text-destructive font-medium"}>
                        {entry.type === "income" ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 capitalize text-muted-foreground">{entry.category.replace(/_/g, " ")}</td>
                    <td className="py-2.5 pr-4">{entry.description}</td>
                    <td className={`py-2.5 text-right font-medium ${entry.type === "income" ? "text-primary" : "text-destructive"}`} data-testid={`text-amount-${entry.id}`}>
                      {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedLedger.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">No transactions yet. Add your first entry above.</p>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

/** Stripe Connect onboarding status + action (P0-4). */
function ConnectCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const { data: status, refetch } = useQuery({
    queryKey: ["/api/connect/status"],
    queryFn: API.getConnectStatus,
  });

  // Refresh status when returning from Stripe's hosted onboarding
  useEffect(() => {
    if (window.location.hash.includes("connect=return")) {
      refetch();
      toast({ title: "Welcome back", description: "Checking your Stripe connection status…" });
    }
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { url } = await API.onboardConnect();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No onboarding URL returned");
      }
    } catch (e) {
      toast({
        title: "Couldn't start Stripe onboarding",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!status?.stripeConfigured) {
    return (
      <Card className="mb-6 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Online payouts are not configured yet — the platform owner needs to add Stripe API keys (see STRIPE_SETUP.md).
            Booking payments are currently recorded manually.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status.onboarded) {
    return (
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-primary">Payouts connected</p>
            <p className="text-xs text-muted-foreground">
              Guest payments settle to your bank account via Stripe{status.stripeAccountId ? ` (${status.stripeAccountId})` : ""}.
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary">Active</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">Connect payouts with Stripe</p>
          <p className="text-xs text-muted-foreground">
            Verify your identity and add bank details so guest payments land in your account automatically.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={busy} data-testid="button-stripe-connect">
          {busy ? "Redirecting…" : "Connect with Stripe"}
        </Button>
      </CardContent>
    </Card>
  );
}
