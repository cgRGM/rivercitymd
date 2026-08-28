"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Doc, Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/errors";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Images,
  Tag,
  Plus,
  Search,
  Check,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { formatDateStringLong } from "@/lib/time";
import { normalizeStripeCouponCode } from "@rivercitymd/backend/convex/lib/coupons";
import {
  getEffectiveServicePricingForVehicle,
  type ServiceVehiclePriceShape,
  type VehicleSize,
} from "@rivercitymd/backend/convex/lib/pricing";
import {
  calculateSchedulingDuration,
  DEFAULT_PET_FEE_TIME_MINUTES,
} from "@rivercitymd/backend/convex/lib/booking";
import { calculateTravelBufferMinutesForMiles } from "@rivercitymd/backend/convex/lib/travelFees";

type Props = {
  appointmentId: Id<"appointments">;
};

function getServiceTypeCategory(service: Doc<"services">): "standard" | "addon" | "subscription" {
  const name = (service.name || "").toLowerCase();
  if (
    service.bookingRole === "addon" ||
    service.serviceType === "addon" ||
    name.includes("(add-on)") ||
    name.includes("add-on") ||
    name.includes("addon")
  ) {
    return "addon";
  }
  if (service.serviceType === "subscription") {
    return "subscription";
  }
  return "standard";
}

type AppointmentVehicle = Doc<"vehicles"> & {
  vehicleType?: Doc<"vehicleTypes"> | null;
};

type AppointmentService = Doc<"services"> & {
  effectivePrice?: number;
  vehiclePrices?: ServiceVehiclePriceShape[];
};

