"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useAction, useConvex, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useBookingStore } from "@/hooks/use-booking-store";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { calculateSchedulingDuration } from "@/convex/lib/booking";
import {
  getEffectiveServicePricingForVehicle,
  isServiceAvailableForVehicle,
  normalizeServiceType,
  type ServiceType,
  type VehicleSize,
} from "@/convex/lib/pricing";
import { isArkansasState, normalizeStateCode } from "@/convex/lib/address";
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
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from "lucide-react";
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

type BookingService = {
  _id: Id<"services">;
  name: string;
  description: string;
  categoryName?: string;
  serviceType?: ServiceType;
  isActive: boolean;
  basePrice?: number;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  duration?: number;
  durationSmall?: number;
  durationMedium?: number;
  durationLarge?: number;
  vehiclePrices?: Array<{
    vehicleTypeId: Id<"vehicleTypes">;
    price: number;
    isAvailable: boolean;
    duration?: number;
  }>;
  bookableVehicleTypeIds?: Id<"vehicleTypes">[];
  bookableLegacySizes?: Array<"small" | "medium" | "large">;
};

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
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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
  serviceIds: z.array(z.string()),
  vehicleServices: z.record(
    z.string(),
    z.array(z.string()).min(1, "Please select at least one package/service for this vehicle")
  ).optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;

