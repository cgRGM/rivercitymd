"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useAction, useConvex } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useBookingStore } from "@/hooks/use-booking-store";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { calculateSchedulingDuration } from "@/convex/lib/booking";
import {
  getEffectiveServicePricingForVehicle,
  isServiceAvailableForVehicle,
  normalizeServiceType,
  type VehicleSize,
} from "@/convex/lib/pricing";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import AddressInput from "@/components/ui/address-input";
import {
  VehicleLookupCard,
  type VehicleLookupValue,
} from "@/components/forms/vehicle-lookup-card";
import { TimeSlotPicker } from "@/components/home/time-slot-picker";
import { ServiceCard } from "@/components/home/service-card";

interface RadarAddress {
  formattedAddress?: string;
  addressLabel?: string;
  number?: string;
  addressComponents?: {
    street?: string;
    city?: string;
    locality?: string;
    state?: string;
    region?: string;
    postalCode?: string;
  };
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

const step1Schema = z.object({
  scheduledDate: z.date({
    message: "A date of service is required.",
  }),
  scheduledTime: z.string().min(1, "Please select a time"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().optional(),
  locationNotes: z.string().optional(),
});

const step2Schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[\d\s()+-]+$/, "Phone number contains invalid characters"),
  email: z.string().email("Please enter a valid email"),
  smsOptIn: z.boolean(),
});

const step3Schema = z.object({
  vehicles: z
    .array(
      z.object({
        year: z
          .string()
          .regex(/^\d{4}$/, "Year must be a 4-digit number")
          .min(1, "Year is required"),
        make: z.string().min(1, "Make is required"),
        model: z.string().min(1, "Model is required"),
        color: z.string().optional(),
        licensePlate: z.string().optional(),
        size: z.enum(["small", "medium", "large"]).optional(),
        vehicleTypeId: z.string().optional(),
        vehicleTypeName: z.string().optional(),
        classification: z.object({
          source: z.enum(["fuelEconomy", "vpic", "manual", "fallback"]),
          confidence: z.enum(["high", "medium", "low"]),
          rawCategory: z.string().optional(),
          needsAdminReview: z.boolean(),
        }).optional(),
        hasPet: z.boolean().optional(),
        beforePhotos: z.array(z.object({
          key: z.string(),
          fileName: z.string(),
          contentType: z.string(),
          sizeBytes: z.number(),
          uploadedAt: z.number(),
        })).optional(),
      }),
    )
    .min(1, "Please add at least one vehicle"),
});

