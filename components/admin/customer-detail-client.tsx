"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Car,
  FileText,
  AlertCircle,
  Pencil,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTime12h } from "@/lib/time";
import { EditCustomerForm } from "@/components/forms";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  customerId: Id<"users">;
};

export default function CustomerDetailClient({ customerId }: Props) {
  const router = useRouter();
  const customerData = useQuery(api.users.getByIdWithDetails, { userId: customerId });
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    year: "",
    make: "",
    model: "",
    size: "medium" as "small" | "medium" | "large",
    color: "",
    licensePlate: "",
    notes: "",
  });
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);
  const createVehicle = useMutation(api.vehicles.create);

  const resetVehicleForm = () => {
    setNewVehicle({
      year: "",
      make: "",
      model: "",
      size: "medium",
      color: "",
      licensePlate: "",
      notes: "",
    });
  };

  const handleCreateVehicle = async () => {
    if (!newVehicle.year || !newVehicle.make.trim() || !newVehicle.model.trim()) {
      toast.error("Vehicle year, make, and model are required");
      return;
    }

    setIsCreatingVehicle(true);
    try {
      await createVehicle({
        userId: customerId,
        year: Number(newVehicle.year),
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        size: newVehicle.size,
        color: newVehicle.color.trim() || undefined,
        licensePlate: newVehicle.licensePlate.trim() || undefined,
        notes: newVehicle.notes.trim() || undefined,
      });

      toast.success("Vehicle added successfully");
      resetVehicleForm();
      setShowAddVehicleForm(false);
      router.refresh();
    } catch {
      toast.error("Failed to add vehicle");
    } finally {
      setIsCreatingVehicle(false);
    }
  };

  if (customerData === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (customerData === null) {
    return (
      <div className="space-y-6">
        <Link href="/admin/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customers
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Customer Not Found</h3>
            <p className="text-muted-foreground mb-6">
              The customer you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link href="/admin/customers">
              <Button>Return to Customers</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, appointments, invoices, vehicles } = customerData;

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (date: string, time: string) => {
    return `${formatDate(date)} at ${formatTime12h(time)}`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      confirmed: "default",
      in_progress: "secondary",
      completed: "default",
      cancelled: "destructive",
      rescheduled: "outline",
      draft: "outline",
      sent: "secondary",
      paid: "default",
      overdue: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold">{user.name || "Unknown Customer"}</h2>
            <p className="text-muted-foreground">
              Customer since {formatDate(new Date(user._creationTime).toISOString())}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
          <Pencil className="w-4 h-4 mr-2" />
          Edit Customer
        </Button>
      </div>

      {/* Customer Info Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(user.totalSpent || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.timesServiced || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
            <Car className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="font-medium">{user.email || "No email"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Phone</div>
                <div className="font-medium">{user.phone || "No phone"}</div>
              </div>
            </div>
            {user.address && (
              <div className="flex items-center gap-3 md:col-span-2">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Address</div>
                  <div className="font-medium">
                    {user.address.street}
                    <br />
                    {user.address.city}, {user.address.state} {user.address.zip}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>Appointments ({appointments.length})</CardTitle>
          <CardDescription>All appointments for this customer</CardDescription>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No appointments found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {appointments.map((apt: any) => (
                <Link
                  key={apt._id}
                  href={`/admin/appointments/${apt._id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="font-semibold">
                        {formatDateTime(apt.scheduledDate, apt.scheduledTime)}
                      </div>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {apt.services.length > 0
                        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          apt.services.map((s: any) => s.name).join(", ")
                        : "No services"}{" "}
                      • {apt.vehicles.length} vehicle(s)
                    </div>
                    {apt.notes && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Notes: {apt.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${apt.totalPrice.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      {apt.city}, {apt.state}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices ({invoices.length})</CardTitle>
          <CardDescription>All invoices for this customer</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No invoices found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {invoices.map((invoice: any) => (
                  <TableRow
                    key={invoice._id}
                    className="cursor-pointer hover:bg-secondary/50"
                    onClick={() => router.push(`/admin/invoices/${invoice._id}`)}
                  >
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      {formatDate(new Date(invoice._creationTime).toISOString())}
                    </TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>${invoice.total.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Vehicles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Vehicles ({vehicles.length})</CardTitle>
            <CardDescription>All vehicles registered to this customer</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddVehicleForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No vehicles registered</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {vehicles.map((vehicle: any) => (
                <div
                  key={vehicle._id}
                  className="p-4 rounded-lg border border-border"
                >
                  <div className="font-semibold text-lg mb-2">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Color: {vehicle.color}</div>
                    {vehicle.licensePlate && (
                      <div>License: {vehicle.licensePlate}</div>
                    )}
                    {vehicle.size && (
                      <div>Size: {vehicle.size.charAt(0).toUpperCase() + vehicle.size.slice(1)}</div>
                    )}
                    {vehicle.notes && <div>Notes: {vehicle.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditCustomerForm
        open={showEditForm}
        onOpenChange={setShowEditForm}
        customer={user}
      />

      <Dialog open={showAddVehicleForm} onOpenChange={setShowAddVehicleForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Vehicle</DialogTitle>
            <DialogDescription>
              Enter vehicle details to add to this customer&apos;s profile
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle-year">Year</Label>
                <Input
                  id="vehicle-year"
                  type="number"
                  placeholder="2024"
                  value={newVehicle.year}
                  onChange={(e) =>
                    setNewVehicle((prev) => ({ ...prev, year: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-make">Make</Label>
                <Input
                  id="vehicle-make"
                  placeholder="Toyota"
                  value={newVehicle.make}
                  onChange={(e) =>
                    setNewVehicle((prev) => ({ ...prev, make: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-model">Model</Label>
              <Input
                id="vehicle-model"
                placeholder="Camry"
                value={newVehicle.model}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, model: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle-size">Size</Label>
                <Select
                  value={newVehicle.size}
                  onValueChange={(val) =>
                    setNewVehicle((prev) => ({
                      ...prev,
                      size: val as "small" | "medium" | "large",
                    }))
                  }
                >
                  <SelectTrigger id="vehicle-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-color">Color</Label>
                <Input
                  id="vehicle-color"
                  placeholder="Silver"
                  value={newVehicle.color}
                  onChange={(e) =>
                    setNewVehicle((prev) => ({ ...prev, color: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-license">License Plate</Label>
              <Input
                id="vehicle-license"
                placeholder="ABC-123"
                value={newVehicle.licensePlate}
                onChange={(e) =>
                  setNewVehicle((prev) => ({
                    ...prev,
                    licensePlate: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-notes">Notes</Label>
              <Textarea
                id="vehicle-notes"
                placeholder="Any special notes about this vehicle"
                value={newVehicle.notes}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreateVehicle}
              disabled={isCreatingVehicle || !newVehicle.year || !newVehicle.make || !newVehicle.model}
            >
              {isCreatingVehicle ? "Adding Vehicle..." : "Add Vehicle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

