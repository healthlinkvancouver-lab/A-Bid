import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, useNavItems } from "@/components/app-layout";
import { useUser } from "@/lib/user-context";
import { API, formatCurrency } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Home, BedDouble, Bath, Users, DollarSign, MapPin, Pencil } from "lucide-react";

export default function OwnerProperties() {
  const { user } = useUser();
  const navItems = useNavItems();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

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

  const [form, setForm] = useState({
    title: "", description: "", address: "", city: "Vancouver",
    bedrooms: "1", bathrooms: "1", maxGuests: "2", nightlyRate: "150",
    images: "", amenities: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => API.createProperty({ ...data, ownerId: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owners", user?.id, "properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owners", user?.id, "stats"] });
      toast({ title: "Property added!", description: "Your new listing is live" });
      setShowForm(false);
      setForm({
        title: "", description: "", address: "", city: "Vancouver",
        bedrooms: "1", bathrooms: "1", maxGuests: "2", nightlyRate: "150",
        images: "", amenities: "",
      });
    },
    onError: () => toast({ title: "Error", description: "Failed to add property", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.address || !form.nightlyRate) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    const images = form.images ? form.images.split(",").map(s => s.trim()).filter(Boolean) : [];
    const amenities = form.amenities ? form.amenities.split(",").map(s => s.trim()).filter(Boolean) : [];
    createMutation.mutate({
      ...form,
      bedrooms: parseInt(form.bedrooms, 10),
      bathrooms: parseInt(form.bathrooms, 10),
      maxGuests: parseInt(form.maxGuests, 10),
      nightlyRate: parseFloat(form.nightlyRate),
      images: JSON.stringify(images),
      amenities: JSON.stringify(amenities),
    });
  };

  const getBookingCount = (propId: number) => bookings?.filter(b => b.propertyId === propId).length || 0;

  return (
    <AppLayout navItems={navItems}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>My Properties</h1>
          <p className="text-sm text-muted-foreground">Manage your listings and add new properties</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2" data-testid="button-add-property">
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Properties grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {properties?.map((prop) => {
          const images = JSON.parse(prop.images || "[]");
          const amenities = JSON.parse(prop.amenities || "[]");
          const bookingCount = getBookingCount(prop.id);
          return (
            <Card key={prop.id} data-testid={`card-property-${prop.id}`}>
              {images[0] && (
                <div className="relative">
                  <img src={images[0]} alt={prop.title} className="h-40 w-full rounded-t-lg object-cover" />
                  <Badge className="absolute right-2 top-2 bg-primary text-primary-foreground">
                    {bookingCount} {bookingCount === 1 ? "booking" : "bookings"}
                  </Badge>
                </div>
              )}
              <CardContent className="p-4">
                <h3 className="font-semibold">{prop.title}</h3>
                <p className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {prop.address}, {prop.city}
                </p>
                <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{prop.description}</p>
                <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {prop.bedrooms} bed</span>
                  <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {prop.bathrooms} bath</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {prop.maxGuests} guests</span>
                </div>
                {amenities.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {amenities.slice(0, 5).map((a: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{a}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-lg font-bold text-primary" data-testid={`text-rate-${prop.id}`}>
                    {formatCurrency(prop.nightlyRate)}<span className="text-xs text-muted-foreground">/night</span>
                  </span>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {properties?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Home className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">No properties yet. Add your first listing!</p>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Property
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Property Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-add-property">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Add New Property</DialogTitle>
            <DialogDescription>Create a new listing for guests to discover</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Downtown Loft with City Views"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Modern loft in the heart of downtown. Walking distance to everything."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                data-testid="input-description"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  placeholder="456 Homer St"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  data-testid="input-address"
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="Vancouver"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  data-testid="input-city"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Bedrooms</Label>
                <Select value={form.bedrooms} onValueChange={v => setForm({ ...form, bedrooms: v })}>
                  <SelectTrigger data-testid="select-bedrooms"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bathrooms</Label>
                <Select value={form.bathrooms} onValueChange={v => setForm({ ...form, bathrooms: v })}>
                  <SelectTrigger data-testid="select-bathrooms"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Guests</Label>
                <Select value={form.maxGuests} onValueChange={v => setForm({ ...form, maxGuests: v })}>
                  <SelectTrigger data-testid="select-guests"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nightly Rate *</Label>
                <Input
                  type="number"
                  placeholder="150"
                  value={form.nightlyRate}
                  onChange={e => setForm({ ...form, nightlyRate: e.target.value })}
                  data-testid="input-rate"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Image URLs (comma-separated)</Label>
              <Input
                placeholder="https://images.unsplash.com/photo-1..., https://images.unsplash.com/photo-2..."
                value={form.images}
                onChange={e => setForm({ ...form, images: e.target.value })}
                data-testid="input-images"
              />
            </div>
            <div className="space-y-2">
              <Label>Amenities (comma-separated)</Label>
              <Input
                placeholder="WiFi, Kitchen, Parking, AC, Washer"
                value={form.amenities}
                onChange={e => setForm({ ...form, amenities: e.target.value })}
                data-testid="input-amenities"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-property">
                {createMutation.isPending ? "Saving..." : "Add Property"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