const step4Schema = z.object({
  serviceIds: z.array(z.string()).min(1, "Please select at least one service"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;

export default function BookingFlow() {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
    resumeToken,
    setResumeToken,
    step1Data,
    setStep1Data,
    step2Data,
    setStep2Data,
    step3Data,
    setStep3Data,
    step4Data,
    setStep4Data,
    resetBooking,
  } = useBookingStore();

  const [isLoading, setIsLoading] = useState(false);
  const [paymentOption, setPaymentOption] = useState<"deposit" | "full" | "in_person">("deposit");
  const [travelQuote, setTravelQuote] = useState<{
    distanceMiles: number;
    fee: number;
  } | null>(null);
  const { user, isLoaded, isSignedIn } = useUser();

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      scheduledDate: step1Data?.scheduledDate
        ? new Date(step1Data.scheduledDate)
        : undefined,
      scheduledTime: step1Data?.scheduledTime || "",
      street: step1Data?.street || "",
      city: step1Data?.city || "",
      state: step1Data?.state || "",
      zip: step1Data?.zip || "",
      locationNotes: step1Data?.locationNotes || "",
    },
  });

  const services = useQuery(api.services.list);
  const petFeeSettings = useQuery(api.petFeeSettings.get);
  const bookingReadiness = useQuery(api.setupReadiness.getPublicBookingReadiness);
  const nextBookableDate = useQuery(
    api.availability.getNextBookableDate,
    bookingReadiness?.isReady ? {} : "skip",
  );
  const upsertBookingDraft = useAction(api.bookingDrafts.createOrUpdate);
  const calculateTravelFee = useAction(api.travelFees.calculate);
  const createBookingCheckout = useAction(api.payments.createBookingCheckout);
  const convex = useConvex();
  const currentUser = useQuery(api.users.getCurrentUser, isSignedIn ? {} : "skip");

  const vehiclePricingContexts = useMemo(() => {
    const vehicles = step3Data?.vehicles ?? [];
    if (vehicles.length === 0) {
      return [{ vehicleSize: "medium" as VehicleSize, vehicleTypeId: null }];
    }

    return vehicles.map((vehicle) => ({
      vehicleSize: (vehicle.size ?? "medium") as VehicleSize,
      vehicleTypeId: vehicle.vehicleTypeId ?? null,
    }));
  }, [step3Data?.vehicles]);

  const primaryVehiclePricingContext = vehiclePricingContexts[0] ?? {
    vehicleSize: "medium" as VehicleSize,
    vehicleTypeId: null,
  };

  const isAvailableForBookingVehicles = useCallback(
    (service: Parameters<typeof isServiceAvailableForVehicle>[0]) =>
      vehiclePricingContexts.every((vehicle) =>
        isServiceAvailableForVehicle(service, vehicle),
      ),
    [vehiclePricingContexts],
  );

  const watchedStreet = step1Form.watch("street");
  const watchedCity = step1Form.watch("city");
  const watchedState = step1Form.watch("state");
  const watchedZip = step1Form.watch("zip");
  const watchedLocationNotes = step1Form.watch("locationNotes");

  useEffect(() => {
    if (
      !watchedStreet?.trim() ||
      !watchedCity?.trim() ||
      !watchedState?.trim() ||
      !watchedZip?.trim()
    ) {
      setTravelQuote(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      void calculateTravelFee({
        address: {
          street: watchedStreet,
          city: watchedCity,
          state: watchedState,
          zip: watchedZip,
          notes: watchedLocationNotes || undefined,
        },
      })
        .then(setTravelQuote)
        .catch(() => setTravelQuote(null));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [
    calculateTravelFee,
    watchedCity,
    watchedLocationNotes,
    watchedState,
    watchedStreet,
    watchedZip,
  ]);

  const schedulingDuration = useMemo(() => {
    const selectedServices =
      services?.filter((service) => step4Data?.serviceIds?.includes(service._id)) ?? [];
    const petFeeVehicleCount =
      petFeeSettings?.isActive === false
        ? 0
        : step3Data?.vehicles?.filter((vehicle) => vehicle.hasPet).length ?? 0;

    return calculateSchedulingDuration({
      serviceDurations: selectedServices.flatMap((service) =>
        vehiclePricingContexts.map(
          (vehicle) =>
            getEffectiveServicePricingForVehicle(service, vehicle).duration,
        ),
      ),
      petFeeVehicleCount,
      petFeeTimeMinutes: petFeeSettings?.timeAddMinutes,
    });
  }, [
    petFeeSettings?.isActive,
    petFeeSettings?.timeAddMinutes,
    services,
    step3Data?.vehicles,
    step4Data?.serviceIds,
    vehiclePricingContexts,
  ]);

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      name: step2Data?.name || "",
      phone: step2Data?.phone || "",
      email: step2Data?.email || "",
      smsOptIn:
        step2Data?.smsOptIn ??
        currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn ??
        false,
    },
  });

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      vehicles: (step3Data?.vehicles || [
        {
          year: "",
          make: "",
          model: "",
          color: "",
          licensePlate: "",
          size: "small",
          hasPet: false,
          beforePhotos: [],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]) as any,
    },
  });

  const step4Form = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      serviceIds: step4Data?.serviceIds || [],
    },
  });

  useEffect(() => {
    if (!services || !step4Data?.serviceIds?.length) {
      return;
    }

    const availableServiceIds = new Set(
      services
        .filter((service) => isAvailableForBookingVehicles(service))
        .map((service) => service._id),
    );
    const nextServiceIds = step4Data.serviceIds.filter((serviceId) =>
      availableServiceIds.has(serviceId as Id<"services">),
    );

    if (nextServiceIds.length !== step4Data.serviceIds.length) {
      step4Form.setValue("serviceIds", nextServiceIds, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setStep4Data({ serviceIds: nextServiceIds });
    }
  }, [
    isAvailableForBookingVehicles,
    services,
    setStep4Data,
    step4Data?.serviceIds,
    step4Form,
  ]);

  // Pre-fill user data if authenticated
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const currentValues = step2Form.getValues();
      if (!currentValues.name || !currentValues.email) {
        const fullName = user.fullName || "";
        const email = user.primaryEmailAddress?.emailAddress || "";
        
        step2Form.setValue("name", fullName);
        step2Form.setValue("email", email);
        
        setStep2Data({
          ...step2Data,
          name: fullName,
          email: email,
          phone: step2Data?.phone || "",
          smsOptIn:
            step2Data?.smsOptIn ??
            currentUser?.notificationPreferences?.operationalSmsConsent
              ?.optedIn ??
            false,
        });
      }
    }
  }, [isLoaded, isSignedIn, user, step2Form, setStep2Data, step2Data, currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn]);

  useEffect(() => {
    if (!currentUser || step2Data?.smsOptIn !== undefined) {
      return;
    }

    step2Form.setValue(
      "smsOptIn",
      currentUser.notificationPreferences?.operationalSmsConsent?.optedIn ??
        false,
    );
  }, [currentUser, step2Data?.smsOptIn, step2Form]);

  useEffect(() => {
    if (!bookingReadiness?.isReady || !nextBookableDate) {
      return;
    }

    const existingDate = step1Form.getValues("scheduledDate");
    if (existingDate) {
      return;
    }

    const defaultDate = new Date(`${nextBookableDate}T00:00:00.000Z`);
    step1Form.setValue("scheduledDate", defaultDate, {
      shouldDirty: true,
      shouldValidate: true,
    });
    step1Form.setValue("scheduledTime", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [bookingReadiness?.isReady, nextBookableDate, step1Form]);

  const handleAddressSelect = useCallback(
    (address: RadarAddress) => {
      console.log("Processing address selection:", address);
      localStorage.setItem("selectedAddress", JSON.stringify(address));

      const streetNumber = address.number || "";
      const streetName = address.street || "";
      const fullStreet = streetNumber
        ? `${streetNumber} ${streetName}`.trim()
        : streetName || address.formattedAddress || "";
      step1Form.setValue("street", fullStreet, {
        shouldValidate: true,
        shouldDirty: true,
      });
      step1Form.setValue("city", address.city || "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      step1Form.setValue("state", address.state || "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      step1Form.setValue("zip", address.postalCode || "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      const currentData = step1Form.getValues();
      localStorage.setItem("appointmentFormData", JSON.stringify(currentData));
    },
    [step1Form],
  );

  const addVehicle = async () => {
    const isValid = await step3Form.trigger();
    if (!isValid) return;

    const currentVehicles = step3Form.getValues("vehicles") || [];
    step3Form.setValue("vehicles", [
      ...currentVehicles,
      {
        year: "",
        make: "",
        model: "",
        color: "",
        licensePlate: "",
        size: "small",
        hasPet: false,
        beforePhotos: [],
      },
    ]);
  };

  const updateVehicle = (index: number, nextVehicle: VehicleLookupValue) => {
    const currentVehicles = step3Form.getValues("vehicles") || [];
    step3Form.setValue(
      "vehicles",
      currentVehicles.map((vehicle, vehicleIndex) =>
        vehicleIndex === index ? { ...vehicle, ...nextVehicle } : vehicle,
      ),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  const removeVehicle = (index: number) => {
    const currentVehicles = step3Form.getValues("vehicles") || [];
    if (currentVehicles.length > 1) {
      step3Form.setValue(
        "vehicles",
        currentVehicles.filter((_, i) => i !== index),
      );
    }
  };

  const nextStep = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await step1Form.trigger();
        if (isValid) {
          const formData = step1Form.getValues();
          setStep1Data(formData);
          localStorage.setItem("appointmentFormData", JSON.stringify(formData));
          setCurrentStep(2);
        }
        break;
      case 2:
        isValid = await step2Form.trigger();
        if (isValid) {
          setStep2Data(step2Form.getValues());
          setCurrentStep(3);
        }
        break;
      case 3:
        isValid = await step3Form.trigger();
        if (isValid) {
          const values = step3Form.getValues();
          setStep3Data(values);
          setCurrentStep(4);
        }
        break;
      case 4:
        isValid = await step4Form.trigger();
        if (isValid) {
          const selectedStep4Data = step4Form.getValues();
          const selectedServices =
            services?.filter((service) =>
              selectedStep4Data.serviceIds?.includes(service._id),
            ) ?? [];
          const petFeeVehicleCount =
            petFeeSettings?.isActive === false
              ? 0
              : step3Data?.vehicles?.filter((vehicle) => vehicle.hasPet).length ?? 0;
          const selectedDuration = calculateSchedulingDuration({
            serviceDurations: selectedServices.flatMap((service) =>
              vehiclePricingContexts.map(
                (vehicle) =>
                  getEffectiveServicePricingForVehicle(service, vehicle).duration,
              ),
            ),
            petFeeVehicleCount,
            petFeeTimeMinutes: petFeeSettings?.timeAddMinutes,
          });
          const scheduledDateValue = step1Data?.scheduledDate;
          const scheduledDate =
            scheduledDateValue instanceof Date
              ? scheduledDateValue.toISOString().split("T")[0]
              : scheduledDateValue;

          if (scheduledDate && step1Data?.scheduledTime) {
            const availability = await convex.query(api.availability.checkAvailability, {
              date: scheduledDate,
              startTime: step1Data.scheduledTime,
              duration: selectedDuration,
            });

            if (!availability.available) {
              setStep4Data(selectedStep4Data);
              toast.error(
                "That time is no longer available for the selected services. Please choose a new time.",
              );
              setCurrentStep(1);
              return;
            }
          }

          setStep4Data(selectedStep4Data);
          setCurrentStep(5);
        }
        break;
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    resetBooking();
    if (typeof window !== "undefined") {
      localStorage.removeItem("selectedAddress");
      localStorage.removeItem("appointmentFormData");
    }
    router.push("/");
  };

  const hasServices = services?.some((service) => service.isActive) ?? false;

  const onSubmit = async () => {
    if (!step2Data?.phone || !step2Data?.email || !step2Data?.name) {
      toast.error("Please go back and enter your contact details.");
      return;
    }

    if (!step1Data?.scheduledDate || !step1Data?.scheduledTime) {
      toast.error("Please go back and select a date and time.");
      return;
    }

    if (!step3Data?.vehicles || step3Data.vehicles.length === 0) {
      toast.error("Please go back and add at least one vehicle.");
      return;
    }

    if (!hasServices) {
      toast.error(
        "No services are available at this time. Please contact us directly.",
      );
      return;
    }

    setIsLoading(true);
    try {
      const fullName = step2Data.name;
      const email = step2Data.email;
      const phone = step2Data.phone;

      const {
        draftId,
        resumeToken: nextResumeToken,
        travelDistanceMiles,
        travelFee,
      } = await upsertBookingDraft({
        resumeToken: resumeToken || undefined,
        name: fullName!,
        email: email!,
        phone: phone!,
        address: {
          street: step1Data.street,
          city: step1Data.city,
          state: step1Data.state,
          zip: step1Data.zip || "",
          notes: step1Data.locationNotes,
        },
        vehicles: step3Data.vehicles.map((vehicle) => ({
          year: parseInt(vehicle.year),
          make: vehicle.make,
          model: vehicle.model,
          vehicleTypeId: vehicle.vehicleTypeId as Id<"vehicleTypes"> | undefined,
          classification: vehicle.classification,
          size: vehicle.size,
          color: vehicle.color,
          licensePlate: vehicle.licensePlate,
          hasPet: vehicle.hasPet ?? false,
          beforePhotos: vehicle.beforePhotos ?? [],
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceIds: (step4Data?.serviceIds || []) as any,
        scheduledDate: new Date(step1Data.scheduledDate).toISOString().split("T")[0],
        scheduledTime: step1Data.scheduledTime,
        smsOptIn: step2Data.smsOptIn,
        paymentOption,
      });
      setResumeToken(nextResumeToken);
      setTravelQuote({ distanceMiles: travelDistanceMiles, fee: travelFee });

      const { url } = await createBookingCheckout({
        draftId,
        origin: window.location.origin,
      });

      if (url) {
        resetBooking();
        if (typeof window !== "undefined") {
          localStorage.removeItem("selectedAddress");
          localStorage.removeItem("appointmentFormData");
        }
        window.location.href = url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Booking error:", error);
      const maybeConvexError = error as { data?: { message?: string } };
      toast.error(
        maybeConvexError?.data?.message ||
          (error instanceof Error ? error.message : "Failed to create appointment"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (services === undefined || bookingReadiness === undefined) {
    return (
      <Card className="w-full max-w-3xl mx-auto shadow-2xl bg-card/70 backdrop-blur-md border border-border/50 p-6">
        <CardHeader className="space-y-2 text-center pb-6">
          <CardTitle className="text-3xl font-bold text-foreground">Schedule Your Detailing</CardTitle>
          <CardDescription className="text-base text-muted-foreground">Loading available services...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </CardContent>
      </Card>
    );
  }

  if (!bookingReadiness.isReady) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-2xl bg-card/70 backdrop-blur-md border border-border/50">
        <CardHeader className="space-y-2 text-center pb-6">
          <CardTitle className="text-2xl font-bold text-foreground">Booking Coming Soon</CardTitle>
          <CardDescription className="text-base text-muted-foreground">Online booking is still being configured.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-6">
          <p className="text-muted-foreground">
            Create an account now and we&apos;ll keep you updated when booking opens.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => (window.location.href = "/sign-up")}>
              Get Started
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (services === null || !hasServices) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-2xl bg-card/70 backdrop-blur-md border border-border/50">
        <CardHeader className="space-y-2 text-center pb-6">
          <CardTitle className="text-2xl font-bold text-foreground">No Services Available</CardTitle>
          <CardDescription className="text-base text-muted-foreground">Our services are being configured.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-6">
          <p className="text-muted-foreground">
            No detailing services are available for booking at this time.
            Please contact us directly.
          </p>
          <div className="space-y-2">
            <p className="font-medium">Call us at:</p>
            <a
              href="tel:501-454-7140"
              className="text-accent hover:underline font-medium text-lg"
            >
              (501) 454-7140
            </a>
          </div>
          <div className="flex justify-center pt-4">
            <Button onClick={handleCancel} variant="outline" className="w-full">
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-2xl bg-card/70 backdrop-blur-md border border-border/50 overflow-hidden">
      <CardHeader className="space-y-2 border-b border-border/50 bg-muted/20 pb-6 relative">
        <div className="flex items-center justify-between">
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
            Schedule Your Detailing
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full"
            title="Cancel booking"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Cancel booking</span>
          </Button>
        </div>
        <CardDescription className="text-base font-medium text-accent">
          Step {currentStep} of 5:{" "}
          {currentStep === 1
            ? "Date & Location"
            : currentStep === 2
              ? "Personal Info"
              : currentStep === 3
                ? "Vehicle Details"
                : currentStep === 4
                  ? "Service Selection"
                  : "Create Account & Payment"}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 md:p-8 space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                step === currentStep
                  ? "w-16 bg-accent"
                  : step < currentStep
                    ? "w-10 bg-accent/60"
                    : "w-10 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Date & Location */}
        {currentStep === 1 && (
          <Form {...step1Form}>
            <form className="space-y-5">
              <FormField
                control={step1Form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Preferred Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().split("T")[0]
                            : field.value || ""
                        }
                        onChange={(e) => {
                          const date = new Date(e.target.value);
                          const userTimezoneOffset = date.getTimezoneOffset() * 60000;
                          const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
                          field.onChange(adjustedDate);
                          step1Form.setValue("scheduledTime", "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        className="bg-background border-border text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step1Form.control}
                name="scheduledTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Preferred Time</FormLabel>
                    <FormControl>
                      <TimeSlotPicker 
                        date={
                          step1Form.watch("scheduledDate") instanceof Date
                            ? step1Form
                                .watch("scheduledDate")!
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        selectedTime={field.value}
                        onTimeSelect={(time) => field.onChange(time)}
                        serviceDuration={schedulingDuration}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AddressInput
                onAddressSelect={handleAddressSelect}
                label="Service Address"
                placeholder="Search for your service address"
              />
              <FormField
                control={step1Form.control}
                name="street"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step1Form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step1Form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step1Form.control}
                name="zip"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step1Form.control}
                name="locationNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Location Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any special instructions for finding the location"
                        className="bg-background border-border text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}

        {/* Step 2: Personal Info */}
        {currentStep === 2 && (
          <Form {...step2Form}>
            <form className="space-y-6">
              <FormField
                control={step2Form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} className="bg-background border-border text-foreground" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step2Form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        type="tel" 
                        placeholder="123-456-7890"
                        className="bg-background border-border text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step2Form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground">Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} type="email" className="bg-background border-border text-foreground" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step2Form.control}
                name="smsOptIn"
                render={({ field }) => (
                  <FormItem className="rounded-xl border border-border/60 bg-muted/10 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <FormLabel className="mb-0 text-sm font-semibold text-foreground">
                          Receive urgent text updates
                        </FormLabel>
                        <p className="text-xs text-muted-foreground leading-normal">
                          Get SMS alerts for confirmations, reminders,
                          cancellations, reschedules, and when we start service.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}

        {/* Step 3: Vehicle Details */}
        {currentStep === 3 && (
          <Form {...step3Form}>
            <form className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Vehicle Details</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVehicle}
                    disabled={!step3Form.formState.isValid && (step3Form.getValues("vehicles")?.length || 0) > 0} 
                  >
                    Add Another Vehicle
                  </Button>
                </div>

                {step3Form.watch("vehicles")?.map((vehicle, index) => (
                  <VehicleLookupCard
                    key={index}
                    title={`Vehicle ${index + 1}`}
                    value={vehicle}
                    onChange={(nextVehicle) => updateVehicle(index, nextVehicle)}
                    showLicensePlate
                    showPetToggle
                    showBeforePhotos
                    onRemove={index > 0 ? () => removeVehicle(index) : undefined}
                  />
                ))}
              </div>
            </form>
          </Form>
        )}

        {/* Step 4: Service Selection */}
        {currentStep === 4 && (
          <Form {...step4Form}>
            <form className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Select Services</h3>
                
                <FormField
                  control={step4Form.control}
                  name="serviceIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="space-y-8">
                          {(() => {
                            const selectedVehicleSize = primaryVehiclePricingContext.vehicleSize;
                            const selectedVehicleTypeId = primaryVehiclePricingContext.vehicleTypeId;
                            const standardServices =
                              services?.filter(
                                (service) =>
                                  normalizeServiceType(service.serviceType) === "standard" &&
                                  isAvailableForBookingVehicles(service),
                              ) ?? [];
                            const addonServices =
                              services?.filter(
                                (service) =>
                                  normalizeServiceType(service.serviceType) === "addon" &&
                                  isAvailableForBookingVehicles(service),
                              ) ?? [];
                            const subscriptionServices =
                              services?.filter(
                                (service) =>
                                  normalizeServiceType(service.serviceType) === "subscription" &&
                                  isAvailableForBookingVehicles(service),
                              ) ?? [];

                            return (
                              <>
                                {/* Packages Section */}
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">ONE REQUIRED</span>
                                    Packages
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {standardServices.map(service => {
                                        const isSelected = field.value?.includes(service._id) || false;
                                        return (
                                          <ServiceCard
                                            key={service._id}
                                            service={service}
                                            vehicleSize={selectedVehicleSize}
                                            vehicleTypeId={selectedVehicleTypeId}
                                            isSelected={isSelected}
                                            onSelect={() => {
                                              const current = field.value || [];
                                              const otherServices = current.filter(id => {
                                                const s = services.find(s => s._id === id);
                                                return s && normalizeServiceType(s.serviceType) !== "standard";
                                              });
                                              field.onChange([...otherServices, service._id]);
                                            }}
                                          />
                                        );
                                      })}
                                      {standardServices.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic col-span-full">
                                          No packages are available for this vehicle yet.
                                        </p>
                                      )}
                                  </div>
                                </div>

                                {/* Add-ons Section */}
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm text-muted-foreground">Add-ons (Optional)</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {addonServices.map(service => {
                                        const isSelected = field.value?.includes(service._id) || false;
                                        return (
                                          <ServiceCard
                                            key={service._id}
                                            service={service}
                                            vehicleSize={selectedVehicleSize}
                                            vehicleTypeId={selectedVehicleTypeId}
                                            isSelected={isSelected}
                                            onSelect={() => {
                                              const currentIds = field.value || [];
                                              const nextIds = currentIds.includes(service._id)
                                                ? currentIds.filter((id) => id !== service._id)
                                                : [...currentIds, service._id];
                                              field.onChange(nextIds);
                                            }}
                                          />
                                        );
                                      })}
                                      {addonServices.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic col-span-full">No add-ons available.</p>
                                      )}
                                  </div>
                                </div>

                                {/* Subscriptions Section */}
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm text-muted-foreground">Subscriptions (Optional)</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {subscriptionServices.map(service => {
                                        const isSelected = field.value?.includes(service._id) || false;
                                        return (
                                          <ServiceCard
                                            key={service._id}
                                            service={service}
                                            vehicleSize={selectedVehicleSize}
                                            vehicleTypeId={selectedVehicleTypeId}
                                            isSelected={isSelected}
                                            onSelect={(selected) => {
                                              const current = field.value || [];
                                              const otherServices = current.filter(id => {
                                                const s = services.find(s => s._id === id);
                                                return s && normalizeServiceType(s.serviceType) !== "subscription";
                                              });
                                              
                                              if (selected) {
                                                  field.onChange([...otherServices, service._id]);
                                              } else {
                                                  field.onChange(otherServices);
                                              }
                                            }}
                                          />
                                        );
                                      })}
                                      {subscriptionServices.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic col-span-full">No subscriptions available.</p>
                                      )}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        )}

        {/* Step 5: Create Account & Payment */}
        {currentStep === 5 && (() => {
          const vehicleCount = vehiclePricingContexts.length;
          const depositPerVehicle = 50;
          const depositTotal = depositPerVehicle * vehicleCount;
          const petFeeForSize = (size: "small" | "medium" | "large") => {
            if (petFeeSettings?.isActive === false) return 0;
            if (size === "small") {
              return petFeeSettings?.basePriceSmall ?? petFeeSettings?.basePriceMedium ?? 50;
            }
            if (size === "large") {
              return petFeeSettings?.basePriceLarge ?? petFeeSettings?.basePriceMedium ?? 50;
            }
            return petFeeSettings?.basePriceMedium ?? 50;
          };

          const selectedServices = services?.filter((s) =>
            step4Data?.serviceIds?.includes(s._id),
          ) ?? [];
          const serviceTotal = selectedServices.reduce((sum, service) => {
            const serviceSubtotal = vehiclePricingContexts.reduce(
              (vehicleSum, vehicle) =>
                vehicleSum +
                getEffectiveServicePricingForVehicle(service, vehicle).price,
              0,
            );
            return sum + serviceSubtotal;
          }, 0);
          const petFeeTotal = (step3Data?.vehicles ?? []).reduce((sum, vehicle) => {
            if (!vehicle.hasPet) return sum;
            return sum + petFeeForSize(vehicle.size ?? "medium");
          }, 0);
          const travelFeeTotal = travelQuote?.fee ?? 0;
          const orderTotal = serviceTotal + petFeeTotal + travelFeeTotal;

          const dueNow = paymentOption === "full" ? orderTotal : Math.min(depositTotal, orderTotal);

          return (
            <div className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-foreground">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px]">✓</span>
                  Order Summary
                </h3>
                {selectedServices.map((service) => {
                  const isSubscription = service.serviceType === "subscription";
                  const serviceSubtotal = vehiclePricingContexts.reduce(
                    (sum, vehicle) =>
                      sum +
                      getEffectiveServicePricingForVehicle(service, vehicle).price,
                    0,
                  );

                  return (
                    <div key={service._id} className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        {service.name}
                        {vehicleCount > 1 && <span className="text-xs"> x{vehicleCount}</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">${serviceSubtotal.toFixed(2)}</span>
                        {isSubscription && <span className="text-[10px] text-muted-foreground">/mo</span>}
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-between text-sm font-medium mt-3 border-t border-border/30 pt-3">
                  <span className="text-muted-foreground">Service Total</span>
                  <span className="text-foreground">${serviceTotal.toFixed(2)}</span>
                </div>
                {petFeeTotal > 0 && (
                  <div className="flex justify-between text-sm font-medium mt-1">
                    <span className="text-muted-foreground">Pet Fee</span>
                    <span className="text-foreground">${petFeeTotal.toFixed(2)}</span>
                  </div>
                )}
                {travelFeeTotal > 0 && (
                  <div className="flex justify-between text-sm font-medium mt-1">
                    <span className="text-muted-foreground">
                      Travel Fee
                      {travelQuote && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({travelQuote.distanceMiles.toFixed(1)} miles)
                        </span>
                      )}
                    </span>
                    <span className="text-foreground">${travelFeeTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border/50 pt-2 text-base font-bold mt-2">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">${orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Option Selector */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Payment Option</h3>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      paymentOption === "deposit"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
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
                      <span className="font-semibold text-sm text-foreground">Pay Deposit Now</span>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        ${Math.min(depositTotal, orderTotal).toFixed(2)} deposit now, remaining balance invoiced after service
                      </span>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      paymentOption === "full"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
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
                      <span className="font-semibold text-sm text-foreground">Pay Full Price Now</span>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        ${orderTotal.toFixed(2)} — pay entire amount upfront
                      </span>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      paymentOption === "in_person"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
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
                      <span className="font-semibold text-sm text-foreground">Pay Remaining in Person</span>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        ${Math.min(depositTotal, orderTotal).toFixed(2)} deposit now, pay balance in cash/card at service
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Amount Due Now */}
              <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="font-bold text-base block text-foreground">
                      {paymentOption === "full" ? "Total Due Now" : "Deposit Due Now"}
                    </span>
                    <span className="text-xs text-muted-foreground">Secure payment via Stripe</span>
                  </div>
                  <span className="font-bold text-xl text-primary">${dueNow.toFixed(2)}</span>
                </div>
                {paymentOption !== "full" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    This deposit is non-refundable and will be applied to your service total.
                  </p>
                )}
                {paymentOption === "in_person" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Remaining balance of ${Math.max(0, orderTotal - depositTotal).toFixed(2)} will be collected in person.
                  </p>
                )}
              </div>

              <div className="mt-6">
                {!isSignedIn ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-4 rounded-xl text-sm mb-4 border border-blue-200 dark:border-blue-800 text-center">
                    We&apos;ll email your booking details after payment. If you want an online account, you can create one later with the same email address.
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3 rounded-xl text-sm mb-4 flex items-center gap-2 border border-green-200 dark:border-green-800">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Logged in as {user?.primaryEmailAddress?.emailAddress}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Navigation Buttons */}
        <div className="flex gap-4 pt-6 border-t border-border/50 mt-6">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              className="flex-1 h-12"
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 h-12 text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}

          {currentStep < 5 ? (
            <Button type="button" onClick={nextStep} className="flex-1 h-12">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSubmit}
              className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  {paymentOption === "full" ? "Pay & Book" : "Pay Deposit & Book"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
