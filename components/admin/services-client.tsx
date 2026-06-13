"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Edit,
  MapPin,
  MoreHorizontal,
  Plus,
  Route,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { DEFAULT_PET_FEE_TIME_MINUTES } from "@/convex/lib/booking";
import RadarAddressField, {
  type RadarLocationValue,
} from "@/components/ui/radar-address-field";

type ServiceRecord = {
  _id: Id<"services">;
  name: string;
  description: string;
  icon?: string;
  serviceType?: "standard" | "addon" | "subscription";
  serviceTypeLabel?: string;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  basePrice?: number;
  duration: number;
  bookings?: number;
  popularity?: string;
  isActive: boolean;
  showOnLandingPage?: boolean;
  categoryId?: Id<"serviceCategories">;
  includedServiceIds?: Id<"services">[];
  features?: string[];
  vehiclePrices?: Array<{
    vehicleTypeId: Id<"vehicleTypes">;
    price: number;
    duration: number;
    isAvailable: boolean;
    vehicleType?: {
      name: string;
    } | null;
  }>;
};

export default function ServicesClient() {
  const router = useRouter();
  const servicesQuery = useQuery(api.services.listWithBookingStats) as
    | ServiceRecord[]
    | null
    | undefined;
  const deleteService = useMutation(api.services.deleteService);
  const updateService = useMutation(api.services.update);
  const depositSettings = useQuery(api.depositSettings.get);
  const updateDepositSettings = useMutation(api.depositSettings.upsert);
  const petFeeSettings = useQuery(api.petFeeSettings.get);
  const updatePetFeeSettings = useMutation(api.petFeeSettings.upsert);

  const [showServiceTypeDialog, setShowServiceTypeDialog] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Id<"services"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"services"> | null>(null);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<Id<"services"> | null>(null);

  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(depositSettings?.amountPerVehicle ?? 50);
  const [isEditingPetFee, setIsEditingPetFee] = useState(false);
  const [petFeePrices, setPetFeePrices] = useState({
    basePriceSmall: 50,
    basePriceMedium: 50,
    basePriceLarge: 50,
    timeAddMinutes: DEFAULT_PET_FEE_TIME_MINUTES,
    isActive: true,
  });
  const travelFeeSettings = useQuery(api.travelFeeSettings.get);
  const validateTravelFeeOrigin = useAction(
    api.travelFeeSettings.validateOriginAndUpsert,
  );
  const updateTravelFeeRules = useMutation(api.travelFeeSettings.updateRules);
  const [isEditingTravelFee, setIsEditingTravelFee] = useState(false);
  const [isReplacingTravelOrigin, setIsReplacingTravelOrigin] = useState(false);
  const [pendingTravelOrigin, setPendingTravelOrigin] =
    useState<RadarLocationValue | null>(null);
  const [travelFeeValues, setTravelFeeValues] = useState({
    originStreet: "220 N. Tyler St",
    originCity: "Little Rock",
    originState: "AR",
    originZip: "72205",
    originLatitude: 34.752258,
    originLongitude: -92.329768,
    freeRadiusMiles: 20,
    midRangeMaxMiles: 35,
    longRangeMaxMiles: 50,
    midRangeFee: 25,
    longRangeFee: 50,
    perMileRateAfterLongRange: 2,
    midRangeBufferMinutes: 30,
    longRangeBufferMinutes: 60,
    isActive: true,
    tier1Min: 21,
    tier2Min: 36,
  });

  useEffect(() => {
    if (depositSettings) {
      setDepositAmount(depositSettings.amountPerVehicle);
    }
  }, [depositSettings]);

  useEffect(() => {
    if (petFeeSettings) {
      setPetFeePrices({
        ...petFeeSettings,
        timeAddMinutes:
          petFeeSettings.timeAddMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES,
      });
    }
  }, [petFeeSettings]);

  useEffect(() => {
    if (travelFeeSettings) {
      setTravelFeeValues({
        ...travelFeeSettings,
        tier1Min: travelFeeSettings.freeRadiusMiles + 1,
        tier2Min: travelFeeSettings.midRangeMaxMiles + 1,
      });
    }
  }, [travelFeeSettings]);

  const travelFeeValidationMessage = useMemo(() => {
    const requiredNumbers = [
      travelFeeValues.freeRadiusMiles,
      travelFeeValues.midRangeMaxMiles,
      travelFeeValues.longRangeMaxMiles,
      travelFeeValues.midRangeFee,
      travelFeeValues.longRangeFee,
      travelFeeValues.perMileRateAfterLongRange,
      travelFeeValues.midRangeBufferMinutes,
      travelFeeValues.longRangeBufferMinutes,
      travelFeeValues.tier1Min,
      travelFeeValues.tier2Min,
    ];

    if (requiredNumbers.some((value) => !Number.isFinite(value) || value < 0)) {
      return "All mile, fee, and travel-time values must be zero or greater.";
    }

    // Gap / Overlap validation for Tier 1 start relative to freeRadiusMiles
    if (travelFeeValues.tier1Min > travelFeeValues.freeRadiusMiles + 1) {
      return `Gap detected: There is a missing range between Free Travel (0-${travelFeeValues.freeRadiusMiles} mi) and Tier 1 (starts at ${travelFeeValues.tier1Min} mi). Tier 1 must start at ${travelFeeValues.freeRadiusMiles + 1} mi.`;
    }
    if (travelFeeValues.tier1Min <= travelFeeValues.freeRadiusMiles) {
      return `Overlap detected: Tier 1 starts at ${travelFeeValues.tier1Min} mi but Free Travel goes up to ${travelFeeValues.freeRadiusMiles} mi. Tier 1 must start at ${travelFeeValues.freeRadiusMiles + 1} mi.`;
    }

    // Ordering validation for Tier 1
    if (travelFeeValues.midRangeMaxMiles < travelFeeValues.tier1Min) {
      return "Tier 1 end miles must be greater than or equal to its start miles.";
    }

    // Gap / Overlap validation for Tier 2 start relative to Tier 1 end
    if (travelFeeValues.tier2Min > travelFeeValues.midRangeMaxMiles + 1) {
      return `Gap detected: There is a missing range between Tier 1 (ends at ${travelFeeValues.midRangeMaxMiles} mi) and Tier 2 (starts at ${travelFeeValues.tier2Min} mi). Tier 2 must start at ${travelFeeValues.midRangeMaxMiles + 1} mi.`;
    }
    if (travelFeeValues.tier2Min <= travelFeeValues.midRangeMaxMiles) {
      return `Overlap detected: Tier 2 starts at ${travelFeeValues.tier2Min} mi but Tier 1 goes up to ${travelFeeValues.midRangeMaxMiles} mi. Tier 2 must start at ${travelFeeValues.midRangeMaxMiles + 1} mi.`;
    }

    // Ordering validation for Tier 2
    if (travelFeeValues.longRangeMaxMiles < travelFeeValues.tier2Min) {
      return "Tier 2 end miles must be greater than or equal to its start miles.";
    }

    return "";
  }, [travelFeeValues]);

  const updateTravelNumber = (
    key:
      | "freeRadiusMiles"
      | "midRangeMaxMiles"
      | "longRangeMaxMiles"
      | "midRangeFee"
      | "longRangeFee"
      | "perMileRateAfterLongRange"
      | "midRangeBufferMinutes"
      | "longRangeBufferMinutes"
      | "tier1Min"
      | "tier2Min",
    value: number,
  ) => {
    setTravelFeeValues((current) => {
      const next = { ...current, [key]: Number.isFinite(value) ? value : 0 };
      return next;
    });
  };

  const resetTravelFeeEditing = () => {
    setIsEditingTravelFee(false);
    setIsReplacingTravelOrigin(false);
    setPendingTravelOrigin(null);
    if (travelFeeSettings) {
      setTravelFeeValues({
        ...travelFeeSettings,
        tier1Min: travelFeeSettings.freeRadiusMiles + 1,
        tier2Min: travelFeeSettings.midRangeMaxMiles + 1,
      });
    }
  };

  if (servicesQuery === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Services</h2>
            <p className="mt-1 text-muted-foreground">Manage your service offerings</p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <Card>
          <CardContent className="py-10">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (servicesQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Services</h2>
          <p className="mt-1 text-muted-foreground">Manage your service offerings</p>
        </div>

        <Card className="py-12 text-center">
          <CardContent>
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Unable to load services</h3>
            <p className="mb-6 text-muted-foreground">
              There was an error loading services. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const services = servicesQuery;

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const formatTypeLabel = (service: ServiceRecord) => {
    if (service.serviceTypeLabel) return service.serviceTypeLabel;
    if (service.serviceType === "addon") return "Add-on Services";
    if (service.serviceType === "subscription") return "Subscription Plans";
    return "Standard Services";
  };

  const formatPricing = (service: ServiceRecord) => {
    if (service.vehiclePrices?.length) {
      const parts = service.vehiclePrices
        .filter((price) => price.isAvailable && price.price > 0)
        .map(
          (price) =>
            `${price.vehicleType?.name ?? "Vehicle"} $${price.price.toFixed(0)}`,
        );
      if (parts.length > 0) return parts.join(" • ");
    }

    const small = service.basePriceSmall ?? service.basePrice;
    const medium = service.basePriceMedium ?? service.basePrice;
    const large = service.basePriceLarge ?? service.basePrice;

    const parts: string[] = [];
    if (small !== undefined) parts.push(`S $${small.toFixed(0)}`);
    if (medium !== undefined) parts.push(`M $${medium.toFixed(0)}`);
    if (large !== undefined) parts.push(`L $${large.toFixed(0)}`);
    return parts.join(" • ") || "N/A";
  };

  const formatPetFeePricing = () => {
    const settings = petFeeSettings ?? petFeePrices;
    if (!settings.isActive) return "off";
    return `S $${settings.basePriceSmall.toFixed(0)} • M $${settings.basePriceMedium.toFixed(0)} • L $${settings.basePriceLarge.toFixed(0)} • +${settings.timeAddMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES} min`;
  };

  const formatTravelFeePricing = () => {
    const settings = travelFeeSettings ?? travelFeeValues;
    if (!settings.isActive) return "off";
    return `0-${
      settings.freeRadiusMiles
    } mi free • ${settings.freeRadiusMiles + 1}-${
      settings.midRangeMaxMiles
    } mi $${settings.midRangeFee.toFixed(0)} • ${
      settings.midRangeMaxMiles + 1
    }-${
      settings.longRangeMaxMiles
    } mi $${settings.longRangeFee.toFixed(0)} • $${settings.perMileRateAfterLongRange.toFixed(2)}/mi after`;
  };

  const travelOriginLabel = [
    travelFeeValues.originStreet,
    travelFeeValues.originCity,
    travelFeeValues.originState,
    travelFeeValues.originZip,
  ]
    .filter(Boolean)
    .join(", ");

  const pendingOriginParts = () => {
    const addressLabel = pendingTravelOrigin?.addressLabel ?? "";
    return {
      originStreet:
        pendingTravelOrigin?.street || addressLabel.split(",")[0]?.trim() || "",
      originCity: pendingTravelOrigin?.city || "",
      originState: pendingTravelOrigin?.state || "",
      originZip: pendingTravelOrigin?.postalCode || "",
    };
  };

  const travelRulePayload = {
    freeRadiusMiles: travelFeeValues.freeRadiusMiles,
    midRangeMaxMiles: travelFeeValues.midRangeMaxMiles,
    longRangeMaxMiles: travelFeeValues.longRangeMaxMiles,
    midRangeFee: travelFeeValues.midRangeFee,
    longRangeFee: travelFeeValues.longRangeFee,
    perMileRateAfterLongRange: travelFeeValues.perMileRateAfterLongRange,
    midRangeBufferMinutes: travelFeeValues.midRangeBufferMinutes,
    longRangeBufferMinutes: travelFeeValues.longRangeBufferMinutes,
    isActive: travelFeeValues.isActive,
  };

  const saveTravelFeeRules = async () => {
    if (travelFeeValidationMessage) {
      toast.error(travelFeeValidationMessage);
      return;
    }

    try {
      await updateTravelFeeRules(travelRulePayload);
      setIsEditingTravelFee(false);
      setIsReplacingTravelOrigin(false);
      setPendingTravelOrigin(null);
      toast.success("Travel fee settings updated");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update travel fee settings";
      toast.error(message);
    }
  };

  const saveTravelOrigin = async () => {
    if (travelFeeValidationMessage) {
      toast.error(travelFeeValidationMessage);
      return;
    }

    const origin = pendingOriginParts();
    if (
      !pendingTravelOrigin ||
      !origin.originStreet ||
      !origin.originCity ||
      !origin.originState ||
      !origin.originZip
    ) {
      toast.error("Select a validated origin address before saving.");
      return;
    }

    try {
      await validateTravelFeeOrigin({
        ...origin,
        ...travelRulePayload,
      });
      setIsReplacingTravelOrigin(false);
      setPendingTravelOrigin(null);
      toast.success("Travel origin validated and saved");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to validate travel origin";
      toast.error(message);
    }
  };

  const popularityBadgeClass = (popularity?: string) => {
    switch (popularity) {
      case "Very High":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "High":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "Medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    setDeletingId(serviceToDelete);
    setServiceToDelete(null);

    try {
      await deleteService({ serviceId: serviceToDelete });
      toast.success("Service deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete service");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleServiceVisibility = async (service: ServiceRecord) => {
    setUpdatingVisibilityId(service._id);
    try {
      await updateService({
        serviceId: service._id,
        name: service.name,
        description: service.description,
        basePriceSmall: service.basePriceSmall ?? service.basePrice ?? 0,
        basePriceMedium: service.basePriceMedium ?? service.basePrice ?? 0,
        basePriceLarge: service.basePriceLarge ?? service.basePrice ?? 0,
        vehiclePrices: service.vehiclePrices?.map((price) => ({
          vehicleTypeId: price.vehicleTypeId,
          price: price.price,
          duration: price.duration,
          isAvailable: price.isAvailable,
        })),
        duration: service.duration,
        serviceType: service.serviceType ?? "standard",
        categoryId: service.categoryId,
        includedServiceIds: service.includedServiceIds,
        features: service.features,
        icon: service.icon,
        isActive: !service.isActive,
        showOnLandingPage: service.showOnLandingPage ?? true,
      });

      toast.success(service.isActive ? "Service hidden" : "Service made visible");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update service visibility");
    } finally {
      setUpdatingVisibilityId(null);
    }
  };

  const columns: ColumnDef<ServiceRecord>[] = [
    {
      id: "name",
      accessorFn: (row) => row.name,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[260px] max-w-[400px] whitespace-normal">
          <div className="flex items-center gap-2">
            {row.original.icon ? <span className="text-lg">{row.original.icon}</span> : null}
            <span className="font-medium">{row.original.name}</span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground whitespace-normal break-words">
            {row.original.description}
          </p>
        </div>
      ),
    },
    {
      id: "serviceType",
      accessorFn: (row) => row.serviceType ?? "standard",
      header: "Type",
      cell: ({ row }) => (
        <span className="min-w-[150px] text-sm text-muted-foreground">
          {formatTypeLabel(row.original)}
        </span>
      ),
    },
    {
      id: "pricing",
      accessorFn: (row) => formatPricing(row),
      header: "Pricing",
      cell: ({ row }) => <span className="min-w-[170px] text-sm">{formatPricing(row.original)}</span>,
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => <span>{formatDuration(row.original.duration)}</span>,
    },
    {
      id: "bookings",
      accessorFn: (row) => row.bookings ?? 0,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Bookings
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{row.original.bookings ?? 0}</span>,
    },
    {
      id: "popularity",
      accessorFn: (row) => row.popularity ?? "Low",
      header: "Popularity",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${popularityBadgeClass(
            row.original.popularity,
          )}`}
        >
          {row.original.popularity || "Low"}
        </span>
      ),
    },
    {
      id: "visibility",
      accessorFn: (row) => (row.isActive ? "active" : "hidden"),
      header: "Visibility",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Bookable" : "Hidden"}
          </Badge>
          <Badge
            variant={row.original.showOnLandingPage !== false ? "outline" : "secondary"}
          >
            {row.original.showOnLandingPage !== false ? "Landing" : "No landing"}
          </Badge>
        </div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const service = row.original;
        const isBusy = deletingId === service._id || updatingVisibilityId === service._id;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" disabled={isBusy}>
                <span className="sr-only">Open actions</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => router.push(`/admin/services/${service._id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void toggleServiceVisibility(service)}>
                {service.isActive ? "Hide" : "Show"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setServiceToDelete(service._id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-bold">Services</h2>
          {isEditingDeposit ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Deposit:</span>
              <Input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(event) => setDepositAmount(parseFloat(event.target.value) || 50)}
                className="w-24"
              />
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await updateDepositSettings({ amountPerVehicle: depositAmount });
                    setIsEditingDeposit(false);
                    toast.success("Deposit amount updated");
                    router.refresh();
                  } catch {
                    toast.error("Failed to update deposit amount");
                  }
                }}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditingDeposit(false);
                  setDepositAmount(depositSettings?.amountPerVehicle ?? 50);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                <strong className="font-bold text-foreground">Deposit:</strong> ${depositSettings?.amountPerVehicle ?? 50} per vehicle
              </span>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingDeposit(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isEditingPetFee ? (
            <div className="flex flex-wrap items-end gap-2 rounded-md border p-2">
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={petFeePrices.isActive}
                  onCheckedChange={(checked) =>
                    setPetFeePrices((current) => ({ ...current, isActive: checked }))
                  }
                />
                <strong className="font-bold text-foreground text-sm">Pet fee</strong>
              </div>
              {[
                ["basePriceSmall", "Small"],
                ["basePriceMedium", "Medium"],
                ["basePriceLarge", "Large"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={petFeePrices[key as keyof typeof petFeePrices] as number}
                    onChange={(event) =>
                      setPetFeePrices((current) => ({
                        ...current,
                        [key]: parseFloat(event.target.value) || 0,
                      }))
                    }
                    className="w-20"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Extra min</Label>
                <Input
                  type="number"
                  step="5"
                  value={petFeePrices.timeAddMinutes}
                  onChange={(event) =>
                    setPetFeePrices((current) => ({
                      ...current,
                      timeAddMinutes: parseInt(event.target.value, 10) || 0,
                    }))
                  }
                  className="w-24"
                />
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await updatePetFeeSettings(petFeePrices);
                    setIsEditingPetFee(false);
                    toast.success("Pet fee updated");
                    router.refresh();
                  } catch {
                    toast.error("Failed to update pet fee");
                  }
                }}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditingPetFee(false);
                  if (petFeeSettings) {
                    setPetFeePrices({
                      ...petFeeSettings,
                      timeAddMinutes:
                        petFeeSettings.timeAddMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES,
                    });
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                <strong className="font-bold text-foreground">Pet fee:</strong> {formatPetFeePricing()}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingPetFee(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isEditingTravelFee ? (
            <div className="w-full space-y-4 rounded-md border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={travelFeeValues.isActive}
                      onCheckedChange={(checked) =>
                        setTravelFeeValues((current) => ({
                          ...current,
                          isActive: checked,
                        }))
                      }
                    />
                    <h3 className="text-sm font-semibold">Travel fee rules</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong className="font-bold text-foreground">Travel:</strong> {formatTravelFeePricing()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveTravelFeeRules}
                    disabled={Boolean(travelFeeValidationMessage)}
                  >
                    <Save className="h-4 w-4" />
                    Save rules
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetTravelFeeEditing}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-medium">Validated service origin</p>
                        <p className="break-words text-sm text-muted-foreground">
                          {travelOriginLabel}
                        </p>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Coordinates saved
                      </Badge>
                      {isReplacingTravelOrigin ? (
                        <div className="space-y-3 pt-1">
                          <RadarAddressField
                            label="New origin address"
                            placeholder="Search for the new starting point"
                            value={pendingTravelOrigin}
                            onSelect={setPendingTravelOrigin}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={saveTravelOrigin}
                              disabled={!pendingTravelOrigin}
                            >
                              <Save className="h-4 w-4" />
                              Validate origin
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsReplacingTravelOrigin(false);
                                setPendingTravelOrigin(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsReplacingTravelOrigin(true)}
                        >
                          Replace origin
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <Route className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-medium">Free travel limit</p>
                        <p className="text-xs text-muted-foreground">
                          Appointments within this radius have no travel fee.
                        </p>
                      </div>
                      <div className="max-w-[12rem] space-y-1">
                        <Label className="text-xs">Free through mi</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={travelFeeValues.freeRadiusMiles}
                          onChange={(event) =>
                            updateTravelNumber(
                              "freeRadiusMiles",
                              Math.floor(Number.parseFloat(event.target.value) || 0),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border p-3 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Tier 1</p>
                      <p className="text-xs text-muted-foreground">
                        {travelFeeValues.tier1Min}-{travelFeeValues.midRangeMaxMiles} miles
                      </p>
                    </div>
                    <Badge variant="secondary">
                      +{travelFeeValues.midRangeBufferMinutes} min
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{travelFeeValues.tier1Min} mi</span>
                      <span>{travelFeeValues.midRangeMaxMiles} mi</span>
                    </div>
                    <Slider
                      min={0}
                      max={Math.max(100, travelFeeValues.longRangeMaxMiles + 20)}
                      step={1}
                      minStepsBetweenThumbs={1}
                      value={[
                        travelFeeValues.tier1Min,
                        travelFeeValues.midRangeMaxMiles,
                      ]}
                      onValueChange={(value) => {
                        const minVal = value[0] ?? travelFeeValues.tier1Min;
                        const maxVal = value[1] ?? travelFeeValues.midRangeMaxMiles;
                        setTravelFeeValues((current) => ({
                          ...current,
                          tier1Min: minVal,
                          midRangeMaxMiles: maxVal,
                        }));
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Fee ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={travelFeeValues.midRangeFee}
                        onChange={(event) =>
                          updateTravelNumber(
                            "midRangeFee",
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Extra Time (min)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        value={travelFeeValues.midRangeBufferMinutes}
                        onChange={(event) =>
                          updateTravelNumber(
                            "midRangeBufferMinutes",
                            Math.floor(Number.parseFloat(event.target.value) || 0),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Tier 2</p>
                      <p className="text-xs text-muted-foreground">
                        {travelFeeValues.tier2Min}-{travelFeeValues.longRangeMaxMiles} miles
                      </p>
                    </div>
                    <Badge variant="secondary">
                      +{travelFeeValues.longRangeBufferMinutes} min
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{travelFeeValues.tier2Min} mi</span>
                      <span>{travelFeeValues.longRangeMaxMiles} mi</span>
                    </div>
                    <Slider
                      min={0}
                      max={Math.max(100, travelFeeValues.longRangeMaxMiles + 20)}
                      step={1}
                      minStepsBetweenThumbs={1}
                      value={[
                        travelFeeValues.tier2Min,
                        travelFeeValues.longRangeMaxMiles,
                      ]}
                      onValueChange={(value) => {
                        const minVal = value[0] ?? travelFeeValues.tier2Min;
                        const maxVal = value[1] ?? travelFeeValues.longRangeMaxMiles;
                        setTravelFeeValues((current) => ({
                          ...current,
                          tier2Min: minVal,
                          longRangeMaxMiles: maxVal,
                        }));
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Fee ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={travelFeeValues.longRangeFee}
                        onChange={(event) =>
                          updateTravelNumber(
                            "longRangeFee",
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Extra Time (min)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        value={travelFeeValues.longRangeBufferMinutes}
                        onChange={(event) =>
                          updateTravelNumber(
                            "longRangeBufferMinutes",
                            Math.floor(Number.parseFloat(event.target.value) || 0),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-3 flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Over Tier 2</p>
                      <p className="text-xs text-muted-foreground">
                        After {travelFeeValues.longRangeMaxMiles} miles, charge Tier 2
                        plus a per-mile rate.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Base fee</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={travelFeeValues.longRangeFee}
                        onChange={(event) =>
                          updateTravelNumber(
                            "longRangeFee",
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">$/mi after</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={travelFeeValues.perMileRateAfterLongRange}
                        onChange={(event) =>
                          updateTravelNumber(
                            "perMileRateAfterLongRange",
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {travelFeeValidationMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {travelFeeValidationMessage}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                <strong className="font-bold text-foreground">Travel:</strong> {formatTravelFeePricing()}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingTravelFee(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Button onClick={() => setShowServiceTypeDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create a Service
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={services}
        filterColumn="name"
        filterPlaceholder="Search services by name..."
        tableMinWidthClass="min-w-[1340px]"
      />

      <Dialog open={showServiceTypeDialog} onOpenChange={setShowServiceTypeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Service</DialogTitle>
            <DialogDescription>
              Choose the type of service you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-auto justify-start p-4"
              onClick={() => {
                setShowServiceTypeDialog(false);
                router.push("/admin/services/new?type=standard");
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Standard Service</div>
                <div className="text-sm text-muted-foreground">
                  Main packages with pricing and duration by vehicle type
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start p-4"
              onClick={() => {
                setShowServiceTypeDialog(false);
                router.push("/admin/services/new?type=addon");
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Add-on Service</div>
                <div className="text-sm text-muted-foreground">
                  Extras available to selected vehicle types
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start p-4"
              onClick={() => {
                setShowServiceTypeDialog(false);
                router.push("/admin/services/new?type=subscription");
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Subscription Plan</div>
                <div className="text-sm text-muted-foreground">
                  Recurring products with vehicle-specific pricing
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This permanently deletes a service only when it has never been used in any appointment.
              For used services, hide them instead.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setServiceToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Service
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
