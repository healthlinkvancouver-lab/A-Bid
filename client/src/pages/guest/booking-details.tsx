import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency, formatDate, daysBetween } from "@/lib/api";
import type { Payment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CalendarDays, DollarSign, Home, CheckCircle2, Clock, CreditCard } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

export default function BookingDetails() {
  const { id } = useParams();
  const bookingId = parseInt(id!, 10);
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: booking } = useQuery({
    queryKey: ["/api/bookings", bookingId],
    queryFn: () => API.getBooking(bookingId),
  });

  const { data: payments } = useQuery({
    queryKey: ["/api/bookings", bookingId, "payments"],
    queryFn: () => API.getBookingPayments(bookingId),
  });

  const { data: properties } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: API.getProperties,
  });

  const { data: config } = useQuery({
    queryKey: ["/api/config"],
    queryFn: API.getConfig,
  });
  const stripeConfigured = !!config?.stripeConfigured && !!config?.stripePublishableKey;

  const [payingPayment, setPayingPayment] = useState<Payment | null>(null);

  const refreshPayments = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bookings", bookingId, "payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/guests", user?.id, "stats"] });
  };

  const payMutation = useMutation({
    mutationFn: (paymentId: number) => API.payPayment(paymentId),
    onSuccess: () => {
      refreshPayments();
      toast({ title: "Payment successful!", description: "Your payment has been processed" });
    },
  });

  const property = booking ? properties?.find(p => p.id === booking.propertyId) : null;
  const nights = booking ? daysBetween(booking.checkIn, booking.checkOut) : 0;
  const totalPaid = payments?.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0) || 0;
  const totalDue = booking ? booking.totalPrice + booking.damageDeposit : 0;
  const paymentProgress = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
  const images = property ? JSON.parse(property.images || "[]") : [];

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6">
        <Link href="/guest/dashboard">
          <Button variant="ghost" size="sm" className="mb-2 gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Booking Details</h1>
      </div>

      {booking && (
        <>
          {/* Property + booking summary */}
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                {images[0] && (
                  <img src={images[0]} alt={property?.title} className="h-24 w-32 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={booking.status === "upcoming" ? "default" : "secondary"} data-testid="status-booking">
                      {booking.status}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-semibold" data-testid="text-property-title">{property?.title}</h2>
                  <p className="text-sm text-muted-foreground">{property?.address}, {property?.city}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)} · {nights} nights
                    </span>
                  </div>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="mt-5 space-y-2 border-t border-border pt-4">
                <PriceRow label={`Accommodation (${nights} nights)`} value={formatCurrency(booking.totalPrice)} />
                <PriceRow label="Damage deposit (refundable)" value={formatCurrency(booking.damageDeposit)} />
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span data-testid="text-total">{formatCurrency(booking.totalPrice + booking.damageDeposit)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment plan */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress */}
              <div className="mb-5">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{formatCurrency(totalPaid)} paid of {formatCurrency(totalDue)}</span>
                  <span className="font-medium" data-testid="text-payment-progress">{Math.round(paymentProgress)}%</span>
                </div>
                <Progress value={paymentProgress} className="h-2" data-testid="progress-payment" />
              </div>

              {/* Payment schedule */}
              <div className="space-y-3">
                {payments?.map((payment) => (
                  <div
                    key={payment.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      payment.status === "paid" ? "border-primary/30 bg-primary/5" : "border-border"
                    }`}
                    data-testid={`card-payment-${payment.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {payment.status === "paid" ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" data-testid={`icon-paid-${payment.id}`} />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {payment.type === "deposit" ? "Damage Deposit" : payment.type === "final" ? "Final Payment" : "Installment"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.status === "paid"
                            ? `Paid on ${formatDate(payment.paidDate || payment.dueDate)}`
                            : `Due ${formatDate(payment.dueDate)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold" data-testid={`text-payment-amount-${payment.id}`}>
                        {formatCurrency(payment.amount)}
                      </span>
                      {payment.status === "pending" && !stripeConfigured && (
                        <Button
                          size="sm"
                          onClick={() => payMutation.mutate(payment.id)}
                          disabled={payMutation.isPending}
                          data-testid={`button-pay-${payment.id}`}
                        >
                          Pay Now
                        </Button>
                      )}
                      {payment.status === "pending" && stripeConfigured && (
                        <Button
                          size="sm"
                          onClick={() => setPayingPayment(payment)}
                          data-testid={`button-pay-${payment.id}`}
                        >
                          <CreditCard className="mr-1 h-4 w-4" /> Pay Now
                        </Button>
                      )}
                      {payment.status === "paid" && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">Paid</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Damage deposit info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Home className="h-5 w-5 text-primary" />
                Damage Deposit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A refundable damage deposit of <span className="font-semibold text-foreground">{formatCurrency(booking.damageDeposit)}</span> is held securely.
                It will be automatically refunded within 48 hours after check-out, provided no damage is reported by the host.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Stripe card payment dialog (P0-4) */}
      {stripeConfigured && payingPayment && (
        <Dialog open onOpenChange={(open) => { if (!open) setPayingPayment(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pay {formatCurrency(payingPayment.amount)}</DialogTitle>
              <DialogDescription>
                {payingPayment.type === "deposit" ? "Refundable damage deposit" : payingPayment.type === "final" ? "Final payment" : "Installment"} for booking #{bookingId}.
                Your card is charged by A-Bid; the host is paid out via Stripe.
              </DialogDescription>
            </DialogHeader>
            <Elements stripe={loadStripe(config!.stripePublishableKey!)}>
              <StripePayForm
                payment={payingPayment}
                onDone={() => {
                  setPayingPayment(null);
                  refreshPayments();
                  toast({ title: "Payment submitted", description: "Confirmation may take a few seconds" });
                }}
              />
            </Elements>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}

function StripePayForm({ payment, onDone }: { payment: Payment; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setBusy(true);
    try {
      const { clientSecret } = await API.createCheckout(payment.id);
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (error) throw new Error(error.message || "Card payment failed");
      if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
        onDone();
      } else {
        throw new Error(`Payment status: ${paymentIntent?.status}`);
      }
    } catch (err) {
      toast({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border p-3">
        <CardElement options={{ style: { base: { fontSize: "16px" } } }} />
      </div>
      <Button type="submit" className="w-full" disabled={busy || !stripe} data-testid="button-stripe-pay">
        {busy ? "Processing…" : `Pay ${formatCurrency(payment.amount)}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </form>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
