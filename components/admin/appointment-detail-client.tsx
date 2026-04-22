"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Car,
  DollarSign,
  FileText,
  AlertCircle,
  Wrench,
  Pencil,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { formatDateStringLong } from "@/lib/time";

type Props = {
  appointmentId: Id<"appointments">;
};

function getStatusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "pending":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "in_progress":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "completed":
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getEffectivePrice(
  service: { basePrice?: number; basePriceSmall?: number; basePriceMedium?: number; basePriceLarge?: number },
  size: string,
): number {
  const fallback = service.basePrice ?? 0;
  if (size === "small") return service.basePriceSmall ?? service.basePriceMedium ?? fallback;
  if (size === "large") return service.basePriceLarge ?? service.basePriceMedium ?? fallback;
  return service.basePriceMedium ?? fallback;
}

export default function AppointmentDetailClient({ appointmentId }: Props) {
  const router = useRouter();
  const data = useQuery(api.appointments.getByIdWithDetails, { appointmentId });
  const customerVehiclesQuery = useQuery(
    api.vehicles.getByUser,
    data?.userId ? { userId: data.userId } : "skip",
  );
  const allServices = useQuery(api.services.list);
  const updateStatus = useMutation(api.appointments.updateStatus);
  const updateAppointment = useMutation(api.appointments.update);
  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const updateBillingSettings = useMutation(api.invoices.updateBillingSettings);
  const reissueStripeInvoice = useAction(api.payments.reissueStripeInvoice);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [billingDueDate, setBillingDueDate] = useState("");
  const [billingMethod, setBillingMethod] = useState<
    "send_invoice" | "charge_automatically"
  >("send_invoice");
  const [billingLoading, setBillingLoading] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editLocationNotes, setEditLocationNotes] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editServiceIds, setEditServiceIds] = useState<Id<"services">[]>([]);
  const [editVehicleIds, setEditVehicleIds] = useState<Id<"vehicles">[]>([]);
  const [editVehicleSizes, setEditVehicleSizes] = useState<Record<string, string>>({});
  const [editPetFeeVehicleIds, setEditPetFeeVehicleIds] = useState<Id<"vehicles">[]>([]);

  useEffect(() => {
    if (!data?.invoice) return;
    setBillingDueDate(data.invoice.dueDate);
    setBillingMethod(
      data.invoice.remainingBalanceCollectionMethod ?? "send_invoice",
    );
  }, [data?.invoice]);

  if (data === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><div className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div></CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><div className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/appointments"><ArrowLeft className="mr-2 h-4 w-4" />Back to Appointments</Link>
        </Button>
        <Card className="py-12 text-center">
          <CardContent>
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Appointment not found</h3>
            <p className="text-muted-foreground">This appointment may have been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStatusUpdate = async (
    newStatus: "confirmed" | "in_progress" | "completed" | "cancelled",
  ) => {
    setLoading(true);
    try {
      await updateStatus({ appointmentId, status: newStatus });
      toast.success(`Appointment ${newStatus.replace("_", " ")}`);
      router.refresh();
    } catch {
      toast.error("Failed to update appointment status");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    setEditDate(data.scheduledDate);
    setEditTime(data.scheduledTime);
    setEditStreet(data.location.street);
    setEditCity(data.location.city);
    setEditState(data.location.state);
    setEditZip(data.location.zip);
    setEditLocationNotes(data.location.notes || "");
    setEditNotes(data.notes || "");
    setEditServiceIds(data.serviceIds);
    setEditVehicleIds(
      data.vehicles.length > 0
        ? data.vehicles.map((vehicle) => vehicle._id)
        : (customerVehiclesQuery?.length === 1
            ? [customerVehiclesQuery[0]._id]
            : []),
    );
    setEditPetFeeVehicleIds(data.petFeeVehicleIds ?? []);
    const sizes: Record<string, string> = {};
    for (const v of customerVehiclesQuery || data.vehicles) {
      sizes[v._id] = v.size || "medium";
    }
    setEditVehicleSizes(sizes);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (editVehicleIds.length === 0) {
      toast.error("Select at least one customer vehicle before saving");
      return;
    }

    setLoading(true);
    try {
      // Update vehicle sizes first
      for (const v of customerVehiclesQuery || data.vehicles) {
        if (!editVehicleIds.includes(v._id)) {
          continue;
        }
        const newSize = editVehicleSizes[v._id] as "small" | "medium" | "large" | undefined;
        if (newSize && newSize !== (v.size || "medium")) {
          await updateVehicle({ id: v._id, size: newSize });
        }
      }

      // Update the appointment (triggers price recalculation + invoice sync)
      await updateAppointment({
        appointmentId,
        userId: data.userId,
        vehicleIds: editVehicleIds,
        serviceIds: editServiceIds,
        scheduledDate: editDate,
        scheduledTime: editTime,
        street: editStreet,
        city: editCity,
        state: editState,
        zip: editZip,
        locationNotes: editLocationNotes || undefined,
        notes: editNotes || undefined,
        petFeeVehicleIds: editPetFeeVehicleIds,
      });

      toast.success("Appointment updated — pricing recalculated");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update appointment");
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId: Id<"services">) => {
    setEditServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId],
    );
  };

  const toggleVehicle = (vehicleId: Id<"vehicles">, checked: boolean) => {
    setEditVehicleIds((prev) =>
      checked ? [...prev, vehicleId] : prev.filter((id) => id !== vehicleId),
    );
    if (!checked) {
      setEditPetFeeVehicleIds((prev) => prev.filter((id) => id !== vehicleId));
    }
  };

  const togglePetFeeVehicle = (vehicleId: Id<"vehicles">, checked: boolean) => {
    if (checked) {
      setEditVehicleIds((prev) =>
        prev.includes(vehicleId) ? prev : [...prev, vehicleId],
      );
      setEditPetFeeVehicleIds((prev) =>
        prev.includes(vehicleId) ? prev : [...prev, vehicleId],
      );
      return;
    }
    setEditPetFeeVehicleIds((prev) => prev.filter((id) => id !== vehicleId));
  };

  const handleBillingSave = async (reissue: boolean) => {
    if (!data.invoice) {
      toast.error("No invoice found for this appointment");
      return;
    }
    if (!billingDueDate) {
      toast.error("Select a due date first");
      return;
    }
    if (canReissueBilling && !reissue) {
      toast.error("Use Save & Reissue to update the live Stripe invoice");
      return;
    }

    setBillingLoading(true);
    try {
      await updateBillingSettings({
        invoiceId: data.invoice._id,
        dueDate: billingDueDate,
        remainingBalanceCollectionMethod: billingMethod,
      });
      if (reissue) {
        await reissueStripeInvoice({ invoiceId: data.invoice._id });
        toast.success("Billing settings saved and Stripe invoice reissued");
      } else {
        toast.success("Billing settings updated");
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update billing settings",
      );
    } finally {
      setBillingLoading(false);
    }
  };

  const { user, services, vehicles, invoice, tripLog, location } = data;
  const customerVehicles = customerVehiclesQuery ?? [];
  const canEdit = data.status === "pending" || data.status === "confirmed";
  const canEditBilling =
    !!invoice &&
    (invoice.paymentOption ?? "deposit") === "deposit" &&
    (invoice.remainingBalance ?? 0) > 0 &&
    invoice.status !== "paid";
  const canReissueBilling = canEditBilling && !!invoice?.stripeInvoiceId;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/admin/appointments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Appointments
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" variant="outline" onClick={cancelEditing} disabled={loading}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
          {!editing && (
            <>
              {data.status === "pending" && (
                <Button size="sm" onClick={() => handleStatusUpdate("confirmed")} disabled={loading}>
                  Confirm & Invoice
                </Button>
              )}
              {data.status === "confirmed" && (
                <Button size="sm" onClick={() => handleStatusUpdate("in_progress")} disabled={loading}>
                  Start
                </Button>
              )}
              {data.status === "in_progress" && (
                <Button size="sm" onClick={() => handleStatusUpdate("completed")} disabled={loading}>
                  Complete
                </Button>
              )}
              {data.status !== "cancelled" && data.status !== "completed" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStatusUpdate("cancelled")}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Appointment Details</h2>
          <p className="text-muted-foreground">
            {formatDateStringLong(data.scheduledDate)} at {data.scheduledTime}
          </p>
        </div>
        <Badge variant="outline" className={getStatusColor(data.status)}>
          {data.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Pending deposit notice */}
      {data.status === "pending" && invoice?.depositPaid && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Deposit paid — review details and confirm to generate the Stripe invoice for the remaining balance.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                {(user?.name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{user?.name || "Unknown"}</p>
                {user?.email && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </div>
                )}
              </div>
            </div>
            {user?.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {user.phone}
              </div>
            )}
            {user && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/customers/${user._id}`}>View Customer Profile</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Schedule & Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule & Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Time</Label>
                    <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Street</Label>
                  <Input value={editStreet} onChange={(e) => setEditStreet(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">State</Label>
                    <Input value={editState} onChange={(e) => setEditState(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Zip</Label>
                    <Input value={editZip} onChange={(e) => setEditZip(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Location Notes</Label>
                  <Input value={editLocationNotes} onChange={(e) => setEditLocationNotes(e.target.value)} placeholder="Gate code, instructions..." />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDateStringLong(data.scheduledDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{data.scheduledTime} ({data.duration} min)</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{location.street}</p>
                    <p>{location.city}, {location.state} {location.zip}</p>
                    {location.notes && (
                      <p className="text-muted-foreground mt-1">{location.notes}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicles ({editing ? editVehicleIds.length : vehicles.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.vehicleIds.length !== vehicles.length && (
              <div className="mb-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                Some saved vehicle records linked to this appointment are missing. The appointment may need repair.
              </div>
            )}
            {editing ? (
              customerVehiclesQuery === undefined ? (
                <p className="text-sm text-muted-foreground">
                  Loading customer vehicles...
                </p>
              ) : customerVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This customer has no saved vehicles yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {customerVehicles.map((v) => {
                    const checked = editVehicleIds.includes(v._id);
                    const hasPetFee = editPetFeeVehicleIds.includes(v._id);
                    return (
                      <div
                        key={v._id}
                        className="rounded-md border p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleVehicle(v._id, value === true)
                              }
                              className="mt-1"
                            />
                            <div>
                              <p className="font-medium text-sm">
                                {v.year} {v.make} {v.model}
                              </p>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                {v.color && <span>{v.color}</span>}
                                {v.licensePlate && <span>{v.licensePlate}</span>}
                              </div>
                            </div>
                          </div>
                          <Select
                            value={editVehicleSizes[v._id] || "medium"}
                            onValueChange={(val) =>
                              setEditVehicleSizes((prev) => ({ ...prev, [v._id]: val }))
                            }
                            disabled={!checked}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="mt-3 flex items-center gap-2 border-t pt-3">
                          <Checkbox
                            checked={hasPetFee}
                            onCheckedChange={(value) =>
                              togglePetFeeVehicle(v._id, value === true)
                            }
                          />
                          <span className="text-sm text-muted-foreground">
                            Apply pet fee to this vehicle
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicles linked</p>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div key={v._id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{v.year} {v.make} {v.model}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {v.color && <span>{v.color}</span>}
                          {v.licensePlate && <span>{v.licensePlate}</span>}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {v.size || "medium"}
                    </Badge>
                    {(data.petFeeVehicleIds ?? []).includes(v._id) && (
                      <Badge variant="outline">Pet fee</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Services ({editing ? editServiceIds.length : services.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-2">
                {(allServices || [])
                  .filter((s) => s.isActive)
                  .map((s) => {
                    const isSelected = editServiceIds.includes(s._id);
                    const editVehicleSize = vehicles[0] ? (editVehicleSizes[vehicles[0]._id] || "medium") : "medium";
                    const price = getEffectivePrice(s, editVehicleSize);
                    return (
                      <div
                        key={s._id}
                        className={`flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleService(s._id)}
                      >
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.duration} min</p>
                        </div>
                        <span className="text-sm font-medium">{formatCurrency(price)}</span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((s) => (
                  <div key={s._id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration} min</p>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(s.effectivePrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment / Invoice */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold">{formatCurrency(data.totalPrice)}</span>
            </div>
            {invoice && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <Badge variant="outline">{invoice.status}</Badge>
                </div>
                {invoice.depositPaid && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Deposit</span>
                    <span>{formatCurrency(invoice.depositAmount || 0)} paid</span>
                  </div>
                )}
                {invoice.remainingBalance != null && invoice.remainingBalance > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span>{formatCurrency(invoice.remainingBalance)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Collection</span>
                  <span className="capitalize">
                    {(invoice.remainingBalanceCollectionMethod ?? "send_invoice").replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Due date</span>
                  <span>{invoice.dueDate}</span>
                </div>
              </>
            )}
            {!invoice && (
              <p className="text-sm text-muted-foreground">No invoice created yet</p>
            )}
            {canEditBilling && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="appointment-billing-due-date" className="text-xs">
                      Due date
                    </Label>
                    <Input
                      id="appointment-billing-due-date"
                      type="date"
                      value={billingDueDate}
                      onChange={(event) => setBillingDueDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Collection method</Label>
                    <Select
                      value={billingMethod}
                      onValueChange={(value) =>
                        setBillingMethod(
                          value as "send_invoice" | "charge_automatically",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send_invoice">Send invoice</SelectItem>
                        <SelectItem value="charge_automatically">
                          Charge automatically
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canReissueBilling && (
                    <p className="w-full text-xs text-muted-foreground">
                      This invoice already exists in Stripe. Reissue it to apply the updated terms there too.
                    </p>
                  )}
                  {!canReissueBilling && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleBillingSave(false)}
                      disabled={billingLoading}
                    >
                      {billingLoading ? "Saving..." : "Save Billing"}
                    </Button>
                  )}
                  {canReissueBilling && (
                    <Button
                      size="sm"
                      onClick={() => void handleBillingSave(true)}
                      disabled={billingLoading}
                    >
                      {billingLoading ? "Reissuing..." : "Save & Reissue"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trip Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Trip Log
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tripLog ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={tripLog.status === "completed" ? "default" : "secondary"} className="capitalize">
                    {tripLog.status}
                  </Badge>
                </div>
                {tripLog.finalMiles != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Miles</span>
                    <span>{tripLog.finalMiles.toFixed(1)}</span>
                  </div>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/logs/${tripLog._id}`}>Open Trip Log</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {data.status === "completed" ? "Trip log required" : "No trip log yet"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
            />
          </CardContent>
        </Card>
      ) : data.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