type OutOfAreaMode = "idle" | "notify" | "review" | "submitted";

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
    bufferMinutes: number;
  } | null>(null);
  const { user, isLoaded, isSignedIn } = useUser();
  const [expandedVehicleIndex, setExpandedVehicleIndex] = useState<number>(0);
  const [expandedStep4VehicleIndex, setExpandedStep4VehicleIndex] = useState<number>(0);
  const [activeServiceSection, setActiveServiceSection] = useState<Record<number, "packages" | "addons" | "subscriptions" | "">>(
    {},
  );
  const [outOfAreaMode, setOutOfAreaMode] = useState<OutOfAreaMode>("idle");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [isNotifySubmitting, setIsNotifySubmitting] = useState(false);
  const [reviewContact, setReviewContact] = useState({
    name: step2Data?.name || "",
    email: step2Data?.email || "",
    phone: step2Data?.phone || "",
    smsOptIn: step2Data?.smsOptIn ?? false,
  });
  const [reviewVehicle, setReviewVehicle] = useState<VehicleLookupValue>({
    year: "",
    make: "",
    model: "",
    color: "",
    licensePlate: "",
    size: "small",
    hasPet: false,
  });
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

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
      latitude: step1Data?.latitude ?? undefined,
      longitude: step1Data?.longitude ?? undefined,
    },
  });

  const services = useQuery(api.services.list) as BookingService[] | undefined;
  const petFeeSettings = useQuery(api.petFeeSettings.get);
  const depositSettings = useQuery(api.depositSettings.get);
  const bookingReadiness = useQuery(api.setupReadiness.getPublicBookingReadiness);
  const nextBookableDate = useQuery(
    api.availability.getNextBookableDate,
    bookingReadiness?.isReady ? {} : "skip",
  );
  const upsertBookingDraft = useAction(api.bookingDrafts.createOrUpdate);
  const calculateTravelFee = useAction(api.travelFees.calculate);
  const createBookingCheckout = useAction(api.payments.createBookingCheckout);
  const saveOutOfAreaLead = useMutation(api.bookingDrafts.saveOutOfAreaLead);
  const saveOutOfAreaRequest = useMutation(api.bookingDrafts.saveOutOfAreaRequest);
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

  const watchedStreet = step1Form.watch("street");
  const watchedCity = step1Form.watch("city");
  const watchedState = step1Form.watch("state");
  const watchedZip = step1Form.watch("zip");
  const watchedLocationNotes = step1Form.watch("locationNotes");
  const watchedLatitude = step1Form.watch("latitude");
  const watchedLongitude = step1Form.watch("longitude");
  const isArkansasAddress = isArkansasState(watchedState);
  const isOutOfAreaAddress =
    watchedState.trim().length > 0 && !isArkansasAddress;
  const travelFeeEstimate = travelQuote?.fee ?? 0;
  const hasArkansasTravelFee = isArkansasAddress && travelFeeEstimate > 0;
  const isExtendedArkansasTrip =
    hasArkansasTravelFee && (travelQuote?.distanceMiles ?? 0) > 60;
  const selectedAddressLabel = [watchedStreet, watchedCity, watchedState, watchedZip]
    .filter(Boolean)
    .join(", ");

  const handleNotifySubmit = useCallback(async () => {
    if (!notifyEmail || !notifyEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsNotifySubmitting(true);
    try {
      await saveOutOfAreaLead({
        email: notifyEmail,
        address: selectedAddressLabel,
        latitude: watchedLatitude,
        longitude: watchedLongitude,
      });
      setNotifyEmail("");
      setOutOfAreaMode("submitted");
      toast.success("Thank you! We'll notify you when we expand to your area.");
    } catch (err) {
      console.error("Failed to save lead:", err);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setIsNotifySubmitting(false);
    }
  }, [
    notifyEmail,
    saveOutOfAreaLead,
    selectedAddressLabel,
    watchedLatitude,
    watchedLongitude,
  ]);

  const handleOutOfAreaReviewSubmit = useCallback(async () => {
    if (!reviewContact.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (!reviewContact.email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (reviewContact.phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number.");
      return;
    }

    setIsReviewSubmitting(true);
    try {
      const scheduledDateValue = step1Form.getValues("scheduledDate");
      const scheduledDate =
        scheduledDateValue instanceof Date
          ? scheduledDateValue.toISOString().split("T")[0]
          : undefined;
      const vehicleYear = /^\d{4}$/.test(reviewVehicle.year)
        ? Number(reviewVehicle.year)
        : undefined;
      const hasVehicleDetails =
        vehicleYear || reviewVehicle.make.trim() || reviewVehicle.model.trim();

      await saveOutOfAreaRequest({
        name: reviewContact.name,
        email: reviewContact.email,
        phone: reviewContact.phone,
        smsOptIn: reviewContact.smsOptIn,
        address: {
          street: watchedStreet,
          city: watchedCity,
          state: watchedState,
          zip: watchedZip || "",
          notes: watchedLocationNotes || undefined,
          latitude: watchedLatitude,
          longitude: watchedLongitude,
        },
        scheduledDate,
        scheduledTime: step1Form.getValues("scheduledTime") || undefined,
        estimatedDistanceMiles: travelQuote?.distanceMiles,
        estimatedTravelFee: travelQuote?.fee,
        vehicle: hasVehicleDetails
          ? {
              year: vehicleYear,
              make: reviewVehicle.make || undefined,
              model: reviewVehicle.model || undefined,
              vehicleTypeId: reviewVehicle.vehicleTypeId as
                | Id<"vehicleTypes">
                | undefined,
              vehicleTypeName: reviewVehicle.vehicleTypeName,
              classification: reviewVehicle.classification,
              size: reviewVehicle.size,
              color: reviewVehicle.color || undefined,
              licensePlate: reviewVehicle.licensePlate || undefined,
              hasPet: reviewVehicle.hasPet,
            }
          : undefined,
      });
      setOutOfAreaMode("submitted");
      toast.success("Request received. We'll review it and reach out.");
    } catch (err) {
      console.error("Failed to save out-of-area request:", err);
      toast.error("Failed to submit your request. Please try again.");
    } finally {
      setIsReviewSubmitting(false);
    }
  }, [
    reviewContact.email,
    reviewContact.name,
    reviewContact.phone,
    reviewContact.smsOptIn,
    reviewVehicle,
    saveOutOfAreaRequest,
    step1Form,
    travelQuote?.distanceMiles,
    travelQuote?.fee,
    watchedCity,
    watchedLatitude,
    watchedLocationNotes,
    watchedLongitude,
    watchedState,
    watchedStreet,
    watchedZip,
  ]);

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
          latitude: watchedLatitude,
          longitude: watchedLongitude,
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
    watchedLatitude,
    watchedLongitude,
  ]);

  const schedulingDuration = useMemo(() => {
    if (!services) return 0;

    const serviceDurations: number[] = [];
    const vehicles = step3Data?.vehicles ?? [];

    vehicles.forEach((vehicle, idx) => {
      const vServiceIds = step4Data?.vehicleServices?.[idx.toString()] || step4Data?.serviceIds || [];
      const vehicleServices = services.filter((service) => vServiceIds.includes(service._id));
      const context = {
        vehicleSize: (vehicle.size ?? "medium") as VehicleSize,
        vehicleTypeId: vehicle.vehicleTypeId ?? null,
      };

      vehicleServices.forEach((service) => {
        serviceDurations.push(
          getEffectiveServicePricingForVehicle(service, context).duration
        );
      });
    });

    const petFeeVehicleCount =
      petFeeSettings?.isActive === false
        ? 0
        : step3Data?.vehicles?.filter((vehicle) => vehicle.hasPet).length ?? 0;

    return calculateSchedulingDuration({
      serviceDurations,
      petFeeVehicleCount,
      petFeeTimeMinutes: petFeeSettings?.timeAddMinutes,
      travelBufferMinutes: travelQuote?.bufferMinutes,
    });
  }, [
    petFeeSettings?.isActive,
    petFeeSettings?.timeAddMinutes,
    services,
    step3Data?.vehicles,
    step4Data?.serviceIds,
    step4Data?.vehicleServices,
    travelQuote?.bufferMinutes,
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
      vehicleServices: step4Data?.vehicleServices || {},
    },
  });

  useEffect(() => {
    if (!services || !step3Data?.vehicles || !step4Data?.vehicleServices) {
      return;
    }

    let changed = false;
    const nextVehicleServices = { ...step4Data.vehicleServices };

    step3Data.vehicles.forEach((vehicle, idx) => {
      const vehicleKey = idx.toString();
      const currentSelection = nextVehicleServices[vehicleKey] || [];
      if (currentSelection.length === 0) return;

      const vehiclePricingContext = {
        vehicleSize: (vehicle.size ?? "medium") as VehicleSize,
        vehicleTypeId: vehicle.vehicleTypeId ?? null,
      };

      const nextSelection = currentSelection.filter((serviceId) => {
        const service = services.find((s) => s._id === serviceId);
        return service && isServiceAvailableForVehicle(service, vehiclePricingContext);
      });

      if (nextSelection.length !== currentSelection.length) {
        nextVehicleServices[vehicleKey] = nextSelection;
        changed = true;
      }
    });

    if (changed) {
      step4Form.setValue("vehicleServices", nextVehicleServices, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setStep4Data({
        ...step4Data,
        vehicleServices: nextVehicleServices,
      });
    }
  }, [
    services,
    step3Data?.vehicles,
    step4Data,
    setStep4Data,
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
    if (!isLoaded || !isSignedIn || !user) return;

    setReviewContact((current) => ({
      name: current.name || user.fullName || "",
      email: current.email || user.primaryEmailAddress?.emailAddress || "",
      phone: current.phone,
      smsOptIn:
        current.smsOptIn ||
        currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn ||
        false,
    }));
  }, [
    currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn,
    isLoaded,
    isSignedIn,
    user,
  ]);

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

      setOutOfAreaMode("idle");
      setNotifyEmail("");
      step1Form.clearErrors("state");

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
      step1Form.setValue("state", normalizeStateCode(address.state), {
        shouldValidate: true,
        shouldDirty: true,
      });
      step1Form.setValue("zip", address.postalCode || "", {
        shouldValidate: true,
        shouldDirty: true,
      });
      step1Form.setValue("latitude", address.latitude, {
        shouldValidate: true,
        shouldDirty: true,
      });
      step1Form.setValue("longitude", address.longitude, {
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
    const nextVehicles = [
      ...currentVehicles,
      {
        year: "",
        make: "",
        model: "",
        color: "",
        licensePlate: "",
        size: "small" as "small" | "medium" | "large" | undefined,
        hasPet: false,
        beforePhotos: [],
      },
    ];
    step3Form.setValue("vehicles", nextVehicles);
    setExpandedVehicleIndex(nextVehicles.length - 1);
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
      setExpandedVehicleIndex((prev) => {
        if (prev >= currentVehicles.length - 1) {
          return Math.max(0, currentVehicles.length - 2);
        }
        return prev;
      });
    }
  };

  const nextStep = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await step1Form.trigger();
        if (isValid) {
          const formData = step1Form.getValues();
          const isStateOutOfArea = !isArkansasState(formData.state);
          if (isStateOutOfArea) {
            step1Form.setError("state", {
              type: "manual",
              message: "Please request manual review for out-of-area service.",
            });
            setOutOfAreaMode((current) => current === "submitted" ? current : "review");
            return;
          }
          const normalizedFormData = {
            ...formData,
            state: normalizeStateCode(formData.state),
          };
          setStep1Data(normalizedFormData);
          localStorage.setItem(
            "appointmentFormData",
            JSON.stringify(normalizedFormData),
          );
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

          // Pre-populate/clean up Step 4 vehicleServices
          const currentStep4 = step4Form.getValues();
          const nextVehicleServices = { ...currentStep4.vehicleServices };
          values.vehicles.forEach((_, idx) => {
            const key = idx.toString();
            if (!nextVehicleServices[key] || nextVehicleServices[key].length === 0) {
              nextVehicleServices[key] = [];
            }
          });
          Object.keys(nextVehicleServices).forEach((key) => {
            const idx = parseInt(key, 10);
            if (isNaN(idx) || idx >= values.vehicles.length) {
              delete nextVehicleServices[key];
            }
          });
          step4Form.setValue("vehicleServices", nextVehicleServices);

          setCurrentStep(4);
        }
        break;
      case 4:
        isValid = await step4Form.trigger();
        if (isValid) {
          const selectedStep4Data = step4Form.getValues();
          const selectedVehicles = step3Data?.vehicles ?? [];
          for (let idx = 0; idx < selectedVehicles.length; idx += 1) {
            const vehicle = selectedVehicles[idx];
            const vehicleContext = {
              vehicleSize: (vehicle.size ?? "medium") as VehicleSize,
              vehicleTypeId: vehicle.vehicleTypeId ?? null,
            };
            const selectedIds =
              selectedStep4Data.vehicleServices?.[idx.toString()] ||
              selectedStep4Data.serviceIds ||
              [];
            const selectedServices =
              services?.filter((service) => selectedIds.includes(service._id)) ?? [];
            const unavailableService = selectedServices.find(
              (service) => !isServiceAvailableForVehicle(service, vehicleContext),
            );
            if (unavailableService) {
              toast.error(
                `${unavailableService.name} is not available for ${vehicle.make || "this vehicle"}. Please choose another service.`,
              );
              setExpandedStep4VehicleIndex(idx);
              return;
            }
            const hasStandardPackage = selectedServices.some(
              (service) => normalizeServiceType(service.serviceType) === "standard",
            );
            if (!hasStandardPackage) {
              toast.error("Please choose a package for each vehicle.");
              setExpandedStep4VehicleIndex(idx);
              setActiveServiceSection((current) => ({ ...current, [idx]: "packages" }));
              return;
            }
          }

          const serviceDurations: number[] = [];
          const vehicles = step3Data?.vehicles ?? [];
          vehicles.forEach((vehicle, idx) => {
            const vServiceIds = selectedStep4Data.vehicleServices?.[idx.toString()] || selectedStep4Data.serviceIds || [];
            const vehicleServices = services?.filter((service) => vServiceIds.includes(service._id)) ?? [];
            const context = {
              vehicleSize: (vehicle.size ?? "medium") as VehicleSize,
              vehicleTypeId: vehicle.vehicleTypeId ?? null,
            };
            vehicleServices.forEach((service) => {
              serviceDurations.push(
                getEffectiveServicePricingForVehicle(service, context).duration
              );
            });
          });

          const petFeeVehicleCount =
            petFeeSettings?.isActive === false
              ? 0
              : step3Data?.vehicles?.filter((vehicle) => vehicle.hasPet).length ?? 0;
          const selectedDuration = calculateSchedulingDuration({
            serviceDurations,
            petFeeVehicleCount,
            petFeeTimeMinutes: petFeeSettings?.timeAddMinutes,
            travelBufferMinutes: travelQuote?.bufferMinutes,
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
          latitude: step1Data.latitude,
          longitude: step1Data.longitude,
        },
        vehicles: step3Data.vehicles.map((vehicle, index) => ({
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
          serviceIds: (step4Data?.vehicleServices?.[index.toString()] || []) as Id<"services">[],
        })),
        existingVehicleServices: [],
        serviceIds: Array.from(new Set(
          Object.values(step4Data?.vehicleServices || {}).flat()
        )) as Id<"services">[],
        scheduledDate: new Date(step1Data.scheduledDate).toISOString().split("T")[0],
        scheduledTime: step1Data.scheduledTime,
        smsOptIn: step2Data.smsOptIn,
        paymentOption,
      });
      setResumeToken(nextResumeToken);
      setTravelQuote({
        distanceMiles: travelDistanceMiles,
        fee: travelFee,
        bufferMinutes: travelQuote?.bufferMinutes ?? 0,
      });

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
              {hasArkansasTravelFee && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {isExtendedArkansasTrip
                          ? "Arkansas service area confirmed"
                          : "Travel fee applies"}
                      </p>
                      <p className="text-sm text-sky-900/80 dark:text-sky-100/80">
                        {isExtendedArkansasTrip
                          ? "We can service this Arkansas address. Because it is farther from Little Rock, an estimated travel fee will be added at checkout."
                          : "This address is outside the no-fee local zone, so an estimated travel fee will be added at checkout."}{" "}
                        <span className="font-semibold">
                          ${travelFeeEstimate.toFixed(2)}
                        </span>
                        {travelQuote && (
                          <span>
                            {" "}
                            ({travelQuote.distanceMiles.toFixed(1)} miles)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {isOutOfAreaAddress && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  {outOfAreaMode === "submitted" ? (
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                      <div className="space-y-1">
                        <p className="font-semibold">Request received</p>
                        <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                          We saved your information and will reach out if we can serve this area or when service expands.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="space-y-1">
                          <p className="font-semibold">Manual review required for this area</p>
                          <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                            This address appears to be outside Arkansas. We may still be able to make the trip with an estimated travel fee of{" "}
                            <span className="font-semibold">
                              {travelQuote ? `$${travelQuote.fee.toFixed(2)}` : "calculating"}
                            </span>
                            , but we need to review timing before taking payment.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => setOutOfAreaMode("review")}
                          className="bg-amber-900 text-white hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
                        >
                          Request Review
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOutOfAreaMode("notify")}
                          className="border-amber-300 bg-white/70 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                        >
                          Get Notified
                        </Button>
                      </div>

                      {outOfAreaMode === "notify" && (
                        <div className="grid gap-3 rounded-lg border border-amber-200 bg-white/70 p-3 dark:border-amber-900 dark:bg-background/50 sm:grid-cols-[1fr_auto]">
                          <Input
                            type="email"
                            value={notifyEmail}
                            onChange={(event) => setNotifyEmail(event.target.value)}
                            placeholder="Email address"
                            className="bg-background"
                          />
                          <Button
                            type="button"
                            onClick={handleNotifySubmit}
                            disabled={isNotifySubmitting}
                          >
                            {isNotifySubmitting && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Submit
                          </Button>
                        </div>
                      )}

                      {outOfAreaMode === "review" && (
                        <div className="space-y-4 rounded-lg border border-amber-200 bg-white/70 p-4 dark:border-amber-900 dark:bg-background/50">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <FormLabel>Name</FormLabel>
                              <Input
                                value={reviewContact.name}
                                onChange={(event) =>
                                  setReviewContact((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                className="bg-background"
                              />
                            </div>
                            <div className="space-y-2">
                              <FormLabel>Email</FormLabel>
                              <Input
                                type="email"
                                value={reviewContact.email}
                                onChange={(event) =>
                                  setReviewContact((current) => ({
                                    ...current,
                                    email: event.target.value,
                                  }))
                                }
                                className="bg-background"
                              />
                            </div>
                            <div className="space-y-2">
                              <FormLabel>Phone</FormLabel>
                              <Input
                                type="tel"
                                value={reviewContact.phone}
                                onChange={(event) =>
                                  setReviewContact((current) => ({
                                    ...current,
                                    phone: event.target.value,
                                  }))
                                }
                                className="bg-background"
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                              <div>
                                <FormLabel>SMS updates</FormLabel>
                                <p className="text-xs text-muted-foreground">Text me about this request</p>
                              </div>
                              <Switch
                                checked={reviewContact.smsOptIn}
                                onCheckedChange={(checked) =>
                                  setReviewContact((current) => ({
                                    ...current,
                                    smsOptIn: checked,
                                  }))
                                }
                              />
                            </div>
                          </div>

                          <VehicleLookupCard
                            value={reviewVehicle}
                            onChange={setReviewVehicle}
                            title="Vehicle"
                            showColor
                            showLicensePlate
                            showPetToggle
                          />

                          <div className="flex justify-end">
                            <Button
                              type="button"
                              onClick={handleOutOfAreaReviewSubmit}
                              disabled={isReviewSubmitting}
                            >
                              {isReviewSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Submit Review Request
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                    isExpanded={expandedVehicleIndex === index}
                    onToggleExpanded={() => setExpandedVehicleIndex(index)}
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
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">Select Detailing Services</h3>
                  <p className="text-sm text-muted-foreground">
                    Customize the services for each of your vehicles below.
                  </p>
                </div>

                <FormField
                  control={step4Form.control}
                  name="vehicleServices"
                  render={({ field }) => (
                    <FormItem className="space-y-6">
                      <FormControl>
                        <div className="space-y-6">
                          {step3Data?.vehicles.map((vehicle, vIdx) => {
                            const vehicleKey = vIdx.toString();
                            const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || `Vehicle ${vIdx + 1}`;

                            const vehiclePricingContext = {
                              vehicleSize: (vehicle.size ?? "medium") as VehicleSize,
                              vehicleTypeId: vehicle.vehicleTypeId ?? null,
                            };

                            const standardServices = services?.filter(
                              (service) =>
                                normalizeServiceType(service.serviceType) === "standard" &&
                                isServiceAvailableForVehicle(service, vehiclePricingContext)
                            ) ?? [];

                            const addonServices = services?.filter(
                              (service) =>
                                normalizeServiceType(service.serviceType) === "addon" &&
                                isServiceAvailableForVehicle(service, vehiclePricingContext)
                            ) ?? [];

                            const subscriptionServices = services?.filter(
                              (service) =>
                                normalizeServiceType(service.serviceType) === "subscription" &&
                                isServiceAvailableForVehicle(service, vehiclePricingContext)
                            ) ?? [];

                            const getSortedServices = (list: Array<NonNullable<typeof services>[number]>) => {
                              return [...list].sort((a, b) => {
                                const priceA = getEffectiveServicePricingForVehicle(a, vehiclePricingContext).price;
                                const priceB = getEffectiveServicePricingForVehicle(b, vehiclePricingContext).price;
                                return priceA - priceB;
                              });
                            };

                            const sortedStandard = getSortedServices(standardServices);
                            const sortedAddons = getSortedServices(addonServices);
                            const sortedSubscriptions = getSortedServices(subscriptionServices);
                            const standardGroups = sortedStandard.reduce(
                              (groups, service) => {
                                const categoryName =
                                  service.categoryName || "Detail Packages";
                                const existing = groups.get(categoryName) ?? [];
                                existing.push(service);
                                groups.set(categoryName, existing);
                                return groups;
                              },
                              new Map<string, typeof sortedStandard>(),
                            );

                            const availableServiceIds = new Set(
                              [
                                ...standardServices,
                                ...addonServices,
                                ...subscriptionServices,
                              ].map((service) => String(service._id)),
                            );
                            const currentSelection = (field.value?.[vehicleKey] || []).filter(
                              (serviceId) => availableServiceIds.has(String(serviceId)),
                            );
                            const activeSection = activeServiceSection[vIdx] || "packages";

                            const selectedPackageId = currentSelection.find(id => {
                              const s = services?.find(s => s._id === id);
                              return s && normalizeServiceType(s.serviceType) === "standard";
                            });
                            const selectedPackage = services?.find(s => s._id === selectedPackageId);

                            const selectedAddons = services?.filter(s =>
                              currentSelection.includes(s._id) && normalizeServiceType(s.serviceType) === "addon"
                            ) ?? [];

                            const selectedSubId = currentSelection.find(id => {
                              const s = services?.find(s => s._id === id);
                              return s && normalizeServiceType(s.serviceType) === "subscription";
                            });
                            const selectedSubscription = services?.find(s => s._id === selectedSubId);

                            const isExpanded = expandedStep4VehicleIndex === vIdx;
                            const nextVehicle = step3Data?.vehicles?.[vIdx + 1];
                            const nextVehicleLabel = nextVehicle
                              ? [nextVehicle.year, nextVehicle.make, nextVehicle.model].filter(Boolean).join(" ") || `Vehicle ${vIdx + 2}`
                              : "";

                            const vehicleServices = services?.filter((s) => currentSelection.includes(s._id)) ?? [];
                            const vehicleServicesTotal = vehicleServices.reduce((sum, service) => {
                              return sum + getEffectiveServicePricingForVehicle(service, vehiclePricingContext).price;
                            }, 0);

                            return (
                              <Card key={vIdx} className="border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
                                <button
                                  type="button"
                                  className="w-full text-left focus:outline-none"
                                  onClick={() => setExpandedStep4VehicleIndex(isExpanded ? -1 : vIdx)}
                                >
                                  <CardHeader className="bg-muted/10 pb-4 border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer p-4">
                                    <CardTitle className="text-lg font-bold flex items-center justify-between w-full">
                                      <div className="flex items-center gap-3">
                                        <span>{vehicleLabel}</span>
                                        <span className="text-xs font-normal text-muted-foreground uppercase tracking-wider bg-muted/35 px-2.5 py-1 rounded-full border border-border/20">
                                          {vehicle.size || "medium"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {vehicleServicesTotal > 0 && (
                                          <span className="text-sm font-semibold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/20">
                                            ${vehicleServicesTotal}
                                          </span>
                                        )}
                                        {isExpanded ? (
                                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                        ) : (
                                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                        )}
                                      </div>
                                    </CardTitle>
                                  </CardHeader>
                                </button>
                                {isExpanded && (
                                  <CardContent className="p-4 space-y-3 bg-card/10">
                                  {/* Section 1: Choose a Package */}
                                  <div className="border border-border/40 rounded-xl overflow-hidden bg-background/30">
                                    <button
                                      type="button"
                                      className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors font-medium text-sm text-foreground text-left"
                                      onClick={() => setActiveServiceSection(prev => ({ ...prev, [vIdx]: (activeSection === "packages" ? "" : "packages") as "packages" | "addons" | "subscriptions" | "" }))}
                                    >
                                      <span className="flex items-center gap-2">
                                        <span className="bg-accent/10 text-accent px-2 py-0.5 rounded text-[10px] font-bold">REQUIRED</span>
                                        1. Choose Package
                                      </span>
                                      <span className="text-muted-foreground text-xs font-normal flex items-center gap-1.5">
                                        {selectedPackage ? (
                                          <span className="text-accent font-semibold">{selectedPackage.name} (${getEffectiveServicePricingForVehicle(selectedPackage, vehiclePricingContext).price})</span>
                                        ) : (
                                          <span>Select one</span>
                                        )}
                                        {activeSection === "packages" ? (
                                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        )}
                                      </span>
                                    </button>

                                    {activeSection === "packages" && (
                                      <div className="p-4 border-t border-border/40 bg-background/5">
                                        <div className="space-y-5">
                                          {Array.from(standardGroups.entries()).map(([categoryName, categoryServices]) => (
                                            <section key={categoryName} className="space-y-3">
                                              <div className="flex items-center justify-between gap-3">
                                                <h4 className="text-sm font-semibold text-foreground">
                                                  {categoryName}
                                                </h4>
                                                <span className="text-xs text-muted-foreground">
                                                  {categoryServices.length} option{categoryServices.length === 1 ? "" : "s"}
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {categoryServices.map(service => {
                                                  const isSelected = selectedPackageId === service._id;
                                                  return (
                                                    <ServiceCard
                                                      key={service._id}
                                                      service={service}
                                                      vehicleSize={vehiclePricingContext.vehicleSize}
                                                      vehicleTypeId={vehiclePricingContext.vehicleTypeId}
                                                      isSelected={isSelected}
                                                      onSelect={() => {
                                                        const otherServices = currentSelection.filter(id => {
                                                          const s = services?.find(s => s._id === id);
                                                          return s && normalizeServiceType(s.serviceType) !== "standard";
                                                        });
                                                        const nextSelection = [...otherServices, service._id];
                                                        const nextRecord = {
                                                          ...field.value,
                                                          [vehicleKey]: nextSelection,
                                                        };
                                                        field.onChange(nextRecord);

                                                        // Auto close Packages & open Addons
                                                        setActiveServiceSection(prev => ({ ...prev, [vIdx]: "addons" }));
                                                      }}
                                                    />
                                                  );
                                                })}
                                              </div>
                                            </section>
                                          ))}
                                          {sortedStandard.length === 0 && (
                                            <p className="text-sm text-muted-foreground italic col-span-full">No packages available for this vehicle size.</p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Section 2: Add-ons (Optional) */}
                                  <div className="border border-border/40 rounded-xl overflow-hidden bg-background/30">
                                    <button
                                      type="button"
                                      className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors font-medium text-sm text-foreground text-left"
                                      onClick={() => setActiveServiceSection(prev => ({ ...prev, [vIdx]: (activeSection === "addons" ? "" : "addons") as "packages" | "addons" | "subscriptions" | "" }))}
                                    >
                                      <span>2. Add-ons (Optional)</span>
                                      <span className="text-muted-foreground text-xs font-normal flex items-center gap-1.5">
                                        {selectedAddons.length > 0 ? (
                                          <span className="text-accent font-semibold">{selectedAddons.length} selected</span>
                                        ) : (
                                          <span>None</span>
                                        )}
                                        {activeSection === "addons" ? (
                                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        )}
                                      </span>
                                    </button>

                                    {activeSection === "addons" && (
                                      <div className="p-4 border-t border-border/40 bg-background/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {sortedAddons.map(service => {
                                            const isSelected = currentSelection.includes(service._id);
                                            return (
                                              <ServiceCard
                                                key={service._id}
                                                service={service}
                                                vehicleSize={vehiclePricingContext.vehicleSize}
                                                vehicleTypeId={vehiclePricingContext.vehicleTypeId}
                                                isSelected={isSelected}
                                                onSelect={() => {
                                                  const nextSelection = currentSelection.includes(service._id)
                                                    ? currentSelection.filter(id => id !== service._id)
                                                    : [...currentSelection, service._id];

                                                  const nextRecord = {
                                                    ...field.value,
                                                    [vehicleKey]: nextSelection,
                                                  };
                                                  field.onChange(nextRecord);
                                                }}
                                              />
                                            );
                                          })}
                                          {sortedAddons.length === 0 && (
                                            <p className="text-sm text-muted-foreground italic col-span-full">No add-ons available.</p>
                                          )}
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => setActiveServiceSection(prev => ({ ...prev, [vIdx]: "subscriptions" }))}
                                          >
                                            Next: Subscriptions
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Section 3: Subscriptions (Optional) */}
                                  <div className="border border-border/40 rounded-xl overflow-hidden bg-background/30">
                                    <button
                                      type="button"
                                      className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors font-medium text-sm text-foreground text-left"
                                      onClick={() => setActiveServiceSection(prev => ({ ...prev, [vIdx]: (activeSection === "subscriptions" ? "" : "subscriptions") as "packages" | "addons" | "subscriptions" | "" }))}
                                    >
                                      <span>3. Subscriptions (Optional)</span>
                                      <span className="text-muted-foreground text-xs font-normal flex items-center gap-1.5">
                                        {selectedSubscription ? (
                                          <span className="text-accent font-semibold">{selectedSubscription.name}</span>
                                        ) : (
                                          <span>None</span>
                                        )}
                                        {activeSection === "subscriptions" ? (
                                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        )}
                                      </span>
                                    </button>

                                    {activeSection === "subscriptions" && (
                                      <div className="p-4 border-t border-border/40 bg-background/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {sortedSubscriptions.map(service => {
                                            const isSelected = selectedSubId === service._id;
                                            return (
                                              <ServiceCard
                                                key={service._id}
                                                service={service}
                                                vehicleSize={vehiclePricingContext.vehicleSize}
                                                vehicleTypeId={vehiclePricingContext.vehicleTypeId}
                                                isSelected={isSelected}
                                                onSelect={(selected) => {
                                                  const otherServices = currentSelection.filter(id => {
                                                    const s = services?.find(s => s._id === id);
                                                    return s && normalizeServiceType(s.serviceType) !== "subscription";
                                                  });
                                                  const nextSelection = selected
                                                    ? [...otherServices, service._id]
                                                    : otherServices;

                                                  const nextRecord = {
                                                    ...field.value,
                                                    [vehicleKey]: nextSelection,
                                                  };
                                                  field.onChange(nextRecord);
                                                }}
                                              />
                                            );
                                          })}
                                          {sortedSubscriptions.length === 0 && (
                                            <p className="text-sm text-muted-foreground italic col-span-full">No subscriptions available.</p>
                                          )}
                                        </div>

                                        <div className="mt-4 flex justify-end">
                                          {vIdx < (step3Data?.vehicles.length ?? 0) - 1 ? (
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={() => {
                                                setExpandedStep4VehicleIndex(vIdx + 1);
                                                setActiveServiceSection(prev => ({ ...prev, [vIdx + 1]: "packages" }));
                                              }}
                                            >
                                              Next Vehicle: {nextVehicleLabel}
                                            </Button>
                                          ) : (
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={nextStep}
                                            >
                                              Continue to Schedule
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                                )}
                              </Card>
                            );
                          })}
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
          const depositPerVehicle = depositSettings?.amountPerVehicle ?? 50;
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

          const vehicles = step3Data?.vehicles ?? [];
          let serviceTotal = 0;
          const serviceBreakdownItems: Array<{
            vehicleLabel: string;
            serviceName: string;
            price: number;
            isSubscription: boolean;
          }> = [];

          vehicles.forEach((vehicle, idx) => {
            const vServiceIds = step4Data?.vehicleServices?.[idx.toString()] || step4Data?.serviceIds || [];
            const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || `Vehicle ${idx + 1}`;
            const vehicleContext = {
              vehicleSize: (vehicle.size ?? "medium") as VehicleSize,
              vehicleTypeId: vehicle.vehicleTypeId ?? null,
            };

            const vehicleServices = services?.filter((s) => vServiceIds.includes(s._id)) ?? [];
            vehicleServices.forEach((service) => {
              const price = getEffectiveServicePricingForVehicle(service, vehicleContext).price;
              serviceTotal += price;
              serviceBreakdownItems.push({
                vehicleLabel,
                serviceName: service.name,
                price,
                isSubscription: service.serviceType === "subscription",
              });
            });
          });

          const petFeeTotal = (step3Data?.vehicles ?? []).reduce((sum, vehicle) => {
            if (!vehicle.hasPet) return sum;
            return sum + petFeeForSize(vehicle.size ?? "medium");
          }, 0);
          const travelFeeTotal = travelQuote?.fee ?? 0;
          const orderTotal = serviceTotal + petFeeTotal + travelFeeTotal;

          const dueNow = paymentOption === "full" ? orderTotal : Math.min(depositTotal, orderTotal);
          const remainingBalance = Math.max(0, orderTotal - dueNow);

          return (
            <div className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-foreground">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px]">✓</span>
                  Order Summary
                </h3>
                {serviceBreakdownItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {item.serviceName} <span className="text-xs text-muted-foreground/60">({item.vehicleLabel})</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">${item.price.toFixed(2)}</span>
                      {item.isSubscription && <span className="text-[10px] text-muted-foreground">/mo</span>}
                    </div>
                  </div>
                ))}

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
                {paymentOption !== "full" && (
                  <div className="mt-3 space-y-1 border-t border-border/30 pt-3">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Deposit Due Today</span>
                      <span className="text-foreground">${dueNow.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Remaining Balance</span>
                      <span className="text-foreground">${remainingBalance.toFixed(2)}</span>
                    </div>
                  </div>
                )}
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
                    Remaining balance of ${remainingBalance.toFixed(2)} will be collected in person.
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
