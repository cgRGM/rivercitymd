import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateString, formatTime12h } from "@/lib/time";
import {
  getEffectiveServicePrice,
  normalizeServiceType,
} from "@/convex/lib/pricing";
import type { VehicleSize } from "@/convex/lib/pricing";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ServiceCard } from "@/components/home/service-card";
import { TimeSlotPicker } from "@/components/home/time-slot-picker";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  Plus,
} from "lucide-react";
import Link from "next/link";

const TOTAL_STEPS = 4;

const SIZE_LABELS: Record<string, string> = {
  small: "Small",
  medium: "Mid-Size",
  large: "Large",
};

interface DashboardAppointmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVehicleId?: string | null;
}

export function DashboardAppointmentForm({
  open,
  onOpenChange,
  preselectedVehicleId,
}: DashboardAppointmentFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedStandardId, setSelectedStandardId] = useState<string | null>(
    null,
  );
  const [hasPetFee, setHasPetFee] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [paymentOption, setPaymentOption] = useState<
    "deposit" | "full" | "in_person"
  >("deposit");
  const [smsOptIn, setSmsOptIn] = useState(false);

  // Queries
  const currentUser = useQuery(api.users.getCurrentUser);
  const userVehicles = useQuery(api.vehicles.getMyVehicles);
  const services = useQuery(api.services.list);
  const petFeeSettings = useQuery(api.petFeeSettings.get);
  const nextBookableDate = useQuery(api.availability.getNextBookableDate, {});

  // Mutations/Actions
  const upsertBookingDraft = useMutation(api.bookingDrafts.createOrUpdate);
  const createBookingCheckout = useAction(api.payments.createBookingCheckout);

  // Pre-fill address when user data loads
  React.useEffect(() => {
    if (currentUser?.address && !street) {
      setStreet(currentUser.address.street);
      setCity(currentUser.address.city);
      setState(currentUser.address.state);
      setZip(currentUser.address.zip);
    }
  }, [currentUser, street]);

  React.useEffect(() => {
    if (currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn) {
      setSmsOptIn(true);
    }
  }, [currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn]);

  // Pre-fill next bookable date
  React.useEffect(() => {
    if (open && nextBookableDate && !scheduledDate) {
      setScheduledDate(nextBookableDate);
    }
  }, [open, nextBookableDate, scheduledDate]);

  // Pre-select vehicle when provided
  React.useEffect(() => {
    if (open && preselectedVehicleId) {
      setSelectedVehicleId(preselectedVehicleId);
      setCurrentStep(2);
    }
  }, [open, preselectedVehicleId]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setSelectedVehicleId(null);
      setSelectedServiceIds([]);
      setSelectedStandardId(null);
      setHasPetFee(false);
      setScheduledDate("");
      setScheduledTime("");
      setLocationNotes("");
      setPaymentOption("deposit");
      // Keep address pre-filled
    }
  }, [open]);

  // Derived state
  const selectedVehicle = userVehicles?.find(
    (v) => v._id === selectedVehicleId,
  );
  const vehicleSize: VehicleSize =
    (selectedVehicle?.size as VehicleSize) || "medium";

  const activeServices = useMemo(
    () => services?.filter((s) => s.isActive) ?? [],
    [services],
  );

  const standardServices = useMemo(
    () =>
      activeServices.filter(
        (s) => normalizeServiceType(s.serviceType) === "standard",
      ),
    [activeServices],
  );
  const addonServices = useMemo(
    () =>
      activeServices.filter(
        (s) => normalizeServiceType(s.serviceType) === "addon",
      ),
    [activeServices],
  );
  const subscriptionServices = useMemo(
    () =>
      activeServices.filter(
        (s) => normalizeServiceType(s.serviceType) === "subscription",
      ),
    [activeServices],
  );

  // All selected service IDs (standard + addons + subscriptions)
  const allSelectedServiceIds = useMemo(() => {
    const ids = [...selectedServiceIds];
    if (selectedStandardId && !ids.includes(selectedStandardId)) {
      ids.unshift(selectedStandardId);
    }
    return ids;
  }, [selectedStandardId, selectedServiceIds]);

  const selectedServicesData = useMemo(
    () => activeServices.filter((s) => allSelectedServiceIds.includes(s._id)),
    [activeServices, allSelectedServiceIds],
  );

  const serviceTotal = useMemo(
    () =>
      selectedServicesData.reduce(
        (sum, s) => sum + getEffectiveServicePrice(s, vehicleSize),
        0,
      ),
    [selectedServicesData, vehicleSize],
  );

  const petFeeTotal = useMemo(() => {
    if (!hasPetFee) return 0;
    if (petFeeSettings?.isActive === false) return 0;
    if (vehicleSize === "small") {
      return petFeeSettings?.basePriceSmall ?? petFeeSettings?.basePriceMedium ?? 50;
    }
    if (vehicleSize === "large") {
      return petFeeSettings?.basePriceLarge ?? petFeeSettings?.basePriceMedium ?? 50;
    }
    return petFeeSettings?.basePriceMedium ?? 50;
  }, [hasPetFee, petFeeSettings, vehicleSize]);

  const depositTotal = 50; // $50 deposit per vehicle
  const orderTotal = serviceTotal + petFeeTotal;
  const dueNow = paymentOption === "full" ? orderTotal : Math.min(depositTotal, orderTotal);

  // Step validation
  const canAdvance = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!selectedVehicleId;
      case 2:
        return !!selectedStandardId;
      case 3:
        return !!scheduledDate && !!scheduledTime && !!street && !!city && !!state && !!zip;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS && canAdvance(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddonToggle = (serviceId: string, selected: boolean) => {
    setSelectedServiceIds((prev) =>
      selected ? [...prev, serviceId] : prev.filter((id) => id !== serviceId),
    );
  };

  const onSubmit = async () => {
    if (!currentUser || !selectedVehicleId || allSelectedServiceIds.length === 0)
      return;

    setIsLoading(true);
    try {
      const { draftId } = await upsertBookingDraft({
        name: currentUser.name || currentUser.email || "Customer",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        smsOptIn,
        address: {
          street,
          city,
          state,
          zip,
          notes: locationNotes || undefined,
        },
        existingVehicleIds: [selectedVehicleId] as Id<"vehicles">[],
        petFeeExistingVehicleIds: hasPetFee
          ? ([selectedVehicleId] as Id<"vehicles">[])
          : [],
        serviceIds: allSelectedServiceIds as Id<"services">[],
        scheduledDate,
        scheduledTime,
        paymentOption,
      });

      const { url } = await createBookingCheckout({
        draftId,
        origin: window.location.origin,
      });

      if (url) {
        window.location.href = url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to schedule appointment",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = [
    "Select Vehicle",
    "Choose Services",
    "Date & Location",
    "Review & Pay",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule New Appointment</DialogTitle>
          <DialogDescription>
            Step {currentStep} of {TOTAL_STEPS}: {stepLabels[currentStep - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i + 1 === currentStep
                  ? "bg-primary"
                  : i + 1 < currentStep
                    ? "bg-primary/40"
                    : "bg-muted",
              )}
            />
          ))}
        </div>

        {/* Step 1: Vehicle Selection */}
        {currentStep === 1 && (
          <div className="space-y-4">
            {userVehicles && userVehicles.length > 0 ? (
              <div className="space-y-3">
                {userVehicles.map((vehicle) => (
                  <div
                    key={vehicle._id}
                    onClick={() => setSelectedVehicleId(vehicle._id)}
                    className={cn(
                      "group relative flex cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md",
                      selectedVehicleId === vehicle._id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-muted hover:border-primary/50",
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                          selectedVehicleId === vehicle._id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Car className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {vehicle.color && `${vehicle.color} · `}
                          {vehicle.licensePlate && `${vehicle.licensePlate}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {vehicle.size && (
                          <Badge variant="secondary" className="text-xs">
                            {SIZE_LABELS[vehicle.size] || vehicle.size}
                          </Badge>
                        )}
                        <div
                          className={cn(
                            "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                            selectedVehicleId === vehicle._id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {selectedVehicleId === vehicle._id && (
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No vehicles yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add a vehicle to get started with booking.
                </p>
                <Button asChild>
                  <Link href="/dashboard/vehicles">
                    <Plus className="w-4 h-4 mr-2" />
                    Add a Vehicle
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Service Selection */}
        {currentStep === 2 && (
          <div className="space-y-2">
            <Accordion
              type="multiple"
              defaultValue={["standard", "addons", "subscriptions"]}
              className="space-y-2"
            >
              {/* Standard Packages */}
              {standardServices.length > 0 && (
                <AccordionItem value="standard">
                  <AccordionTrigger className="text-sm font-semibold">
                    Standard Packages
                    <Badge variant="outline" className="ml-2 text-xs">
                      Required
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {standardServices.map((service) => (
                        <ServiceCard
                          key={service._id}
                          service={service}
                          vehicleSize={vehicleSize}
                          isSelected={selectedStandardId === service._id}
                          onSelect={(selected) =>
                            setSelectedStandardId(
                              selected ? service._id : null,
                            )
                          }
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Add-ons */}
              {addonServices.length > 0 && (
                <AccordionItem value="addons">
                  <AccordionTrigger className="text-sm font-semibold">
                    Add-ons
                    <Badge variant="outline" className="ml-2 text-xs">
                      Optional
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {addonServices.map((service) => (
                        <ServiceCard
                          key={service._id}
                          service={service}
                          vehicleSize={vehicleSize}
                          isSelected={selectedServiceIds.includes(service._id)}
                          onSelect={(selected) =>
                            handleAddonToggle(service._id, selected)
                          }
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Recurring Plans */}
              {subscriptionServices.length > 0 && (
                <AccordionItem value="subscriptions">
                  <AccordionTrigger className="text-sm font-semibold">
                    Recurring Plans
                    <Badge variant="outline" className="ml-2 text-xs">
                      Optional
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {subscriptionServices.map((service) => (
                        <ServiceCard
                          key={service._id}
                          service={service}
                          vehicleSize={vehicleSize}
                          isSelected={selectedServiceIds.includes(service._id)}
                          onSelect={(selected) =>
                            handleAddonToggle(service._id, selected)
                          }
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Running total */}
            {allSelectedServiceIds.length > 0 && (
              <div className="space-y-3 bg-muted/50 p-3 rounded-lg border border-border/50 mt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Pet hair or pet travel</p>
                    <p className="text-xs text-muted-foreground">
                      Add the configured pet fee for this vehicle.
                    </p>
                  </div>
                  <Switch checked={hasPetFee} onCheckedChange={setHasPetFee} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Running Total</span>
                  <span className="font-bold text-lg text-primary">
                    ${orderTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Date, Time & Location */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preferred Date</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    setScheduledTime("");
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Preferred Time</label>
                <TimeSlotPicker
                  date={scheduledDate}
                  selectedTime={scheduledTime}
                  onTimeSelect={setScheduledTime}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Service Location</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Street Address</label>
                  <Input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">City</label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">State</label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">ZIP</label>
                    <Input
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      maxLength={5}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Location Notes (Optional)
                  </label>
                  <Textarea
                    value={locationNotes}
                    onChange={(e) => setLocationNotes(e.target.value)}
                    placeholder="Any special instructions for finding the location"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review & Pay */}
        {currentStep === 4 && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-muted/50 p-4 rounded-lg border border-border/50 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">
                  ✓
                </span>
                Order Summary
              </h3>

              {/* Vehicle */}
              {selectedVehicle && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vehicle</span>
                  <span className="font-medium">
                    {selectedVehicle.year} {selectedVehicle.make}{" "}
                    {selectedVehicle.model}
                  </span>
                </div>
              )}

              {/* Services */}
              {selectedServicesData.map((service) => {
                const price = getEffectiveServicePrice(service, vehicleSize);
                const isSubscription =
                  normalizeServiceType(service.serviceType) === "subscription";
                return (
                  <div
                    key={service._id}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {service.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">${price.toFixed(2)}</span>
                      {isSubscription && (
                        <span className="text-[10px] text-muted-foreground">
                          /mo
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                <span>Service Total</span>
                <span>${serviceTotal.toFixed(2)}</span>
              </div>
              {petFeeTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pet fee</span>
                  <span className="font-medium">${petFeeTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>${orderTotal.toFixed(2)}</span>
              </div>

              {/* Date/Time */}
              <div className="border-t pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Date & Time</span>
                <span className="font-medium">
                  {formatDateString(scheduledDate)} at {formatTime12h(scheduledTime)}
                </span>
              </div>

              {/* Location */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-right">
                  {street}, {city}, {state} {zip}
                </span>
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Payment Option</h3>
              <div className="space-y-2">
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    paymentOption === "deposit"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <input
                    type="radio"
                    name="paymentOption"
                    value="deposit"
                    checked={paymentOption === "deposit"}
                    onChange={() => setPaymentOption("deposit")}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <span className="font-medium text-sm">
                      Pay Deposit Now
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      ${Math.min(depositTotal, orderTotal).toFixed(2)} deposit now, remaining balance
                      invoiced after service
                    </span>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    paymentOption === "full"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <input
                    type="radio"
                    name="paymentOption"
                    value="full"
                    checked={paymentOption === "full"}
                    onChange={() => setPaymentOption("full")}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <span className="font-medium text-sm">
                      Pay Full Price Now
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      ${orderTotal.toFixed(2)} — pay entire amount upfront
                    </span>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    paymentOption === "in_person"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <input
                    type="radio"
                    name="paymentOption"
                    value="in_person"
                    checked={paymentOption === "in_person"}
                    onChange={() => setPaymentOption("in_person")}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <span className="font-medium text-sm">
                      Pay Remaining in Person
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      ${Math.min(depositTotal, orderTotal).toFixed(2)} deposit now, pay balance in
                      cash/card at service
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Amount due */}
            <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
              <div className="flex justify-between items-end">
                <div>
                  <span className="font-bold text-base block">
                    {paymentOption === "full"
                      ? "Total Due Now"
                      : "Deposit Due Now"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Secure payment via Stripe
                  </span>
                </div>
                <span className="font-bold text-xl text-primary">
                  ${dueNow.toFixed(2)}
                </span>
              </div>
              {paymentOption !== "full" && (
                <p className="text-xs text-muted-foreground mt-2">
                  This deposit is non-refundable and will be applied to your
                  service total.
                </p>
              )}
              {paymentOption === "in_person" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining balance of $
                  {Math.max(0, orderTotal - depositTotal).toFixed(2)} will be collected
                  in person.
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">Urgent SMS Updates</p>
                <p className="text-xs text-muted-foreground">
                  Text me about confirmations, reminders, cancellations,
                  reschedules, and when service begins.
                </p>
              </div>
              <Switch checked={smsOptIn} onCheckedChange={setSmsOptIn} />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-4 pt-4 border-t mt-2">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              className="flex-1"
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {currentStep === 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
          {currentStep < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={nextStep}
              className="flex-1"
              disabled={!canAdvance(currentStep)}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSubmit}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : paymentOption === "full" ? (
                "Pay & Book"
              ) : (
                "Pay Deposit & Book"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