type AppointmentBeforePhoto = NonNullable<Doc<"appointments">["beforePhotos"]>[number] & {
  signedUrl?: string;
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

function formatMinutes(minutes: number) {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  if (hours === 0) return `${sign}${remainder} min`;
  if (remainder === 0) return `${sign}${hours} hr`;
  return `${sign}${hours} hr ${remainder} min`;
}

export default function AppointmentDetailClient({ appointmentId }: Props) {
  const router = useRouter();
  const data = useQuery(api.appointments.getByIdWithDetails, { appointmentId });
  const customerVehiclesQuery = useQuery(
    api.vehicles.getByUser,
    data?.userId ? { userId: data.userId } : "skip",
  );
  const vehicleTypes = useQuery(api.vehicleTypes.list, {});
  const allServices = useQuery(api.services.list);
  const petFeeSettings = useQuery(api.petFeeSettings.get);
  const travelFeeSettings = useQuery(api.travelFeeSettings.get);
  const updateStatus = useMutation(api.appointments.updateStatus);
  const updateAppointment = useMutation(api.appointments.update);
  const applyWorkAdjustment = useMutation(api.appointments.applyWorkAdjustment);
  const updateTravelFee = useMutation(api.appointments.updateTravelFee);
  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const createVehicle = useMutation(api.vehicles.create);
  const updateBillingSettings = useMutation(api.invoices.updateBillingSettings);
  const reissueStripeInvoice = useAction(api.payments.reissueStripeInvoice);
  const applyCouponToInvoice = useAction(api.payments.applyCouponToInvoice);
  const removeDiscountFromInvoice = useAction(api.payments.removeDiscountFromInvoice);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [serviceModalVehicleId, setServiceModalVehicleId] = useState<Id<"vehicles"> | null>(null);
  const [serviceModalSearch, setServiceModalSearch] = useState("");
  const [serviceModalTab, setServiceModalTab] = useState<"all" | "standard" | "addon">("all");
  const [billingDueDate, setBillingDueDate] = useState("");
  const [billingMethod, setBillingMethod] = useState<
    "send_invoice" | "charge_automatically"
  >("send_invoice");
  const [billingLoading, setBillingLoading] = useState(false);
  const [travelFeeInput, setTravelFeeInput] = useState<number | "">("");
  const [travelDistanceInput, setTravelDistanceInput] = useState<number | "">("");
  const [travelFeeLoading, setTravelFeeLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    fileName: string;
  } | null>(null);

  // Discount / Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState<number | "">("");
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  const handleApplyDiscount = async () => {
    if (!invoice) return;
    const normalizedCouponCode = normalizeStripeCouponCode(couponCode);
    if (!normalizedCouponCode) {
      toast.error("Please enter a coupon code");
      return;
    }
    const hasManualDiscountValue = discountValue !== "" && Number(discountValue) > 0;

    setIsApplyingDiscount(true);
    try {
      await applyCouponToInvoice({
        invoiceId: invoice._id,
        couponCode: normalizedCouponCode,
        ...(hasManualDiscountValue
          ? { discountType, discountValue: Number(discountValue) }
          : {}),
      });
      toast.success(invoice.couponCode ? "Discount replaced successfully" : "Discount applied successfully");
      setCouponCode("");
      setDiscountValue("");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to apply discount"));
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!invoice) return;
    setIsApplyingDiscount(true);
    try {
      await removeDiscountFromInvoice({
        invoiceId: invoice._id,
      });
      toast.success("Discount removed successfully");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to remove discount"));
    } finally {
      setIsApplyingDiscount(false);
    }
  };

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
  const [editVehicleTypeIds, setEditVehicleTypeIds] = useState<Record<string, string>>({});
  const [editPetFeeVehicleIds, setEditPetFeeVehicleIds] = useState<Id<"vehicles">[]>([]);
  const [editVehicleServices, setEditVehicleServices] = useState<Record<string, Id<"services">[]>>({});
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    year: "",
    make: "",
    model: "",
    color: "",
    size: "medium" as "small" | "medium" | "large",
    licensePlate: "",
    notes: "",
  });

  const resetVehicleForm = () => {
    setNewVehicle({
      year: "",
      make: "",
      model: "",
      color: "",
      size: "medium",
      licensePlate: "",
      notes: "",
    });
  };

  const handleCreateVehicle = async () => {
    if (!data?.userId) return;
    if (!newVehicle.year || !newVehicle.make.trim() || !newVehicle.model.trim()) {
      toast.error("Vehicle year, make, and model are required");
      return;
    }

    setIsCreatingVehicle(true);
    try {
      const vehicleId = await createVehicle({
        userId: data.userId,
        year: Number(newVehicle.year),
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        size: newVehicle.size,
        color: newVehicle.color.trim() || undefined,
        licensePlate: newVehicle.licensePlate.trim() || undefined,
        notes: newVehicle.notes.trim() || undefined,
      });

      // Automatically check/select this vehicle
      setEditVehicleIds((prev) => [...prev, vehicleId]);

      // Pre-set sizes/types mapping
      setEditVehicleSizes((prev) => ({
        ...prev,
        [vehicleId]: newVehicle.size,
      }));
      setEditVehicleTypeIds((prev) => ({
        ...prev,
        [vehicleId]: "",
      }));
      setEditVehicleServices((prev) => ({
        ...prev,
        [vehicleId]: editServiceIds.length > 0 ? [...editServiceIds] : [],
      }));

      resetVehicleForm();
      toast.success("Vehicle added and selected");
    } catch {
      toast.error("Failed to add vehicle");
    } finally {
      setIsCreatingVehicle(false);
    }
  };
  const [adjustingWork, setAdjustingWork] = useState(false);
  const [adjustVehicleIds, setAdjustVehicleIds] = useState<Id<"vehicles">[]>([]);
  const [adjustServiceIds, setAdjustServiceIds] = useState<Id<"services">[]>([]);
  const [adjustPetFeeVehicleIds, setAdjustPetFeeVehicleIds] = useState<Id<"vehicles">[]>([]);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const adjustmentPreview = useQuery(
    api.appointments.previewWorkAdjustment,
    adjustingWork && adjustVehicleIds.length > 0 && adjustServiceIds.length > 0
      ? {
          appointmentId,
          vehicleIds: adjustVehicleIds,
          serviceIds: adjustServiceIds,
          petFeeVehicleIds: adjustPetFeeVehicleIds,
          reason: adjustReason || "Preview",
        }
      : "skip",
  );
  const adjustments = useQuery(api.appointments.listAdjustments, { appointmentId });

  useEffect(() => {
    if (!data?.invoice) return;
    setBillingDueDate(data.invoice.dueDate);
    setBillingMethod(
      data.invoice.remainingBalanceCollectionMethod ?? "send_invoice",
    );
  }, [data?.invoice]);

  useEffect(() => {
    if (!data) return;
    setTravelFeeInput(data.travelFee ?? "");
    setTravelDistanceInput(data.travelDistanceMiles ?? "");
  }, [data]);

  const customerVehicles = useMemo(
    () => (customerVehiclesQuery ?? []) as AppointmentVehicle[],
    [customerVehiclesQuery],
  );
  const allServiceOptions = useMemo(
    () => (allServices ?? []) as AppointmentService[],
    [allServices],
  );
  const typedVehicleTypes = useMemo(
    () => (vehicleTypes ?? []) as Doc<"vehicleTypes">[],
    [vehicleTypes],
  );

  // Computed live metrics during editing
  const editingSummary = useMemo(() => {
    if (!editing || !data) return null;

    const currentVehicles = (data.vehicles ?? []) as AppointmentVehicle[];
    const targetVehicles = (customerVehicles.length > 0 ? customerVehicles : currentVehicles).filter(
      (v) => editVehicleIds.includes(v._id),
    );

    let totalServicePrice = 0;
    let totalServiceMinutes = 0;

    const perVehicleBreakdown = targetVehicles.map((vehicle) => {
      const vServiceIds = editVehicleServices[vehicle._id] || [];
      const vehicleSize = (editVehicleSizes[vehicle._id] || vehicle.size || "medium") as VehicleSize;
      const vehicleTypeId = editVehicleTypeIds[vehicle._id] || vehicle.vehicleTypeId || null;

      const vServices = vServiceIds
        .map((sId) => allServiceOptions.find((s) => s._id === sId))
        .filter((s): s is AppointmentService => s !== undefined && s.isActive);

      let vPrice = 0;
      let vMinutes = 0;
      const serviceDetails = vServices.map((service) => {
        const pricing = getEffectiveServicePricingForVehicle(service, {
          vehicleSize,
          vehicleTypeId,
        });
        const price = pricing.isAvailable ? pricing.price : (service.basePrice || 0);
        const duration = pricing.duration || service.duration || 0;
        vPrice += price;
        vMinutes += duration;
        return {
          service,
          price,
          duration,
          category: getServiceTypeCategory(service),
        };
      });

      totalServicePrice += vPrice;
      totalServiceMinutes += vMinutes;

      return {
        vehicle,
        vehicleSize,
        vehicleTypeId,
        services: serviceDetails,
        totalPrice: vPrice,
        totalMinutes: vMinutes,
        hasPetFee: editPetFeeVehicleIds.includes(vehicle._id),
      };
    });

    const petFeeCount = editPetFeeVehicleIds.filter((id) => editVehicleIds.includes(id)).length;
    const petFeeTimePerVehicle = petFeeSettings?.timeAddMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES;
    const totalPetFeeMinutes = petFeeCount * petFeeTimePerVehicle;

    let petFeeTotalPrice = 0;
    for (const vehicle of targetVehicles) {
      if (editPetFeeVehicleIds.includes(vehicle._id)) {
        const size = (editVehicleSizes[vehicle._id] || vehicle.size || "medium") as VehicleSize;
        if (petFeeSettings) {
          petFeeTotalPrice += size === "large" ? petFeeSettings.basePriceLarge : size === "small" ? petFeeSettings.basePriceSmall : petFeeSettings.basePriceMedium;
        } else {
          petFeeTotalPrice += 50;
        }
      }
    }

    const travelDistanceMiles = data.travelDistanceMiles;
    const travelBufferMinutes = travelDistanceMiles !== undefined
      ? calculateTravelBufferMinutesForMiles(travelDistanceMiles, travelFeeSettings ?? undefined)
      : 0;

    const totalDuration = calculateSchedulingDuration({
      serviceDurations: [totalServiceMinutes],
      petFeeVehicleCount: petFeeCount,
      petFeeTimeMinutes: petFeeTimePerVehicle,
      travelBufferMinutes,
    });

    const travelFee = data.travelFee ?? 0;
    const computedSubtotal = totalServicePrice + petFeeTotalPrice + travelFee;

    return {
      perVehicleBreakdown,
      totalServicePrice,
      totalServiceMinutes,
      petFeeCount,
      totalPetFeeMinutes,
      petFeeTotalPrice,
      travelDistanceMiles,
      travelBufferMinutes,
      travelFee,
      totalDuration,
      computedSubtotal,
    };
  }, [
    editing,
    data,
    customerVehicles,
    editVehicleIds,
    editVehicleServices,
    editVehicleSizes,
    editVehicleTypeIds,
    allServiceOptions,
    editPetFeeVehicleIds,
    petFeeSettings,
    travelFeeSettings,
  ]);

  // Computed summary in view mode
  const viewSummary = useMemo(() => {
    if (editing || !data) return null;

    const aptVehicles = (data.vehicles ?? []) as AppointmentVehicle[];
    const aptServices = (data.services ?? []) as AppointmentService[];

    const perVehicleBreakdown = aptVehicles.map((vehicle) => {
      const mapping = data.vehicleServices?.find((vs) => vs.vehicleId === vehicle._id);
      const assignedServiceIds = mapping ? mapping.serviceIds : data.serviceIds;

      const vServices = assignedServiceIds
        .map((sId) => aptServices.find((s) => s._id === sId) ?? allServiceOptions.find((s) => s._id === sId))
        .filter((s): s is AppointmentService => s !== undefined);

      let vPrice = 0;
      let vMinutes = 0;

      const serviceDetails = vServices.map((service) => {
        const pricing = getEffectiveServicePricingForVehicle(service, {
          vehicleSize: (vehicle.size || "medium") as VehicleSize,
          vehicleTypeId: vehicle.vehicleTypeId || null,
        });
        const price = pricing.isAvailable ? pricing.price : (service.effectivePrice ?? service.basePrice ?? 0);
        const duration = pricing.duration || service.duration || 0;
        vPrice += price;
        vMinutes += duration;
        return {
          service,
          price,
          duration,
          category: getServiceTypeCategory(service),
        };
      });

      return {
        vehicle,
        services: serviceDetails,
        totalPrice: vPrice,
        totalMinutes: vMinutes,
        hasPetFee: (data.petFeeVehicleIds ?? []).includes(vehicle._id),
      };
    });

    const totalServiceMinutes = perVehicleBreakdown.reduce((sum, v) => sum + v.totalMinutes, 0);
    const petFeeCount = (data.petFeeVehicleIds ?? []).length;
    const petFeeTimePerVehicle = petFeeSettings?.timeAddMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES;
    const totalPetFeeMinutes = petFeeCount * petFeeTimePerVehicle;
    const travelDistanceMiles = data.travelDistanceMiles;
    const travelBufferMinutes = travelDistanceMiles !== undefined
      ? calculateTravelBufferMinutesForMiles(travelDistanceMiles, travelFeeSettings ?? undefined)
      : 0;

    return {
      perVehicleBreakdown,
      totalServiceMinutes,
      petFeeCount,
      totalPetFeeMinutes,
      travelDistanceMiles,
      travelBufferMinutes,
      totalDuration: data.duration,
    };
  }, [editing, data, allServiceOptions, petFeeSettings, travelFeeSettings]);

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

  const typedVehicles = data.vehicles as AppointmentVehicle[];
  const typedServices = data.services as AppointmentService[];
  const typedAdjustments = (adjustments ?? []) as Doc<"appointmentAdjustments">[];
  const beforePhotos = (data.beforePhotos ?? []) as AppointmentBeforePhoto[];

  const handleStatusUpdate = async (
    newStatus: "confirmed" | "in_progress" | "completed" | "cancelled",
  ) => {
    setLoading(true);
    try {
      await updateStatus({ appointmentId, status: newStatus });
      toast.success(`Appointment ${newStatus.replace("_", " ")}`);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update appointment status"));
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
    const selectedVIds = typedVehicles.length > 0
      ? typedVehicles.map((vehicle) => vehicle._id)
      : (customerVehicles.length === 1
          ? [customerVehicles[0]._id]
          : []);
    setEditVehicleIds(selectedVIds);
    setEditPetFeeVehicleIds(data.petFeeVehicleIds ?? []);

    const initialVehicleServices: Record<string, Id<"services">[]> = {};
    if (data.vehicleServices && data.vehicleServices.length > 0) {
      for (const vs of data.vehicleServices) {
        initialVehicleServices[vs.vehicleId] = [...vs.serviceIds];
      }
    } else {
      for (const vId of selectedVIds) {
        initialVehicleServices[vId] = [...data.serviceIds];
      }
    }
    setEditVehicleServices(initialVehicleServices);
    const sizes: Record<string, string> = {};
    const vehicleTypeIds: Record<string, string> = {};
    for (const v of customerVehicles.length > 0 ? customerVehicles : typedVehicles) {
      sizes[v._id] = v.size || "medium";
      vehicleTypeIds[v._id] = v.vehicleTypeId || "";
    }
    setEditVehicleSizes(sizes);
    setEditVehicleTypeIds(vehicleTypeIds);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const startWorkAdjustment = () => {
    setAdjustVehicleIds(data.vehicleIds);
    setAdjustServiceIds(data.serviceIds);
    setAdjustPetFeeVehicleIds(data.petFeeVehicleIds ?? []);
    setAdjustReason("");
    setAdjustingWork(true);
  };

  const toggleAdjustVehicle = (vehicleId: Id<"vehicles">, checked: boolean) => {
    setAdjustVehicleIds((prev) =>
      checked ? [...new Set([...prev, vehicleId])] : prev.filter((id) => id !== vehicleId),
    );
    if (!checked) {
      setAdjustPetFeeVehicleIds((prev) => prev.filter((id) => id !== vehicleId));
    }
  };

  const toggleAdjustService = (serviceId: Id<"services">) => {
    setAdjustServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId],
    );
  };

  const toggleAdjustPetFeeVehicle = (
    vehicleId: Id<"vehicles">,
    checked: boolean,
  ) => {
    setAdjustPetFeeVehicleIds((prev) =>
      checked ? [...new Set([...prev, vehicleId])] : prev.filter((id) => id !== vehicleId),
    );
  };

  const handleApplyWorkAdjustment = async () => {
    if (adjustVehicleIds.length === 0) {
      toast.error("Select at least one vehicle");
      return;
    }
    if (adjustServiceIds.length === 0) {
      toast.error("Select at least one service");
      return;
    }
    if (adjustReason.trim().length < 3) {
      toast.error("Add a short reason for the adjustment");
      return;
    }

    setAdjustLoading(true);
    try {
      const result = await applyWorkAdjustment({
        appointmentId,
        vehicleIds: adjustVehicleIds,
        serviceIds: adjustServiceIds,
        petFeeVehicleIds: adjustPetFeeVehicleIds,
        reason: adjustReason,
      });
      toast.success(`Work adjusted (${result.invoiceAction.replaceAll("_", " ")})`);
      setAdjustingWork(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to adjust work"));
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleSave = async () => {
    if (editVehicleIds.length === 0) {
      toast.error("Select at least one customer vehicle before saving");
      return;
    }

    setLoading(true);
    try {
      // Update vehicle sizes first
      for (const v of customerVehicles.length > 0 ? customerVehicles : typedVehicles) {
        if (!editVehicleIds.includes(v._id)) {
          continue;
        }
        const newSize = editVehicleSizes[v._id] as "small" | "medium" | "large" | undefined;
        const newVehicleTypeId = editVehicleTypeIds[v._id] as Id<"vehicleTypes"> | undefined;
        if (newVehicleTypeId && newVehicleTypeId !== v.vehicleTypeId) {
          await updateVehicle({ id: v._id, vehicleTypeId: newVehicleTypeId });
        } else if (newSize && newSize !== (v.size || "medium")) {
          await updateVehicle({ id: v._id, size: newSize });
        }
      }

      // Build per-vehicle service mapping payload
      const vehicleServicesPayload = editVehicleIds.map((vId) => {
        const vehicleServicesForV = editVehicleServices[vId];
        return {
          vehicleId: vId,
          serviceIds: (vehicleServicesForV && vehicleServicesForV.length > 0)
            ? vehicleServicesForV
            : editServiceIds,
        };
      });

      const finalServiceIds = Array.from(
        new Set(vehicleServicesPayload.flatMap((vs) => vs.serviceIds))
      ) as Id<"services">[];

      // Update the appointment (triggers price recalculation + invoice sync)
      await updateAppointment({
        appointmentId,
        userId: data.userId,
        vehicleIds: editVehicleIds,
        serviceIds: finalServiceIds,
        vehicleServices: vehicleServicesPayload,
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
      toast.error(getErrorMessage(err, "Failed to update appointment"));
    } finally {
      setLoading(false);
    }
  };

  const toggleVehicleService = (vehicleId: Id<"vehicles">, serviceId: Id<"services">) => {
    setEditVehicleServices((prev) => {
      const current = prev[vehicleId] || [];
      const next = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];
      const updated = { ...prev, [vehicleId]: next };
      const allServicesUnion = Array.from(new Set(Object.values(updated).flat())) as Id<"services">[];
      setEditServiceIds(allServicesUnion);
      return updated;
    });
  };

  const removeVehicleService = (vehicleId: Id<"vehicles">, serviceId: Id<"services">) => {
    setEditVehicleServices((prev) => {
      const current = prev[vehicleId] || [];
      const next = current.filter((id) => id !== serviceId);
      const updated = { ...prev, [vehicleId]: next };
      const allServicesUnion = Array.from(new Set(Object.values(updated).flat())) as Id<"services">[];
      setEditServiceIds(allServicesUnion);
      return updated;
    });
  };

  const toggleVehicle = (vehicleId: Id<"vehicles">, checked: boolean) => {
    setEditVehicleIds((prev) =>
      checked ? [...prev, vehicleId] : prev.filter((id) => id !== vehicleId),
    );
    if (!checked) {
      setEditPetFeeVehicleIds((prev) => prev.filter((id) => id !== vehicleId));
      setEditVehicleServices((prev) => {
        const copy = { ...prev };
        delete copy[vehicleId];
        const allServicesUnion = Array.from(new Set(Object.values(copy).flat())) as Id<"services">[];
        setEditServiceIds(allServicesUnion);
        return copy;
      });
    } else {
      setEditVehicleServices((prev) => {
        const copy = {
          ...prev,
          [vehicleId]: prev[vehicleId] ?? [],
        };
        const allServicesUnion = Array.from(new Set(Object.values(copy).flat())) as Id<"services">[];
        setEditServiceIds(allServicesUnion);
        return copy;
      });
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
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update live invoice"));
    } finally {
      setBillingLoading(false);
    }
  };

  const handleTravelFeeSave = async () => {
    const travelFee = travelFeeInput === "" ? 0 : Number(travelFeeInput);
    if (!Number.isFinite(travelFee) || travelFee < 0) {
      toast.error("Travel fee must be zero or greater");
      return;
    }

    const travelDistanceMiles =
      travelDistanceInput === "" ? undefined : Number(travelDistanceInput);
    if (
      travelDistanceMiles !== undefined &&
      (!Number.isFinite(travelDistanceMiles) || travelDistanceMiles < 0)
    ) {
      toast.error("Miles must be zero or greater");
      return;
    }

    setTravelFeeLoading(true);
    try {
      const result = await updateTravelFee({
        appointmentId,
        travelFee,
        travelDistanceMiles,
      });
      if (result.invoiceAction === "supplemental_invoice_created") {
        toast.success("Travel fee added with a supplemental invoice");
      } else if (result.invoiceAction === "updated_open_invoice") {
        toast.success("Travel fee saved and invoice updated");
      } else {
        toast.success("Travel fee saved");
      }
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update travel fee"));
    } finally {
      setTravelFeeLoading(false);
    }
  };

  const { user, invoice, tripLog, location } = data;
  const services = typedServices;
  const vehicles = typedVehicles;
  const adjustmentVehicles = customerVehicles.length > 0 ? customerVehicles : vehicles;
  const normalizedCouponPreview = normalizeStripeCouponCode(couponCode);
  const beforePhotoGroups = Object.entries(
    beforePhotos.reduce<
      Record<string, AppointmentBeforePhoto[]>
    >((groups, photo) => {
      const label = photo.vehicleLabel || "Unassigned vehicle";
      groups[label] = [...(groups[label] ?? []), photo];
      return groups;
    }, {}),
  );
  const canPreviewInlinePhoto = (photo: AppointmentBeforePhoto) =>
    !["image/heic", "image/heif"].includes(photo.contentType.toLowerCase());
  const canEdit = ["pending", "confirmed", "in_progress"].includes(data.status);
  const canEditBilling =
    !!invoice &&
    (invoice.paymentOption ?? "deposit") === "deposit" &&
    (invoice.remainingBalance ?? 0) > 0 &&
    invoice.status !== "paid";
  const canApplyDiscount =
    !!invoice &&
    canEdit &&
    (invoice.status !== "paid" || (invoice.remainingBalance ?? 0) > 0);
  const canEditTravelFee = canEdit && !!invoice;
  const canReissueBilling = canEditBilling && !!invoice?.stripeInvoiceId;
  const adjustmentBlockedByCredit =
    adjustmentPreview?.invoicePaid === true && adjustmentPreview.priceDelta < 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/admin/appointments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Appointments
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={startWorkAdjustment}>
              <Wrench className="mr-2 h-4 w-4" />
              Adjust Work
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
            Deposit paid — you can still edit the appointment, adjust work, or
            apply discounts before completion. Confirming keeps the job moving
            and generates the Stripe invoice for the remaining balance.
          </p>
        </div>
      )}
      {canEdit &&
        invoice &&
        (invoice.status !== "paid" || (invoice.remainingBalance ?? 0) > 0) && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
            You can edit appointment details, adjust work, and apply discounts
            until completion. Complete only after the invoice reflects the final
            work, because completion can trigger final balance collection and
            locks paid invoices for tax/payment accuracy.
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

        {/* Service Selection Dialog for a Vehicle */}
        <Dialog
          open={serviceModalVehicleId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setServiceModalVehicleId(null);
              setServiceModalSearch("");
              setServiceModalTab("all");
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
            {(() => {
              if (!serviceModalVehicleId) return null;
              const targetVehicle = (customerVehicles.length > 0 ? customerVehicles : typedVehicles).find(
                (v) => v._id === serviceModalVehicleId
              );
              if (!targetVehicle) return null;

              const vSize = (editVehicleSizes[targetVehicle._id] || targetVehicle.size || "medium") as VehicleSize;
              const vTypeId = editVehicleTypeIds[targetVehicle._id] || targetVehicle.vehicleTypeId || null;
              const vTypeName = typedVehicleTypes.find((vt) => vt._id === vTypeId)?.name ?? vSize;
              const selectedServiceIds = editVehicleServices[targetVehicle._id] || [];

              const activeServices = allServiceOptions.filter((s) => s.isActive);
              const searchLower = serviceModalSearch.trim().toLowerCase();

              const filteredServices = activeServices.filter((service) => {
                const category = getServiceTypeCategory(service);
                if (serviceModalTab === "standard" && category !== "standard") return false;
                if (serviceModalTab === "addon" && category !== "addon") return false;
                if (searchLower) {
                  const nameMatches = service.name.toLowerCase().includes(searchLower);
                  const descMatches = (service.description || "").toLowerCase().includes(searchLower);
                  if (!nameMatches && !descMatches) return false;
                }
                return true;
              });

              const standardCount = activeServices.filter((s) => getServiceTypeCategory(s) === "standard").length;
              const addonCount = activeServices.filter((s) => getServiceTypeCategory(s) === "addon").length;

              const selectedServices = selectedServiceIds
                .map((id) => allServiceOptions.find((s) => s._id === id))
                .filter((s): s is AppointmentService => s !== undefined);

              const totalVPrice = selectedServices.reduce((sum, s) => {
                const pricing = getEffectiveServicePricingForVehicle(s, {
                  vehicleSize: vSize,
                  vehicleTypeId: vTypeId,
                });
                return sum + (pricing.isAvailable ? pricing.price : (s.basePrice || 0));
              }, 0);

              const totalVDuration = selectedServices.reduce((sum, s) => {
                const pricing = getEffectiveServicePricingForVehicle(s, {
                  vehicleSize: vSize,
                  vehicleTypeId: vTypeId,
                });
                return sum + (pricing.duration || s.duration || 0);
              }, 0);

              return (
                <>
                  <DialogHeader className="p-4 sm:p-6 pb-4 border-b bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                          <Wrench className="h-5 w-5 text-primary" />
                          <span>Manage Services</span>
                        </DialogTitle>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{targetVehicle.year} {targetVehicle.make} {targetVehicle.model}</span>
                          <span>•</span>
                          <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                            {vTypeName}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
                        {selectedServiceIds.length} selected
                      </Badge>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search service name..."
                          value={serviceModalSearch}
                          onChange={(e) => setServiceModalSearch(e.target.value)}
                          className="pl-8 h-9 text-xs"
                        />
                        {serviceModalSearch && (
                          <button
                            type="button"
                            onClick={() => setServiceModalSearch("")}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setServiceModalTab("all")}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            serviceModalTab === "all"
                              ? "bg-background font-semibold text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          All ({activeServices.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setServiceModalTab("standard")}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            serviceModalTab === "standard"
                              ? "bg-background font-semibold text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Standard ({standardCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setServiceModalTab("addon")}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            serviceModalTab === "addon"
                              ? "bg-background font-semibold text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Add-ons ({addonCount})
                        </button>
                      </div>
                    </div>
                  </DialogHeader>

                  {/* Service List */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
                    {filteredServices.length === 0 ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        No services match your search or filter.
                      </div>
                    ) : (
                      filteredServices.map((service) => {
                        const isSelected = selectedServiceIds.includes(service._id);
                        const pricingInfo = getEffectiveServicePricingForVehicle(service, {
                          vehicleSize: vSize,
                          vehicleTypeId: vTypeId,
                        });
                        const category = getServiceTypeCategory(service);

                        if (!pricingInfo.isAvailable) {
                          return null;
                        }

                        return (
                          <div
                            key={service._id}
                            onClick={() => toggleVehicleService(targetVehicle._id, service._id)}
                            className={`flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                                : "border-border/60 bg-card hover:bg-accent/40"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleVehicleService(targetVehicle._id, service._id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-xs text-foreground truncate">
                                    {service.name}
                                  </span>
                                  <Badge
                                    variant={category === "addon" ? "outline" : "secondary"}
                                    className="text-[10px] px-1.5 py-0 capitalize"
                                  >
                                    {category === "addon" ? "Add-on" : "Standard"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  <span>{pricingInfo.duration || service.duration} min</span>
                                  {service.description && (
                                    <span className="truncate max-w-xs text-muted-foreground/80 hidden sm:inline">
                                      • {service.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="font-bold text-xs text-primary shrink-0">
                              {formatCurrency(pricingInfo.price)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="border-t bg-muted/20 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
                      <span>
                        <strong className="text-foreground font-bold">{selectedServiceIds.length}</strong> services selected
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-foreground">{formatCurrency(totalVPrice)}</span>
                      <span>•</span>
                      <span>{totalVDuration} min</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto font-medium"
                      onClick={() => {
                        setServiceModalVehicleId(null);
                        setServiceModalSearch("");
                        setServiceModalTab("all");
                      }}
                    >
                      <Check className="mr-1.5 h-4 w-4" /> Done
                    </Button>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Vehicles Card */}
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
              ) : (
                <div className="space-y-3">
                  {customerVehicles.map((v) => {
                    const checked = editVehicleIds.includes(v._id);
                    const hasPetFee = editPetFeeVehicleIds.includes(v._id);
                    const vServiceIds = editVehicleServices[v._id] || [];

                    return (
                      <div
                        key={v._id}
                        className={`rounded-lg border p-3.5 transition-all ${
                          checked ? "bg-card border-primary/40 shadow-xs" : "bg-muted/10 opacity-75"
                        }`}
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
                              <p className="font-semibold text-sm">
                                {v.year} {v.make} {v.model}
                              </p>
                              <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                                {v.color && <span>{v.color}</span>}
                                {v.licensePlate && <span>• {v.licensePlate}</span>}
                              </div>
                            </div>
                          </div>
                          <Select
                            value={editVehicleTypeIds[v._id] || "__legacy__"}
                            onValueChange={(val) =>
                              setEditVehicleTypeIds((prev) => ({
                                ...prev,
                                [v._id]: val === "__legacy__" ? "" : val,
                              }))
                            }
                            disabled={!checked || typedVehicleTypes.length === 0}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__legacy__">
                                {v.size || "medium"}
                              </SelectItem>
                              {typedVehicleTypes.map((vehicleType) => (
                                <SelectItem key={vehicleType._id} value={vehicleType._id}>
                                  {vehicleType.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="mt-3 flex items-center gap-2 border-t pt-2.5">
                          <Checkbox
                            checked={hasPetFee}
                            onCheckedChange={(value) =>
                              togglePetFeeVehicle(v._id, value === true)
                            }
                            id={`pet-fee-${v._id}`}
                          />
                          <Label htmlFor={`pet-fee-${v._id}`} className="text-xs font-normal cursor-pointer">
                            Pet hair fee (+30 min)
                          </Label>
                        </div>

                        {/* Services for this vehicle in edit mode */}
                        {checked && (
                          <div className="mt-3 border-t pt-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Wrench className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-semibold text-foreground">Services for this vehicle</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                                  {vServiceIds.length}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2.5 font-medium"
                                onClick={() => {
                                  setServiceModalVehicleId(v._id);
                                  setServiceModalSearch("");
                                  setServiceModalTab("all");
                                }}
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" /> Manage Services
                              </Button>
                            </div>

                            {vServiceIds.length === 0 ? (
                              <div className="rounded-lg border border-dashed p-3 text-center bg-muted/10">
                                <p className="text-xs text-muted-foreground">No services selected for this vehicle yet.</p>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="mt-2 h-7 text-xs"
                                  onClick={() => {
                                    setServiceModalVehicleId(v._id);
                                    setServiceModalSearch("");
                                    setServiceModalTab("all");
                                  }}
                                >
                                  <Plus className="mr-1 h-3.5 w-3.5" /> Select Services
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {vServiceIds.map((sId) => {
                                  const s = allServiceOptions.find((opt) => opt._id === sId);
                                  if (!s) return null;
                                  const vSize = (editVehicleSizes[v._id] || v.size || "medium") as VehicleSize;
                                  const vTypeId = editVehicleTypeIds[v._id] || v.vehicleTypeId || null;
                                  const pricing = getEffectiveServicePricingForVehicle(s, {
                                    vehicleSize: vSize,
                                    vehicleTypeId: vTypeId,
                                  });
                                  const price = pricing.isAvailable ? pricing.price : (s.basePrice || 0);
                                  const duration = pricing.duration || s.duration || 0;
                                  const category = getServiceTypeCategory(s);

                                  return (
                                    <div
                                      key={sId}
                                      className="flex items-center justify-between gap-2 rounded-md border bg-card/80 p-2 px-2.5 text-xs transition-colors hover:bg-accent/30"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Badge
                                          variant={category === "addon" ? "outline" : "secondary"}
                                          className="text-[9px] px-1 py-0 capitalize shrink-0"
                                        >
                                          {category === "addon" ? "Add-on" : "Standard"}
                                        </Badge>
                                        <span className="font-medium text-foreground truncate">{s.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2.5 shrink-0">
                                        <span className="text-[11px] text-muted-foreground">{duration} min</span>
                                        <span className="font-semibold text-primary">{formatCurrency(price)}</span>
                                        <button
                                          type="button"
                                          onClick={() => removeVehicleService(v._id, s._id)}
                                          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                          title="Remove service"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <Accordion type="single" collapsible className="rounded-lg border bg-muted/20">
                    <AccordionItem value="add-vehicle" className="border-none">
                      <AccordionTrigger className="px-4 py-3 text-xs font-semibold hover:no-underline">
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          <span>Add New Vehicle for This Customer</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-1 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="new-v-year" className="text-xs">Year</Label>
                            <Input
                              id="new-v-year"
                              type="number"
                              placeholder="2024"
                              className="h-8 text-xs"
                              value={newVehicle.year}
                              onChange={(e) =>
                                setNewVehicle((prev) => ({ ...prev, year: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-v-make" className="text-xs">Make</Label>
                            <Input
                              id="new-v-make"
                              placeholder="Toyota"
                              className="h-8 text-xs"
                              value={newVehicle.make}
                              onChange={(e) =>
                                setNewVehicle((prev) => ({ ...prev, make: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="new-v-model" className="text-xs">Model</Label>
                            <Input
                              id="new-v-model"
                              placeholder="Camry"
                              className="h-8 text-xs"
                              value={newVehicle.model}
                              onChange={(e) =>
                                setNewVehicle((prev) => ({ ...prev, model: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-v-color" className="text-xs">Color</Label>
                            <Input
                              id="new-v-color"
                              placeholder="Silver"
                              className="h-8 text-xs"
                              value={newVehicle.color}
                              onChange={(e) =>
                                setNewVehicle((prev) => ({ ...prev, color: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="new-v-size" className="text-xs">Size</Label>
                            <Select
                              value={newVehicle.size}
                              onValueChange={(val) =>
                                setNewVehicle((prev) => ({
                                  ...prev,
                                  size: val as "small" | "medium" | "large",
                                }))
                              }
                            >
                              <SelectTrigger id="new-v-size" className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="small">Small</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="large">Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="new-v-license" className="text-xs">License Plate</Label>
                            <Input
                              id="new-v-license"
                              placeholder="ABC-123"
                              className="h-8 text-xs"
                              value={newVehicle.licensePlate}
                              onChange={(e) =>
                                setNewVehicle((prev) => ({
                                  ...prev,
                                  licensePlate: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="new-v-notes" className="text-xs">Notes</Label>
                          <Textarea
                            id="new-v-notes"
                            placeholder="Optional notes"
                            className="min-h-[50px] text-xs p-2"
                            value={newVehicle.notes}
                            onChange={(e) =>
                              setNewVehicle((prev) => ({ ...prev, notes: e.target.value }))
                            }
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCreateVehicle}
                            disabled={isCreatingVehicle || !newVehicle.year || !newVehicle.make || !newVehicle.model}
                          >
                            {isCreatingVehicle ? "Saving..." : "Save Vehicle"}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )
            ) : vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicles linked</p>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => {
                  const mapping = data.vehicleServices?.find((vs) => vs.vehicleId === v._id);
                  const assignedServiceIds = mapping ? mapping.serviceIds : data.serviceIds;
                  const vServices = assignedServiceIds
                    .map((sId) => services.find((s) => s._id === sId) ?? allServiceOptions.find((s) => s._id === sId))
                    .filter((s): s is AppointmentService => s !== undefined);

                  return (
                    <div key={v._id} className="rounded-lg border p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Car className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-sm">{v.year} {v.make} {v.model}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              {v.color && <span>{v.color}</span>}
                              {v.licensePlate && <span>• {v.licensePlate}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {v.vehicleType?.name ?? v.size ?? "medium"}
                          </Badge>
                          {(data.petFeeVehicleIds ?? []).includes(v._id) && (
                            <Badge variant="outline">Pet fee</Badge>
                          )}
                        </div>
                      </div>

                      {/* Services for this vehicle in view mode */}
                      {vServices.length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Assigned Services ({vServices.length})
                          </p>
                          <div className="space-y-1 pl-2 border-l-2 border-primary/30">
                            {vServices.map((s) => {
                              const pricing = getEffectiveServicePricingForVehicle(s, {
                                vehicleSize: (v.size || "medium") as VehicleSize,
                                vehicleTypeId: v.vehicleTypeId || null,
                              });
                              const price = pricing.isAvailable ? pricing.price : (s.effectivePrice ?? s.basePrice ?? 0);
                              const duration = pricing.duration || s.duration || 0;
                              const category = getServiceTypeCategory(s);

                              return (
                                <div key={s._id} className="flex items-center justify-between text-xs text-muted-foreground">
                                  <div className="flex items-center gap-2 truncate">
                                    <Badge variant={category === "addon" ? "outline" : "secondary"} className="text-[9px] px-1 py-0 capitalize">
                                      {category === "addon" ? "Add-on" : "Standard"}
                                    </Badge>
                                    <span className="truncate">{s.name}</span>
                                  </div>
                                  <span className="shrink-0 font-medium text-foreground">
                                    {formatCurrency(price)} ({duration} min)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services & Timing Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Appointment Overview ({editing ? editServiceIds.length : services.length} services)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing && editingSummary && (
              <>
                {/* Vehicle by Vehicle Breakdown */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Assigned Services By Vehicle
                  </Label>
                  {editingSummary.perVehicleBreakdown.map(({ vehicle, services: vServices, totalPrice: vPrice, totalMinutes: vMinutes, hasPetFee }) => (
                    <div key={vehicle._id} className="rounded-lg border p-3 bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 text-muted-foreground" />
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </span>
                        <span className="text-primary font-bold">
                          {formatCurrency(vPrice)} • {vMinutes} min
                        </span>
                      </div>
                      {vServices.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">No services assigned yet.</p>
                      ) : (
                        <div className="space-y-1 pl-4 border-l-2 border-primary/30">
                          {vServices.map(({ service, price, duration }) => (
                            <div key={service._id} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="truncate pr-2">{service.name}</span>
                              <span className="shrink-0">{formatCurrency(price)} ({duration}m)</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasPetFee && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                          <span>🐾 Pet Hair Fee</span>
                          <span>+{petFeeSettings?.timeAddMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES} min</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Duration & Timing Breakdown Box */}
                <div className="rounded-lg border bg-accent/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      Duration & Schedule Calculation
                    </span>
                    <Badge variant="outline" className="font-bold text-xs">
                      {editingSummary.totalDuration} min Total
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t">
                    <div className="flex items-center justify-between">
                      <span>Services Duration:</span>
                      <span className="font-medium text-foreground">{editingSummary.totalServiceMinutes} min ({formatMinutes(editingSummary.totalServiceMinutes)})</span>
                    </div>
                    {editingSummary.petFeeCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Pet Fee Time ({editingSummary.petFeeCount} vehicle{editingSummary.petFeeCount > 1 ? "s" : ""}):</span>
                        <span className="font-medium text-foreground">+{editingSummary.totalPetFeeMinutes} min</span>
                      </div>
                    )}
                    {editingSummary.travelDistanceMiles !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>Travel Buffer ({editingSummary.travelDistanceMiles} mi):</span>
                        <span className="font-medium text-foreground">+{editingSummary.travelBufferMinutes} min</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold pt-2 border-t text-foreground">
                    <span>Total Blocked Window:</span>
                    <span className="text-primary font-bold">{editingSummary.totalDuration} min ({formatMinutes(editingSummary.totalDuration)})</span>
                  </div>
                </div>

                {/* Pricing Summary Box */}
                <div className="rounded-lg border p-3.5 space-y-2 bg-muted/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Services Subtotal:</span>
                    <span className="font-medium">{formatCurrency(editingSummary.totalServicePrice)}</span>
                  </div>
                  {editingSummary.petFeeTotalPrice > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pet Fee:</span>
                      <span className="font-medium">{formatCurrency(editingSummary.petFeeTotalPrice)}</span>
                    </div>
                  )}
                  {editingSummary.travelFee > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Travel Fee:</span>
                      <span className="font-medium">{formatCurrency(editingSummary.travelFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm font-bold pt-2 border-t">
                    <span>Computed Total:</span>
                    <span className="text-primary">{formatCurrency(editingSummary.computedSubtotal)}</span>
                  </div>
                </div>
              </>
            )}

            {!editing && viewSummary && (
              <>
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Assigned Services By Vehicle
                  </Label>
                  {viewSummary.perVehicleBreakdown.map(({ vehicle, services: vServices, totalPrice: vPrice, totalMinutes: vMinutes, hasPetFee }) => (
                    <div key={vehicle._id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 text-muted-foreground" />
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </span>
                        <span className="text-primary font-bold">
                          {formatCurrency(vPrice)} • {vMinutes} min
                        </span>
                      </div>
                      <div className="space-y-1 pl-3 border-l-2 border-primary/30">
                        {vServices.map(({ service, price, duration }) => (
                          <div key={service._id} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate pr-2">{service.name}</span>
                            <span className="shrink-0">{formatCurrency(price)} ({duration} min)</span>
                          </div>
                        ))}
                      </div>
                      {hasPetFee && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                          <span>🐾 Pet Hair Fee</span>
                          <span>+{petFeeSettings?.timeAddMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES} min</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Duration breakdown */}
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      Duration Breakdown
                    </span>
                    <span className="font-bold text-primary">{data.duration} min Total</span>
                  </div>
                  <div className="space-y-1 text-muted-foreground border-t pt-1.5">
                    <div className="flex items-center justify-between">
                      <span>Services:</span>
                      <span>{viewSummary.totalServiceMinutes} min</span>
                    </div>
                    {viewSummary.petFeeCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Pet Fee Time:</span>
                        <span>+{viewSummary.totalPetFeeMinutes} min</span>
                      </div>
                    )}
                    {viewSummary.travelDistanceMiles !== undefined && (
                      <div className="flex items-center justify-between">
                        <span>Travel Buffer ({viewSummary.travelDistanceMiles} mi):</span>
                        <span>+{viewSummary.travelBufferMinutes} min</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {(data.beforePhotos?.length ?? 0) > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">
                <span className="flex items-center gap-2">
                  <Images className="h-5 w-5" />
                  Before Photos ({data.beforePhotos.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {beforePhotoGroups.map(([vehicleLabel, photos]) => (
                  <section key={vehicleLabel} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{vehicleLabel}</p>
                      <Badge variant="secondary">
                        {photos.length} photo{photos.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {photos.map((photo) => (
                        <div key={photo.key} className="overflow-hidden rounded-md border">
                          {photo.signedUrl && canPreviewInlinePhoto(photo) ? (
                            <button
                              type="button"
                              className="block w-full text-left"
                              onClick={() =>
                                setPreviewPhoto({
                                  url: photo.signedUrl!,
                                  fileName: photo.fileName,
                                })
                              }
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.signedUrl}
                                alt={photo.fileName}
                                className="aspect-[4/3] w-full object-cover"
                              />
                            </button>
                          ) : photo.signedUrl ? (
                            <button
                              type="button"
                              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-xs text-muted-foreground"
                              onClick={() =>
                                setPreviewPhoto({
                                  url: photo.signedUrl!,
                                  fileName: photo.fileName,
                                })
                              }
                            >
                              <Images className="h-6 w-6" />
                              Open photo
                            </button>
                          ) : (
                            <div className="flex aspect-[4/3] items-center justify-center bg-muted p-4 text-center text-xs text-muted-foreground">
                              Preview unavailable
                            </div>
                          )}
                          <p className="truncate p-3 text-xs text-muted-foreground">
                            {photo.fileName}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm font-semibold">
                {formatCurrency(invoice ? invoice.subtotal : data.totalPrice)}
              </span>
            </div>

            {invoice && invoice.couponCode && (
              <div className="flex items-center justify-between text-sm bg-primary/5 rounded px-2 py-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Discount ({invoice.couponCode})
                </span>
                <span className="font-semibold text-primary">-{formatCurrency(invoice.discountAmount || 0)}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold">
                {formatCurrency(invoice ? invoice.total : data.totalPrice)}
              </span>
            </div>

            {invoice && (
              <>
                <div className="flex items-center justify-between text-sm border-t pt-2">
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
                    <span className="font-semibold">{formatCurrency(invoice.remainingBalance)}</span>
                  </div>
                )}
                {(data.travelFee ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Travel fee</span>
                    <span>
                      {formatCurrency(data.travelFee ?? 0)}
                      {data.travelDistanceMiles !== undefined
                        ? ` (${data.travelDistanceMiles.toFixed(1)} mi)`
                        : ""}
                    </span>
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
            {canEditTravelFee && (
              <div className="space-y-3 rounded-md border p-3 bg-muted/20 mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Travel Fee
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="appointment-travel-fee" className="text-xs">
                      Fee
                    </Label>
                    <Input
                      id="appointment-travel-fee"
                      type="number"
                      min={0}
                      step="0.01"
                      value={travelFeeInput}
                      onChange={(event) =>
                        setTravelFeeInput(
                          event.target.value === "" ? "" : Number(event.target.value),
                        )
                      }
                      className="h-8 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="appointment-travel-miles" className="text-xs">
                      Miles
                    </Label>
                    <Input
                      id="appointment-travel-miles"
                      type="number"
                      min={0}
                      step="0.1"
                      value={travelDistanceInput}
                      onChange={(event) =>
                        setTravelDistanceInput(
                          event.target.value === "" ? "" : Number(event.target.value),
                        )
                      }
                      className="h-8 text-xs"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                {invoice.status === "paid" && (
                  <p className="text-xs text-muted-foreground">
                    Increases create a supplemental invoice.
                  </p>
                )}
                {invoice.status !== "paid" && invoice.stripeInvoiceId && (
                  <p className="text-xs text-muted-foreground">
                    Saving reissues the remaining-balance invoice.
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleTravelFeeSave()}
                  disabled={travelFeeLoading}
                >
                  {travelFeeLoading ? "Saving..." : "Save Travel Fee"}
                </Button>
              </div>
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

            {invoice && canApplyDiscount && (
              <div className="space-y-3 rounded-md border p-3 bg-muted/20 mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Discount / Promo Code
                </h4>

                {invoice.couponCode ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary truncate">
                        {invoice.couponCode}
                      </Badge>
                      <span className="text-muted-foreground text-xs truncate">
                        ({formatCurrency(invoice.discountAmount || 0)} off)
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 font-normal"
                      onClick={handleRemoveDiscount}
                      disabled={isApplyingDiscount}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-3">
                    <div className="grid gap-2 grid-cols-3">
                      <div className="col-span-2">
                        <Input
                          placeholder="Code (e.g. SAVE20)"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="h-8 text-xs uppercase"
                        />
                        {couponCode.trim() && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Saves as{" "}
                            <span className="font-mono">
                              {normalizedCouponPreview || "COUPON"}
                            </span>
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Existing Stripe coupons only need the code. Add a
                          value to create or replace a one-off discount.
                        </p>
                      </div>
                      <div>
                        <Select
                          value={discountType}
                          onValueChange={(val) => setDiscountType(val as "percent" | "amount")}
                        >
                          <SelectTrigger className="h-8 text-xs px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent" className="text-xs">% Off</SelectItem>
                            <SelectItem value="amount" className="text-xs">$ Off</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder={discountType === "percent" ? "Optional %" : "Optional $"}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value === "" ? "" : Number(e.target.value))}
                          className="h-8 text-xs"
                          min={1}
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleApplyDiscount}
                        disabled={isApplyingDiscount}
                      >
                        {isApplyingDiscount
                          ? "Applying..."
                          : invoice.couponCode
                            ? "Replace"
                            : "Apply"}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2 border-t mt-2">
                      <span className="text-[10px] text-muted-foreground w-full font-medium">Quick Presets:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="text-[10px] h-6 px-1.5"
                        onClick={() => {
                          setCouponCode("10PERCENT");
                          setDiscountType("percent");
                          setDiscountValue(10);
                        }}
                      >
                        10% Off
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="text-[10px] h-6 px-1.5"
                        onClick={() => {
                          setCouponCode("20PERCENT");
                          setDiscountType("percent");
                          setDiscountValue(20);
                        }}
                      >
                        20% Off
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="text-[10px] h-6 px-1.5"
                        onClick={() => {
                          setCouponCode("25OFF");
                          setDiscountType("amount");
                          setDiscountValue(25);
                        }}
                      >
                        $25 Off
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="text-[10px] h-6 px-1.5"
                        onClick={() => {
                          setCouponCode("50OFF");
                          setDiscountType("amount");
                          setDiscountValue(50);
                        }}
                      >
                        $50 Off
                      </Button>
                    </div>
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

      {typedAdjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Work Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {typedAdjustments.map((adjustment) => (
              <div
                key={adjustment._id}
                className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{adjustment.reason}</p>
                    <Badge variant="outline" className="capitalize">
                      {adjustment.invoiceAction.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(adjustment.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-4 text-sm md:justify-end">
                  <span className={adjustment.priceDelta >= 0 ? "text-green-700" : "text-red-700"}>
                    {adjustment.priceDelta >= 0 ? "+" : ""}
                    {formatCurrency(adjustment.priceDelta)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatMinutes(adjustment.durationDelta)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      <Dialog open={adjustingWork} onOpenChange={setAdjustingWork}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adjust Work</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <section className="space-y-3">
              <div>
                <Label>Vehicles</Label>
                <p className="text-xs text-muted-foreground">
                  Add or remove saved customer vehicles for this appointment.
                </p>
              </div>
              {adjustmentVehicles.length === 0 ? (
                <p className="rounded-md border p-3 text-sm text-muted-foreground">
                  No customer vehicles are available.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {adjustmentVehicles.map((vehicle) => {
                    const checked = adjustVehicleIds.includes(vehicle._id);
                    const hasPetFee = adjustPetFeeVehicleIds.includes(vehicle._id);
                    return (
                      <div key={vehicle._id} className="rounded-md border p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              toggleAdjustVehicle(vehicle._id, value === true)
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {vehicle.vehicleType?.name ?? vehicle.size ?? "medium"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 border-t pt-3">
                          <Checkbox
                            checked={hasPetFee}
                            disabled={!checked}
                            onCheckedChange={(value) =>
                              toggleAdjustPetFeeVehicle(vehicle._id, value === true)
                            }
                          />
                          <span className="text-sm">Pet hair fee</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <Label>Services</Label>
                <p className="text-xs text-muted-foreground">
                  Pricing and duration recalculate from the selected vehicles.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {allServiceOptions
                  .filter((service) => service.isActive)
                  .map((service) => {
                    const selected = adjustServiceIds.includes(service._id);
                    return (
                      <button
                        type="button"
                        key={service._id}
                        className={`rounded-md border p-3 text-left transition-colors ${
                          selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleAdjustService(service._id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.duration} min
                            </p>
                          </div>
                          <Checkbox checked={selected} />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>

            <section className="rounded-md border bg-muted/30 p-4">
              {adjustVehicleIds.length === 0 || adjustServiceIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Select at least one vehicle and one service to preview the change.
                </p>
              ) : adjustmentPreview === undefined ? (
                <p className="text-sm text-muted-foreground">Calculating adjustment...</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Price change</p>
                      <p className={adjustmentPreview.priceDelta >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"}>
                        {adjustmentPreview.priceDelta >= 0 ? "+" : ""}
                        {formatCurrency(adjustmentPreview.priceDelta)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duration change</p>
                      <p className="font-semibold">
                        {formatMinutes(adjustmentPreview.durationDelta)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">New total</p>
                      <p className="font-semibold">
                        {formatCurrency(adjustmentPreview.newTotalPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      {formatCurrency(adjustmentPreview.oldTotalPrice)} to{" "}
                      {formatCurrency(adjustmentPreview.newTotalPrice)}
                    </span>
                    <span>
                      {adjustmentPreview.oldDuration} min to {adjustmentPreview.newDuration} min
                    </span>
                    {adjustmentPreview.invoiceStatus && (
                      <span>Invoice: {adjustmentPreview.invoiceStatus}</span>
                    )}
                  </div>
                  {adjustmentPreview.invoicePaid && adjustmentPreview.priceDelta > 0 && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                      The paid invoice will stay locked. A supplemental invoice will be created for the added amount.
                    </div>
                  )}
                  {adjustmentBlockedByCredit && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      This lowers a paid invoice. Use a refund or credit workflow before applying this change.
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Reason</Label>
              <Textarea
                id="adjustment-reason"
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                placeholder="Example: added pet hair and second vehicle on arrival"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustingWork(false)}
                disabled={adjustLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleApplyWorkAdjustment()}
                disabled={
                  adjustLoading ||
                  adjustmentBlockedByCredit ||
                  adjustVehicleIds.length === 0 ||
                  adjustServiceIds.length === 0
                }
              >
                {adjustLoading ? "Applying..." : "Apply Adjustment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewPhoto}
        onOpenChange={(open) => !open && setPreviewPhoto(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewPhoto?.fileName || "Before Photo"}</DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewPhoto.url}
                alt={previewPhoto.fileName}
                className="max-h-[75vh] w-full rounded-md object-contain"
              />
              <Button variant="outline" asChild>
                <a href={previewPhoto.url} target="_blank" rel="noreferrer">
                  Open original
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
