import * as React from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Doc, Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import {
  calculateSchedulingDuration,
} from "@rivercitymd/backend/convex/lib/booking";
import {
  getEffectiveServicePricingForVehicle,
  isServiceAvailableForVehicle,
  normalizeServiceType,
  type ServiceType,
  type VehicleSize,
} from "@rivercitymd/backend/convex/lib/pricing";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Dog,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react-native";

import { BrandMark } from "@/components/brand-mark";
import { Screen, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { AddressSearch, type AddressValue, type TravelQuote } from "@/components/forms/address-search";
import { VehicleLookup, type VehicleLookupValue } from "@/components/forms/vehicle-lookup";
import { TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { THEME } from "@/lib/theme";

type Step = 1 | 2 | 3 | 4;

export default function BookScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const myVehicles = useQuery(
    api.vehicles.getByUser,
    currentUser ? { userId: currentUser._id } : "skip",
  );
  const allServices = useQuery(api.services.list) as Doc<"services">[] | undefined;
  const petFeeSettings = useQuery(api.petFeeSettings.get);
  const depositSettings = useQuery(api.depositSettings.get);

  const upsertBookingDraft = useAction(api.bookingDrafts.createOrUpdate);
  const createBookingCheckout = useAction(api.payments.createBookingCheckout);

  const [step, setStep] = React.useState<Step>(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1: Location & Date/Time
  const [address, setAddress] = React.useState<AddressValue>({
    street: currentUser?.address?.street || "",
    city: currentUser?.address?.city || "",
    state: currentUser?.address?.state || "AR",
    zip: currentUser?.address?.zip || "",
  });
  const [travelQuote, setTravelQuote] = React.useState<TravelQuote | null>(null);
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [scheduledTime, setScheduledTime] = React.useState("");

  // Sync user's default address when loaded
  React.useEffect(() => {
    if (currentUser?.address && !address.street) {
      setAddress({
        street: currentUser.address.street || "",
        city: currentUser.address.city || "",
        state: currentUser.address.state || "AR",
        zip: currentUser.address.zip || "",
      });
    }
  }, [currentUser?.address, address.street]);

  // Step 2: Vehicles & Condition
  const [selectedVehicleIds, setSelectedVehicleIds] = React.useState<string[]>([]);
  const [adHocVehicles, setAdHocVehicles] = React.useState<VehicleLookupValue[]>([]);
  const [hasPet, setHasPet] = React.useState(false);
  const [hasHeavySoil, setHasHeavySoil] = React.useState(false);
  const [smsOptIn, setSmsOptIn] = React.useState(
    currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn ?? true,
  );

  // Pre-select first vehicle when loaded
  React.useEffect(() => {
    if (myVehicles && myVehicles.length > 0 && selectedVehicleIds.length === 0 && adHocVehicles.length === 0) {
      setSelectedVehicleIds([myVehicles[0]._id]);
    }
  }, [myVehicles, selectedVehicleIds.length, adHocVehicles.length]);

  // Step 3: Per-vehicle service selection
  // Map of vehicleKey -> array of selected service IDs
  const [vehicleServices, setVehicleServices] = React.useState<Record<string, string[]>>({});
  const [expandedVehicleIndex, setExpandedVehicleIndex] = React.useState<number>(0);

  // Step 4: Payment option
  const [paymentOption, setPaymentOption] = React.useState<"deposit" | "full" | "in_person">("deposit");

  // Combined vehicle list for service selection
  const targetVehicles = React.useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      size: VehicleSize;
      vehicleTypeId?: Id<"vehicleTypes">;
      existingId?: Id<"vehicles">;
      details?: VehicleLookupValue;
    }> = [];

    // From saved vehicles
    if (myVehicles) {
      for (const v of myVehicles) {
        if (selectedVehicleIds.includes(v._id)) {
          list.push({
            key: v._id,
            label: `${v.year} ${v.make} ${v.model}`,
            size: (v.size as VehicleSize) || "medium",
            vehicleTypeId: v.vehicleTypeId,
            existingId: v._id,
          });
        }
      }
    }

    // From ad-hoc vehicles
    adHocVehicles.forEach((v, index) => {
      if (v.year && v.make && v.model) {
        list.push({
          key: `adhoc-${index}`,
          label: `${v.year} ${v.make} ${v.model}`,
          size: v.size || "medium",
          vehicleTypeId: v.vehicleTypeId as Id<"vehicleTypes"> | undefined,
          details: v,
        });
      }
    });

    return list;
  }, [myVehicles, selectedVehicleIds, adHocVehicles]);

  // Pricing & duration calculations
  const { totalServicePrice, totalDurationMinutes, perVehicleBreakdown } = React.useMemo(() => {
    let servicePrice = 0;
    const durations: number[] = [];
    const breakdown: Array<{
      vehicleLabel: string;
      services: Array<{ name: string; price: number }>;
      subtotal: number;
    }> = [];

    if (!allServices) return { totalServicePrice: 0, totalDurationMinutes: 60, perVehicleBreakdown: [] };

    targetVehicles.forEach((v) => {
      const selectedIds = vehicleServices[v.key] || [];
      const vehicleServicesList: Array<{ name: string; price: number }> = [];
      let vehicleSubtotal = 0;

      selectedIds.forEach((serviceId) => {
        const service = allServices.find((s) => s._id === serviceId);
        if (!service) return;

        const pricing = getEffectiveServicePricingForVehicle(service, {
          vehicleSize: v.size,
          vehicleTypeId: v.vehicleTypeId,
        });

        servicePrice += pricing.price;
        vehicleSubtotal += pricing.price;
        durations.push(pricing.duration);
        vehicleServicesList.push({ name: service.name, price: pricing.price });
      });

      breakdown.push({
        vehicleLabel: v.label,
        services: vehicleServicesList,
        subtotal: vehicleSubtotal,
      });
    });

    const calculatedDuration = calculateSchedulingDuration({
      serviceDurations: durations.length > 0 ? durations : [60],
      petFeeVehicleCount: hasPet && petFeeSettings?.isActive !== false ? targetVehicles.length : 0,
      petFeeTimeMinutes: petFeeSettings?.timeAddMinutes,
      travelBufferMinutes: travelQuote?.bufferMinutes,
    });

    return {
      totalServicePrice: servicePrice,
      totalDurationMinutes: calculatedDuration,
      perVehicleBreakdown: breakdown,
    };
  }, [allServices, targetVehicles, vehicleServices, hasPet, petFeeSettings, travelQuote]);

  // Pet fee & travel fee
  const petFeeTotal = React.useMemo(() => {
    if (!hasPet || petFeeSettings?.isActive === false) return 0;
    const rate = petFeeSettings?.basePriceMedium ?? 50;
    return rate * Math.max(1, targetVehicles.length);
  }, [hasPet, petFeeSettings, targetVehicles.length]);

  const travelFeeTotal = travelQuote?.fee ?? 0;
  const depositAmountPerVehicle = depositSettings?.amountPerVehicle ?? 50;
  const depositTotal = depositAmountPerVehicle * Math.max(1, targetVehicles.length);
  const grandTotal = totalServicePrice + petFeeTotal + travelFeeTotal;
  const dueNow = paymentOption === "full" ? grandTotal : Math.min(depositTotal, grandTotal);

  // Toggle a service for a vehicle
  const handleToggleService = (vehicleKey: string, service: Doc<"services">) => {
    const current = vehicleServices[vehicleKey] || [];
    const isSelected = current.includes(service._id);
    const serviceType = normalizeServiceType(service.serviceType);

    if (isSelected) {
      setVehicleServices({
        ...vehicleServices,
        [vehicleKey]: current.filter((id) => id !== service._id),
      });
    } else {
      // If choosing a standard package, replace other standard packages for this vehicle
      if (serviceType === "standard") {
        const standardIds = new Set(
          allServices?.filter((s) => normalizeServiceType(s.serviceType) === "standard").map((s) => s._id) || [],
        );
        const withoutStandards = current.filter((id) => !standardIds.has(id as Id<"services">));
        setVehicleServices({
          ...vehicleServices,
          [vehicleKey]: [...withoutStandards, service._id],
        });
      } else {
        setVehicleServices({
          ...vehicleServices,
          [vehicleKey]: [...current, service._id],
        });
      }
    }
  };

  // Step Validation
  const canContinue = () => {
    if (step === 1) {
      return Boolean(
        address.street?.trim() &&
        address.city?.trim() &&
        address.state?.trim() &&
        address.zip?.trim() &&
        scheduledDate &&
        scheduledTime,
      );
    }
    if (step === 2) {
      return targetVehicles.length > 0;
    }
    if (step === 3) {
      // Every selected vehicle must have at least 1 package selected
      return targetVehicles.every((v) => {
        const chosen = vehicleServices[v.key] || [];
        const hasStandard = chosen.some((id) => {
          const s = allServices?.find((srv) => srv._id === id);
          return s && normalizeServiceType(s.serviceType) === "standard";
        });
        return hasStandard;
      });
    }
    return true;
  };

  const handleNextStep = () => {
    setError(null);
    if (!canContinue()) {
      if (step === 1) setError("Please select your address, date, and a time slot.");
      else if (step === 2) setError("Please select at least one vehicle to service.");
      else if (step === 3) setError("Please select a base package for every vehicle.");
      return;
    }
    if (step < 4) setStep((s) => (s + 1) as Step);
  };

  const handlePrevStep = () => {
    setError(null);
    if (step > 1) setStep((s) => (s - 1) as Step);
    else router.back();
  };

  const handleSubmitBooking = async () => {
    if (!currentUser) {
      setError("Please sign in to complete your booking.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Gather all selected service IDs across vehicles
      const allSelectedServiceIds = Array.from(
        new Set(Object.values(vehicleServices).flat()),
      ) as Id<"services">[];

      const existingVehicleIds = targetVehicles
        .map((v) => v.existingId)
        .filter(Boolean) as Id<"vehicles">[];

      const newVehiclesList = targetVehicles
        .filter((v) => !v.existingId && v.details)
        .map((v) => ({
          year: Number(v.details!.year),
          make: v.details!.make,
          model: v.details!.model,
          color: v.details!.color,
          size: v.size,
          vehicleTypeId: v.vehicleTypeId,
          classification: v.details!.classification,
        }));

      const existingVehicleServices = existingVehicleIds.map((id) => ({
        vehicleId: id,
        serviceIds: (vehicleServices[id] || []) as Id<"services">[],
      }));

      const { draftId } = await upsertBookingDraft({
        name: currentUser.name || "Customer",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        smsOptIn,
        address: {
          street: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim().toUpperCase(),
          zip: address.zip.trim(),
          notes: address.notes?.trim() || undefined,
        },
        existingVehicleIds,
        existingVehicleServices: existingVehicleServices.length > 0 ? existingVehicleServices : undefined,
        vehicles: newVehiclesList.length > 0 ? newVehiclesList : undefined,
        petFeeExistingVehicleIds: hasPet ? existingVehicleIds : [],
        serviceIds: allSelectedServiceIds,
        scheduledDate,
        scheduledTime,
        paymentOption,
      });

      if (paymentOption === "in_person") {
        Alert.alert(
          "Appointment Scheduled!",
          "Your mobile detailing appointment is requested. We'll send you an SMS confirmation shortly.",
          [{ text: "View Appointments", onPress: () => router.replace("/(tabs)/appointments") }],
        );
        return;
      }

      // Online checkout via Stripe
      const { url } = await createBookingCheckout({
        draftId,
        origin: "https://rivercitymd.com",
      });

      if (url) {
        await Linking.openURL(url);
        router.replace("/(tabs)/appointments");
      } else {
        router.replace("/(tabs)/appointments");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create appointment";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      {/* Top Header */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={handlePrevStep}
          className="flex-row items-center gap-1.5 active:opacity-70"
        >
          <ArrowLeft size={18} color={THEME.light.foreground} />
          <Text className="text-sm font-semibold">Back</Text>
        </Pressable>
        <Text className="text-xs font-bold text-accent">Step {step} of 4</Text>
      </View>

      {/* Progress Bars */}
      <View className="flex-row gap-2">
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-accent" : "bg-muted"}`}
          />
        ))}
      </View>

      {/* Title & Description */}
      <ScreenHeader
        eyebrow={
          step === 1
            ? "Service Location & Time"
            : step === 2
              ? "Select Vehicles"
              : step === 3
                ? "Choose Detailing Packages"
                : "Review & Confirmation"
        }
        title={
          step === 1
            ? "When & where should we detail?"
            : step === 2
              ? "Which vehicle(s) are we detailing?"
              : step === 3
                ? "Select services per vehicle"
                : "Appointment Summary"
        }
        description={
          step === 1
            ? "We bring all power, pure deionized water, and equipment to you."
            : step === 2
              ? "Choose from your saved garage or add a vehicle."
              : step === 3
                ? "Select a required base package, plus optional add-ons or subscriptions."
                : "Verify your service details, total pricing, and choose your payment method."
        }
      />

      {error ? (
        <View className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
          <Text className="text-sm font-medium text-destructive">{error}</Text>
        </View>
      ) : null}

      {/* STEP 1: Location, Date & Time */}
      {step === 1 ? (
        <View className="gap-5">
          <AddressSearch
            value={address}
            onChange={setAddress}
            onTravelQuoteChange={setTravelQuote}
            label="Service Location"
          />

          <TimeSlotPicker
            selectedDate={scheduledDate}
            onDateChange={setScheduledDate}
            selectedTime={scheduledTime}
            onTimeChange={setScheduledTime}
            duration={totalDurationMinutes}
          />

          <Button
            size="lg"
            disabled={!canContinue()}
            onPress={handleNextStep}
            className="w-full flex-row items-center justify-center gap-2 mt-2"
          >
            <Text className="font-bold text-primary-foreground">Continue to Vehicles</Text>
            <ArrowRight size={18} color={THEME.light.primaryForeground} />
          </Button>
        </View>
      ) : null}

      {/* STEP 2: Vehicles Selection */}
      {step === 2 ? (
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select From Your Garage
            </Text>

            {myVehicles?.length ? (
              <View className="gap-2.5">
                {myVehicles.map((v) => {
                  const isSelected = selectedVehicleIds.includes(v._id);
                  return (
                    <Pressable
                      key={v._id}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedVehicleIds((prev) =>
                          isSelected ? prev.filter((id) => id !== v._id) : [...prev, v._id],
                        );
                      }}
                      className={`flex-row items-center justify-between rounded-2xl border p-4 ${
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-card active:bg-secondary"
                      }`}
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          className={`h-10 w-10 items-center justify-center rounded-xl ${
                            isSelected ? "bg-accent text-white" : "bg-secondary"
                          }`}
                        >
                          <CarFront
                            size={20}
                            color={isSelected ? THEME.light.accentForeground : THEME.light.foreground}
                          />
                        </View>
                        <View className="gap-0.5">
                          <Text className="font-semibold text-base">
                            {v.year} {v.make} {v.model}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {v.vehicleType?.name || v.size || "Standard"} · {v.color || "No color specified"}
                          </Text>
                        </View>
                      </View>

                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full border ${
                          isSelected ? "border-accent bg-accent" : "border-border"
                        }`}
                      >
                        {isSelected ? <Check size={14} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Card className="border border-dashed">
                <CardContent className="p-4 items-center justify-center">
                  <Text className="text-sm text-muted-foreground">No vehicles saved in your garage yet.</Text>
                </CardContent>
              </Card>
            )}
          </View>

          {/* Ad-hoc Vehicle Additions */}
          {adHocVehicles.map((adhoc, idx) => (
            <VehicleLookup
              key={idx}
              title={`Additional Vehicle ${idx + 1}`}
              value={adhoc}
              onChange={(updated) =>
                setAdHocVehicles(adHocVehicles.map((v, i) => (i === idx ? updated : v)))
              }
              onRemove={() => setAdHocVehicles(adHocVehicles.filter((_, i) => i !== idx))}
            />
          ))}

          <Button
            variant="outline"
            onPress={() =>
              setAdHocVehicles([
                ...adHocVehicles,
                { year: "", make: "", model: "", size: "medium" },
              ])
            }
            className="flex-row items-center justify-center gap-2 border-dashed"
          >
            <Plus size={16} color={THEME.light.foreground} />
            <Text className="font-semibold text-sm">Add Another Vehicle</Text>
          </Button>

          {/* Condition Toggles */}
          <View className="gap-2.5 pt-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vehicle Conditions
            </Text>

            <Switch
              label="Pet Hair Present"
              description="Requires dedicated fur extraction tools and specialized enzyme sanitization."
              value={hasPet}
              onValueChange={setHasPet}
            />

            <Switch
              label="Heavy Mud / Extreme Soil"
              description="Alerts technicians to bring extended pre-soak treatments."
              value={hasHeavySoil}
              onValueChange={setHasHeavySoil}
            />

            <Switch
              label="SMS Appointment Alerts"
              description="Receive arrival notifications and status updates via text."
              value={smsOptIn}
              onValueChange={setSmsOptIn}
            />
          </View>

          <Button
            size="lg"
            disabled={!canContinue()}
            onPress={handleNextStep}
            className="w-full flex-row items-center justify-center gap-2 mt-2"
          >
            <Text className="font-bold text-primary-foreground">Continue to Services</Text>
            <ArrowRight size={18} color={THEME.light.primaryForeground} />
          </Button>
        </View>
      ) : null}

      {/* STEP 3: Per-Vehicle Service Selection */}
      {step === 3 ? (
        <View className="gap-5">
          {targetVehicles.map((v, vIndex) => {
            const isExpanded = expandedVehicleIndex === vIndex;
            const chosenServiceIds = vehicleServices[v.key] || [];

            // Group services into standard packages, add-ons, subscriptions
            const standardPackages =
              allServices?.filter(
                (s) =>
                  s.isActive &&
                  normalizeServiceType(s.serviceType) === "standard" &&
                  isServiceAvailableForVehicle(s, { vehicleSize: v.size, vehicleTypeId: v.vehicleTypeId }),
              ) || [];

            const addOns =
              allServices?.filter(
                (s) =>
                  s.isActive &&
                  normalizeServiceType(s.serviceType) === "addon" &&
                  isServiceAvailableForVehicle(s, { vehicleSize: v.size, vehicleTypeId: v.vehicleTypeId }),
              ) || [];

            const hasSelectedStandard = chosenServiceIds.some((id) => {
              const s = allServices?.find((srv) => srv._id === id);
              return s && normalizeServiceType(s.serviceType) === "standard";
            });

            return (
              <Card key={v.key} className="overflow-hidden border border-border">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedVehicleIndex(isExpanded ? -1 : vIndex)}
                  className="flex-row items-center justify-between p-4 bg-secondary/50 active:bg-secondary"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
                      <CarFront size={18} color={THEME.light.accent} />
                    </View>
                    <View className="gap-0.5">
                      <Text className="font-bold text-base">{v.label}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {chosenServiceIds.length} service(s) selected
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    {hasSelectedStandard ? (
                      <Badge variant="success" size="sm" label="Package Selected" />
                    ) : (
                      <Badge variant="warning" size="sm" label="Select Package" />
                    )}
                    {isExpanded ? (
                      <ChevronUp size={18} color={THEME.light.mutedForeground} />
                    ) : (
                      <ChevronDown size={18} color={THEME.light.mutedForeground} />
                    )}
                  </View>
                </Pressable>

                {isExpanded ? (
                  <CardContent className="gap-5 p-4">
                    {/* Packages Section */}
                    <View className="gap-2.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-bold uppercase tracking-wider text-accent">
                          1. Base Package (Required)
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">Choose one</Text>
                      </View>

                      {standardPackages.map((pkg) => {
                        const isSelected = chosenServiceIds.includes(pkg._id);
                        const pricing = getEffectiveServicePricingForVehicle(pkg, {
                          vehicleSize: v.size,
                          vehicleTypeId: v.vehicleTypeId,
                        });

                        return (
                          <Pressable
                            key={pkg._id}
                            accessibilityRole="button"
                            onPress={() => handleToggleService(v.key, pkg)}
                            className={`flex-row items-start justify-between rounded-xl border p-3.5 ${
                              isSelected
                                ? "border-accent bg-accent/10"
                                : "border-border bg-card active:bg-secondary"
                            }`}
                          >
                            <View className="flex-1 gap-1 pr-3">
                              <View className="flex-row items-center gap-2">
                                <Text className="font-bold text-sm">{pkg.name}</Text>
                                {isSelected ? (
                                  <Badge variant="accent" size="sm" label="Active" />
                                ) : null}
                              </View>
                              <Text className="text-xs text-muted-foreground leading-4" numberOfLines={2}>
                                {pkg.description}
                              </Text>
                              <Text className="text-[11px] font-medium text-muted-foreground mt-0.5">
                                Est. {pricing.duration} mins
                              </Text>
                            </View>

                            <View className="items-end gap-1">
                              <Text className="font-extrabold text-base text-accent">
                                ${pricing.price.toFixed(2)}
                              </Text>
                              <View
                                className={`h-5 w-5 items-center justify-center rounded-full border ${
                                  isSelected ? "border-accent bg-accent" : "border-border"
                                }`}
                              >
                                {isSelected ? <Check size={12} color="#fff" /> : null}
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Add-ons Section */}
                    {addOns.length > 0 ? (
                      <View className="gap-2.5 border-t border-border pt-4">
                        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          2. Extra Add-ons (Optional)
                        </Text>

                        {addOns.map((addon) => {
                          const isSelected = chosenServiceIds.includes(addon._id);
                          const pricing = getEffectiveServicePricingForVehicle(addon, {
                            vehicleSize: v.size,
                            vehicleTypeId: v.vehicleTypeId,
                          });

                          return (
                            <Pressable
                              key={addon._id}
                              accessibilityRole="button"
                              onPress={() => handleToggleService(v.key, addon)}
                              className={`flex-row items-center justify-between rounded-xl border p-3 ${
                                isSelected
                                  ? "border-accent bg-accent/10"
                                  : "border-border bg-card active:bg-secondary"
                              }`}
                            >
                              <View className="flex-1 pr-3">
                                <Text className="font-semibold text-sm">{addon.name}</Text>
                                <Text className="text-[11px] text-muted-foreground">
                                  +{pricing.duration} mins
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-3">
                                <Text className="font-bold text-sm">
                                  +${pricing.price.toFixed(2)}
                                </Text>
                                <View
                                  className={`h-5 w-5 items-center justify-center rounded-md border ${
                                    isSelected ? "border-accent bg-accent" : "border-border"
                                  }`}
                                >
                                  {isSelected ? <Check size={12} color="#fff" /> : null}
                                </View>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}

          <Button
            size="lg"
            disabled={!canContinue()}
            onPress={handleNextStep}
            className="w-full flex-row items-center justify-center gap-2 mt-2"
          >
            <Text className="font-bold text-primary-foreground">Review Order</Text>
            <ArrowRight size={18} color={THEME.light.primaryForeground} />
          </Button>
        </View>
      ) : null}

      {/* STEP 4: Summary & Payment Options */}
      {step === 4 ? (
        <View className="gap-5">
          {/* Order Details Card */}
          <Card className="border border-border">
            <CardContent className="gap-4 p-4">
              <View className="flex-row items-center justify-between border-b border-border pb-3">
                <Text className="font-bold text-base">Service Summary</Text>
                <Badge variant="accent" size="sm" label={`${totalDurationMinutes} mins duration`} />
              </View>

              {/* Location & Time */}
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Calendar size={15} color={THEME.light.accent} />
                  <Text className="text-sm font-semibold">
                    {new Date(`${scheduledDate}T12:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at {scheduledTime}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <MapPin size={15} color={THEME.light.mutedForeground} />
                  <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                    {address.street}, {address.city}, {address.state}
                  </Text>
                </View>
              </View>

              {/* Per-vehicle items */}
              <View className="gap-3 border-t border-border pt-3">
                {perVehicleBreakdown.map((item, i) => (
                  <View key={i} className="gap-1 rounded-xl bg-secondary/50 p-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-bold text-sm">{item.vehicleLabel}</Text>
                      <Text className="font-bold text-sm">${item.subtotal.toFixed(2)}</Text>
                    </View>
                    {item.services.map((srv, si) => (
                      <View key={si} className="flex-row items-center justify-between pl-2">
                        <Text className="text-xs text-muted-foreground">• {srv.name}</Text>
                        <Text className="text-xs text-muted-foreground">${srv.price.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>

              {/* Fees breakdown */}
              <View className="gap-1.5 border-t border-border pt-3 text-sm">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground">Services Subtotal</Text>
                  <Text className="text-sm font-semibold">${totalServicePrice.toFixed(2)}</Text>
                </View>

                {petFeeTotal > 0 ? (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted-foreground">Pet Hair Extraction Fee</Text>
                    <Text className="text-sm font-semibold">+${petFeeTotal.toFixed(2)}</Text>
                  </View>
                ) : null}

                {travelFeeTotal > 0 ? (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted-foreground">
                      Extended Travel Fee ({travelQuote?.distanceMiles} mi)
                    </Text>
                    <Text className="text-sm font-semibold">+${travelFeeTotal.toFixed(2)}</Text>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-between border-t border-border pt-2 mt-1">
                  <Text className="text-base font-extrabold">Total Estimate</Text>
                  <Text className="text-xl font-extrabold text-accent">
                    ${grandTotal.toFixed(2)}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Payment Method Selector */}
          <View className="gap-2.5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Choose Payment Option
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setPaymentOption("deposit")}
              className={`rounded-2xl border p-4 ${
                paymentOption === "deposit"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card active:bg-secondary"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <CreditCard size={18} color={THEME.light.accent} />
                  <Text className="font-bold text-base">Pay Deposit Now (${depositTotal.toFixed(2)})</Text>
                </View>
                <Badge variant="accent" size="sm" label="Recommended" />
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                Lock in your spot today. The remaining balance (${(grandTotal - depositTotal).toFixed(2)}) is invoiced upon service completion.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setPaymentOption("full")}
              className={`rounded-2xl border p-4 ${
                paymentOption === "full"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card active:bg-secondary"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-base">Pay Full Price Now (${grandTotal.toFixed(2)})</Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                Single upfront payment with instant confirmation.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setPaymentOption("in_person")}
              className={`rounded-2xl border p-4 ${
                paymentOption === "in_person"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card active:bg-secondary"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-base">Pay in Person / Invoice Later</Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                Pay the technician directly via card, cash, or digital invoice after service.
              </Text>
            </Pressable>
          </View>

          {/* Submit Button */}
          <Button
            size="lg"
            disabled={isLoading}
            onPress={handleSubmitBooking}
            className="w-full flex-row items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={THEME.light.primaryForeground} />
            ) : (
              <>
                <Text className="font-bold text-primary-foreground">
                  {paymentOption === "in_person" ? "Confirm Booking Request" : `Proceed to Pay $${dueNow.toFixed(2)}`}
                </Text>
                <CheckCircle2 size={18} color={THEME.light.primaryForeground} />
              </>
            )}
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
