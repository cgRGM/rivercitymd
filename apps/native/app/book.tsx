import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Doc, Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  Dog,
  MapPin,
  Palette,
  Plus,
  Shield,
  Sparkles,
  User,
  X,
} from "lucide-react-native";

import { BrandMark } from "@/components/brand-mark";
import { Screen, ScreenHeader } from "@/components/screen";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  AddressSearch,
  type AddressValue,
  type TravelQuoteValue,
} from "@/components/forms/address-search";
import { VehicleLookup, type VehicleLookupValue } from "@/components/forms/vehicle-lookup";
import { TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { THEME } from "@/lib/theme";

import { getEffectiveServicePrice } from "@rivercitymd/backend/convex/lib/pricing";

interface VehicleSelection {
  key: string;
  existingId?: Id<"vehicles">;
  label: string;
  vehicleTypeId?: Id<"vehicleTypes">;
  vehicleTypeName?: string;
  size: "small" | "medium" | "large";
  hasPet: boolean;
  hasHeavySoil: boolean;
  details?: VehicleLookupValue;
}

export default function BookScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const myVehicles = useQuery(
    api.vehicles.getByUser,
    currentUser ? { userId: currentUser._id } : "skip",
  );
  const allServices = useQuery(api.services.list);
  const depositSettings = useQuery(api.depositSettings.get);

  const createOrUpdateDraft = useAction(api.bookingDrafts.createOrUpdate);
  const createBookingCheckout = useAction(api.payments.createBookingCheckout);

  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1: Location & Travel
  const [address, setAddress] = React.useState<AddressValue>({
    street: currentUser?.address?.street || "",
    city: currentUser?.address?.city || "",
    state: currentUser?.address?.state || "AR",
    zip: currentUser?.address?.zip || "",
  });
  const [travelQuote, setTravelQuote] = React.useState<TravelQuoteValue | null>(null);

  // Step 2: Date & Time
  const [scheduledDate, setScheduledDate] = React.useState<string>("");
  const [scheduledTime, setScheduledTime] = React.useState<string>("");

  // Step 3: Vehicles & Condition
  const [selectedVehicles, setSelectedVehicles] = React.useState<VehicleSelection[]>([]);
  const [adHocVehicles, setAdHocVehicles] = React.useState<VehicleLookupValue[]>([]);
  const [activeVehicleIndex, setActiveVehicleIndex] = React.useState<number | null>(0);

  // Step 4: Services selected per vehicle: Record<vehicleKey, serviceId[]>
  const [vehicleServices, setVehicleServices] = React.useState<Record<string, string[]>>({});
  const [expandedServiceVehicle, setExpandedServiceVehicle] = React.useState<string>("");
  const [activeServiceSection, setActiveServiceSection] = React.useState<"core" | "upgrades" | "addons">("core");

  // Step 4: Payment option
  const [paymentOption, setPaymentOption] = React.useState<"deposit" | "full" | "in_person">("deposit");
  const [smsOptIn, setSmsOptIn] = React.useState(true);

  // Initialize selected vehicles when user profile / garage loads
  React.useEffect(() => {
    if (myVehicles && myVehicles.length > 0 && selectedVehicles.length === 0 && adHocVehicles.length === 0) {
      const initial: VehicleSelection = {
        key: `existing-${myVehicles[0]._id}`,
        existingId: myVehicles[0]._id,
        label: `${myVehicles[0].year} ${myVehicles[0].make} ${myVehicles[0].model}`,
        vehicleTypeId: myVehicles[0].vehicleTypeId,
        vehicleTypeName: myVehicles[0].vehicleType?.name,
        size: myVehicles[0].size || "medium",
        hasPet: false,
        hasHeavySoil: false,
      };
      setSelectedVehicles([initial]);
      setExpandedServiceVehicle(initial.key);
    }
  }, [myVehicles]);

  // Combine saved vehicles + ad-hoc vehicles into final target vehicle list
  const targetVehicles: VehicleSelection[] = React.useMemo(() => {
    const list: VehicleSelection[] = [...selectedVehicles];

    adHocVehicles.forEach((adhoc, idx) => {
      if (adhoc.year && adhoc.make && adhoc.model) {
        list.push({
          key: `adhoc-${idx}`,
          label: `${adhoc.year} ${adhoc.make} ${adhoc.model}`,
          vehicleTypeId: adhoc.vehicleTypeId as Id<"vehicleTypes"> | undefined,
          vehicleTypeName: adhoc.vehicleTypeName,
          size: adhoc.size || "medium",
          hasPet: false,
          hasHeavySoil: false,
          details: adhoc,
        });
      }
    });

    return list;
  }, [selectedVehicles, adHocVehicles]);

  // Helper to toggle vehicle selection from saved garage
  const toggleSavedVehicle = (v: Doc<"vehicles"> & { vehicleType?: Doc<"vehicleTypes"> | null }) => {
    const key = `existing-${v._id}`;
    const exists = selectedVehicles.some((item) => item.key === key);
    if (exists) {
      setSelectedVehicles((prev) => prev.filter((item) => item.key !== key));
      setVehicleServices((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      const added: VehicleSelection = {
        key,
        existingId: v._id,
        label: `${v.year} ${v.make} ${v.model}`,
        vehicleTypeId: v.vehicleTypeId,
        vehicleTypeName: v.vehicleType?.name,
        size: v.size || "medium",
        hasPet: false,
        hasHeavySoil: false,
      };
      setSelectedVehicles((prev) => [...prev, added]);
      if (!expandedServiceVehicle) setExpandedServiceVehicle(key);
    }
  };

  const updateVehicleCondition = (key: string, patch: Partial<VehicleSelection>) => {
    setSelectedVehicles((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  // Group services
  const coreServices = React.useMemo(() => {
    return (allServices || []).filter(
      (s: Doc<"services">) => s.bookingRole === "core" || (!s.bookingRole && s.serviceType === "standard"),
    );
  }, [allServices]);

  const upgradeServices = React.useMemo(() => {
    return (allServices || []).filter((s: Doc<"services">) => s.bookingRole === "upgrade");
  }, [allServices]);

  const addonServices = React.useMemo(() => {
    return (allServices || []).filter(
      (s: Doc<"services">) => s.bookingRole === "addon" || s.serviceType === "addon",
    );
  }, [allServices]);

  const getServicePrice = (service: Doc<"services">, vehicleSize: "small" | "medium" | "large") => {
    return getEffectiveServicePrice(service, vehicleSize);
  };

  const handleSelectPackage = (vehicleKey: string, serviceId: string) => {
    const existing = vehicleServices[vehicleKey] || [];
    const coreIds = new Set(coreServices.map((s) => s._id));
    const nonCore = existing.filter((id) => !coreIds.has(id as Id<"services">));
    setVehicleServices({
      ...vehicleServices,
      [vehicleKey]: [...nonCore, serviceId],
    });
  };

  const handleToggleAddon = (vehicleKey: string, serviceId: string) => {
    const existing = vehicleServices[vehicleKey] || [];
    const hasIt = existing.includes(serviceId);
    const next = hasIt ? existing.filter((id) => id !== serviceId) : [...existing, serviceId];
    setVehicleServices({
      ...vehicleServices,
      [vehicleKey]: next,
    });
  };

  // Duration & Pricing Calculations
  const { totalServicePrice, totalDurationMinutes, petFeeTotal, grandTotal, depositTotal, dueNow } =
    React.useMemo(() => {
      let serviceSubtotal = 0;
      let duration = 0;
      let petFees = 0;

      targetVehicles.forEach((v) => {
        const sIds = vehicleServices[v.key] || [];
        sIds.forEach((sid) => {
          const s = allServices?.find((x: Doc<"services">) => x._id === sid);
          if (s) {
            serviceSubtotal += getServicePrice(s, v.size);
            duration += s.duration;
          }
        });

        if (v.hasPet) {
          petFees += 40;
          duration += 30;
        }
      });

      const travelFee = travelQuote?.fee ?? 0;
      const travelBuffer = travelQuote?.bufferMinutes ?? 0;
      const total = serviceSubtotal + petFees + travelFee;
      const depositPerVehicle = depositSettings?.amountPerVehicle ?? 50;
      const calculatedDeposit = Math.min(depositPerVehicle * Math.max(1, targetVehicles.length), total);
      const due = paymentOption === "full" ? total : calculatedDeposit;

      return {
        totalServicePrice: serviceSubtotal,
        totalDurationMinutes: duration + travelBuffer,
        petFeeTotal: petFees,
        grandTotal: total,
        depositTotal: calculatedDeposit,
        dueNow: due,
      };
    }, [targetVehicles, vehicleServices, allServices, travelQuote, depositSettings, paymentOption]);

  const canProceedToNext = () => {
    if (step === 1) {
      return Boolean(address.street.trim() && address.city.trim() && address.state.trim());
    }
    if (step === 2) {
      return Boolean(scheduledDate && scheduledTime);
    }
    if (step === 3) {
      return targetVehicles.length > 0;
    }
    if (step === 4) {
      // Must have a core package selected for each vehicle
      const coreIds = new Set(coreServices.map((s: Doc<"services">) => String(s._id)));
      return targetVehicles.every((v) => {
        const ids = vehicleServices[v.key] || [];
        return ids.some((id) => coreIds.has(id));
      });
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (!canProceedToNext()) {
      if (step === 1) setError("Please enter your complete service address.");
      if (step === 2) setError("Please select an available date and time slot.");
      if (step === 3) setError("Please select or add at least one vehicle.");
      if (step === 4) setError("Please select a base detailing package for each vehicle.");
      return;
    }
    setStep((prev) => Math.min(4, prev + 1) as any);
  };

  const handleSubmitBooking = async () => {
    if (!currentUser) return;
    setError(null);
    setIsLoading(true);

    try {
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

      const existingVehicleServices = existingVehicleIds.map((id) => {
        const key = `existing-${id}`;
        return {
          vehicleId: id,
          serviceIds: (vehicleServices[key] || []) as Id<"services">[],
        };
      });

      const petFeeIds = targetVehicles
        .filter((v) => v.existingId && v.hasPet)
        .map((v) => v.existingId!) as Id<"vehicles">[];

      const allServiceIds = Array.from(
        new Set(Object.values(vehicleServices).flat()),
      ) as Id<"services">[];

      const { draftId } = await createOrUpdateDraft({
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
        existingVehicleServices:
          existingVehicleServices.length > 0 ? existingVehicleServices : undefined,
        vehicles: newVehiclesList.length > 0 ? newVehiclesList : undefined,
        petFeeExistingVehicleIds: petFeeIds,
        serviceIds: allServiceIds,
        scheduledDate,
        scheduledTime,
        paymentOption,
      });

      // Initiate online checkout via Stripe
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
      const message = err instanceof Error ? err.message : "Failed to create booking";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      {/* Top Bar */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={() => (step > 1 ? setStep((prev) => (prev - 1) as any) : router.back())}
          className="flex-row items-center gap-1.5 active:opacity-70"
        >
          <ArrowLeft size={18} color={THEME.light.foreground} />
          <Text className="text-sm font-semibold">{step > 1 ? "Back" : "Cancel"}</Text>
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

      <ScreenHeader
        eyebrow={
          step === 1
            ? "Service Location"
            : step === 2
              ? "Date & Time"
              : step === 3
                ? "Your Garage & Condition"
                : "Packages & Payment"
        }
        title={
          step === 1
            ? "Where should we detail?"
            : step === 2
              ? "When works best for you?"
              : step === 3
                ? "Select vehicles & condition"
                : "Choose packages & checkout"
        }
        description={
          step === 1
            ? "We bring pure water and equipment directly to your driveway."
            : step === 2
              ? "Live scheduling based on estimated service time and route."
              : step === 3
                ? "Tell us about pet hair, heavy soil, and select your vehicles."
                : "Select packages tailored to each car and secure your booking."
        }
      />

      {error ? (
        <View className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
          <Text className="text-xs font-medium text-destructive">{error}</Text>
        </View>
      ) : null}

      {/* STEP 1: Address & Location */}
      {step === 1 ? (
        <View className="gap-4">
          <Card className="border border-border">
            <CardContent className="p-4">
              <AddressSearch
                value={address}
                onChange={setAddress}
                onTravelQuoteChange={setTravelQuote}
                label="Driveway or Office Address"
                showNotes={true}
              />
            </CardContent>
          </Card>

          <Button
            size="lg"
            disabled={!canProceedToNext()}
            onPress={handleNext}
            className="w-full flex-row items-center justify-center gap-2 mt-2"
          >
            <Text className="font-bold text-primary-foreground">Choose Date & Time</Text>
            <ArrowRight size={18} color={THEME.light.primaryForeground} />
          </Button>
        </View>
      ) : null}

      {/* STEP 2: Scheduling TimeSlotPicker */}
      {step === 2 ? (
        <View className="gap-4">
          <Card className="border border-border">
            <CardContent className="p-4">
              <TimeSlotPicker
                durationMinutes={Math.max(120, totalDurationMinutes || 120)}
                selectedDate={scheduledDate}
                selectedTime={scheduledTime}
                onSelectDate={setScheduledDate}
                onSelectTime={setScheduledTime}
              />
            </CardContent>
          </Card>

          <Button
            size="lg"
            disabled={!canProceedToNext()}
            onPress={handleNext}
            className="w-full flex-row items-center justify-center gap-2 mt-2"
          >
            <Text className="font-bold text-primary-foreground">Select Vehicles</Text>
            <ArrowRight size={18} color={THEME.light.primaryForeground} />
          </Button>
        </View>
      ) : null}

      {/* STEP 3: Vehicles & Condition Questions */}
      {step === 3 ? (
        <View className="gap-4">
          <View className="gap-2.5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select From Your Garage
            </Text>

            {myVehicles?.length ? (
              <View className="gap-3">
                {myVehicles.map((v) => {
                  const key = `existing-${v._id}`;
                  const isSelected = selectedVehicles.some((item) => item.key === key);
                  const selection = selectedVehicles.find((item) => item.key === key);

                  return (
                    <Card
                      key={v._id}
                      className={`border overflow-hidden ${
                        isSelected ? "border-accent bg-accent/5" : "border-border bg-card"
                      }`}
                    >
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => toggleSavedVehicle(v)}
                        className="flex-row items-center justify-between p-4 active:bg-secondary/40"
                      >
                        <View className="flex-row items-center gap-3 flex-1">
                          <View
                            className={`h-9 w-9 items-center justify-center rounded-xl ${
                              isSelected ? "bg-accent text-white" : "bg-secondary"
                            }`}
                          >
                            <CarFront
                              size={18}
                              color={
                                isSelected
                                  ? THEME.light.accentForeground
                                  : THEME.light.foreground
                              }
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="font-bold text-sm">
                              {v.year} {v.make} {v.model}
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                              {v.vehicleType?.name || v.size || "Standard"}
                              {v.color ? ` · ${v.color}` : ""}
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

                      {/* Condition Questions (Pet Hair & Heavy Soil) */}
                      {isSelected ? (
                        <CardContent className="gap-3 p-4 pt-0 border-t border-border/40">
                          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-2">
                            Vehicle Condition
                          </Text>

                          {/* Pet Hair Toggle */}
                          <View className="flex-row items-center justify-between rounded-xl bg-secondary/40 p-3">
                            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                              <Dog size={16} color={THEME.light.accent} />
                              <View className="flex-1">
                                <Text className="text-xs font-bold">Pet Hair Present?</Text>
                                <Text className="text-[11px] text-muted-foreground">
                                  Deep pet hair extraction (+ $40.00)
                                </Text>
                              </View>
                            </View>
                            <Switch
                              value={Boolean(selection?.hasPet)}
                              onValueChange={(val) => updateVehicleCondition(key, { hasPet: val })}
                            />
                          </View>

                          {/* Heavy Soil / Bio Toggle */}
                          <View className="flex-row items-center justify-between rounded-xl bg-secondary/40 p-3">
                            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                              <Sparkles size={16} color={THEME.light.accent} />
                              <View className="flex-1">
                                <Text className="text-xs font-bold">Heavy Soil or Mud?</Text>
                                <Text className="text-[11px] text-muted-foreground">
                                  Excessive mud, bio, or heavy staining
                                </Text>
                              </View>
                            </View>
                            <Switch
                              value={Boolean(selection?.hasHeavySoil)}
                              onValueChange={(val) =>
                                updateVehicleCondition(key, { hasHeavySoil: val })
                              }
                            />
                          </View>
                        </CardContent>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            ) : null}
          </View>

          {/* Ad-hoc Vehicle Additions */}
          {adHocVehicles.map((adhoc, idx) => (
            <VehicleLookup
              key={idx}
              title={`Vehicle ${selectedVehicles.length + idx + 1}`}
              value={adhoc}
              onChange={(updated) => {
                const next = [...adHocVehicles];
                next[idx] = updated;
                setAdHocVehicles(next);
              }}
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
            className="flex-row items-center justify-center gap-2 border-dashed py-3"
          >
            <Plus size={16} color={THEME.light.foreground} />
            <Text className="font-semibold text-sm">Add Another Car</Text>
          </Button>

          <Button
            size="lg"
            disabled={!canProceedToNext()}
            onPress={handleNext}
            className="w-full flex-row items-center justify-center gap-2 mt-2"
          >
            <Text className="font-bold text-primary-foreground">Choose Detailing Packages</Text>
            <ArrowRight size={18} color={THEME.light.primaryForeground} />
          </Button>
        </View>
      ) : null}

      {/* STEP 4: Detailing Packages & Stripe Checkout Accordion */}
      {step === 4 ? (
        <View className="gap-5">
          {/* Per-Vehicle Service Accordions */}
          <View className="gap-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configure Packages Per Car
            </Text>

            {targetVehicles.map((v, index) => {
              const currentServices = vehicleServices[v.key] || [];
              const selectedCore = coreServices.find((s: Doc<"services">) => currentServices.includes(s._id));
              const selectedUpgrades = upgradeServices.filter((s: Doc<"services">) =>
                currentServices.includes(s._id),
              );
              const selectedAddons = addonServices.filter((s: Doc<"services">) => currentServices.includes(s._id));

              const isExpanded = expandedServiceVehicle === v.key || targetVehicles.length === 1;

              return (
                <Card key={v.key} className="border border-border overflow-hidden">
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setExpandedServiceVehicle(isExpanded && targetVehicles.length > 1 ? "" : v.key)
                    }
                    className="flex-row items-center justify-between p-4 bg-card active:bg-secondary/40"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-accent/10">
                        <CarFront size={16} color={THEME.light.accent} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-bold text-sm">{v.label}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {selectedCore ? selectedCore.name : "Select a package"}
                          {selectedAddons.length > 0 ? ` · +${selectedAddons.length} add-ons` : ""}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-2">
                      {selectedCore ? (
                        <Badge
                          variant="accent"
                          size="sm"
                          label={`$${getServicePrice(selectedCore, v.size).toFixed(2)}`}
                        />
                      ) : (
                        <Badge variant="warning" size="sm" label="Required" />
                      )}
                      {targetVehicles.length > 1 ? (
                        isExpanded ? (
                          <ChevronUp size={18} color={THEME.light.mutedForeground} />
                        ) : (
                          <ChevronDown size={18} color={THEME.light.mutedForeground} />
                        )
                      ) : null}
                    </View>
                  </Pressable>

                  {isExpanded ? (
                    <CardContent className="gap-4 p-4 pt-1 border-t border-border/50">
                      {/* Sub-Section 1: Base Detailing Packages */}
                      <View className="gap-2">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs font-bold text-foreground">
                            1. Select Core Package (Required)
                          </Text>
                        </View>

                        <View className="gap-2">
                          {coreServices.map((pkg: Doc<"services">) => {
                            const isChosen = currentServices.includes(pkg._id);
                            const price = getServicePrice(pkg, v.size);

                            return (
                              <Pressable
                                key={pkg._id}
                                accessibilityRole="button"
                                onPress={() => handleSelectPackage(v.key, pkg._id)}
                                className={`rounded-xl border p-3.5 ${
                                  isChosen
                                    ? "border-accent bg-accent/10"
                                    : "border-border bg-card active:bg-secondary"
                                }`}
                              >
                                <View className="flex-row items-center justify-between">
                                  <Text className="font-bold text-sm">{pkg.name}</Text>
                                  <Text className="text-sm font-extrabold text-accent">
                                    ${price.toFixed(2)}
                                  </Text>
                                </View>
                                {pkg.description ? (
                                  <Text className="text-xs text-muted-foreground mt-1 leading-4">
                                    {pkg.description}
                                  </Text>
                                ) : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* Sub-Section 2: Add-ons & Upgrades */}
                      {addonServices.length > 0 || upgradeServices.length > 0 ? (
                        <View className="gap-2 border-t border-border/40 pt-3">
                          <Text className="text-xs font-bold text-foreground">
                            2. Add-on Enhancements (Optional)
                          </Text>

                          <View className="gap-2">
                            {[...upgradeServices, ...addonServices].map((addon: Doc<"services">) => {
                              const isSelected = currentServices.includes(addon._id);
                              const price = getServicePrice(addon, v.size);

                              return (
                                <Pressable
                                  key={addon._id}
                                  accessibilityRole="button"
                                  onPress={() => handleToggleAddon(v.key, addon._id)}
                                  className={`flex-row items-center justify-between rounded-xl border p-3 ${
                                    isSelected
                                      ? "border-accent bg-accent/10"
                                      : "border-border bg-card active:bg-secondary"
                                  }`}
                                >
                                  <View className="flex-1 pr-2">
                                    <Text className="font-semibold text-xs">{addon.name}</Text>
                                    <Text className="text-[11px] text-muted-foreground">
                                      +{addon.duration} mins
                                    </Text>
                                  </View>
                                  <View className="flex-row items-center gap-2">
                                    <Text className="font-bold text-xs">+${price.toFixed(2)}</Text>
                                    <View
                                      className={`h-4 w-4 items-center justify-center rounded border ${
                                        isSelected ? "border-accent bg-accent" : "border-border"
                                      }`}
                                    >
                                      {isSelected ? <Check size={10} color="#fff" /> : null}
                                    </View>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </View>

          {/* Service Summary Card */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="gap-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Date & Time</Text>
                <Text className="text-xs font-bold">
                  {scheduledDate} at {scheduledTime}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Estimated Duration</Text>
                <Text className="text-xs font-bold">{totalDurationMinutes} minutes</Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Detailing Subtotal</Text>
                <Text className="text-xs font-semibold">${totalServicePrice.toFixed(2)}</Text>
              </View>

              {petFeeTotal > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">Pet Hair Extraction Fee</Text>
                  <Text className="text-xs font-semibold">+${petFeeTotal.toFixed(2)}</Text>
                </View>
              ) : null}

              {travelQuote && travelQuote.fee > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">Arkansas Travel Fee</Text>
                  <Text className="text-xs font-semibold">+${travelQuote.fee.toFixed(2)}</Text>
                </View>
              ) : null}

              <View className="flex-row items-center justify-between border-t border-border pt-2">
                <Text className="text-base font-extrabold">Total Service Price</Text>
                <Text className="text-xl font-extrabold text-accent">
                  ${grandTotal.toFixed(2)}
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Payment Method Selector */}
          <View className="gap-2.5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Choose Payment Option
            </Text>

            {/* Option 1: Deposit */}
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
                  <Text className="font-bold text-sm">Pay Deposit Now</Text>
                </View>
                <Badge variant="accent" size="sm" label="Recommended" />
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                ${depositTotal.toFixed(2)} deposit now, remaining balance invoiced via Stripe after service.
              </Text>
            </Pressable>

            {/* Option 2: Full Upfront */}
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
                <Text className="font-bold text-sm">Pay Full Price Now</Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                ${grandTotal.toFixed(2)} — pay entire amount upfront via Stripe.
              </Text>
            </Pressable>

            {/* Option 3: In Person */}
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
                <Text className="font-bold text-sm">Pay Remaining in Person</Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                ${depositTotal.toFixed(2)} deposit now, pay balance in cash/card at service.
              </Text>
            </Pressable>
          </View>

          {/* Amount Due Now Card */}
          <View className="rounded-2xl border border-border/80 bg-secondary/30 p-4">
            <View className="flex-row items-center justify-between">
              <View className="gap-0.5">
                <Text className="font-bold text-sm">
                  {paymentOption === "full" ? "Total Due Today" : "Deposit Due Today"}
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  Secure checkout via Stripe
                </Text>
              </View>
              <Text className="text-2xl font-extrabold text-accent">${dueNow.toFixed(2)}</Text>
            </View>
          </View>

          {/* Submit Button */}
          <Button
            size="lg"
            disabled={isLoading || !canProceedToNext()}
            onPress={handleSubmitBooking}
            className="w-full flex-row items-center justify-center gap-2 mt-1"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={THEME.light.primaryForeground} />
            ) : (
              <>
                <Text className="font-bold text-primary-foreground">
                  {paymentOption === "full"
                    ? `Pay $${grandTotal.toFixed(2)} & Book`
                    : `Pay $${depositTotal.toFixed(2)} Deposit & Book`}
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
