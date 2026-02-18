"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useBookingStore } from "@/hooks/use-booking-store";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";
import AddressInput from "@/components/ui/address-input";
import { TimeSlotPicker } from "./time-slot-picker";
import { ServiceCard } from "./service-card";

interface RadarAddress {
  formattedAddress?: string;
  addressLabel?: string;
  addressComponents?: {
    street?: string;
    city?: string;
    locality?: string;
    state?: string;
    region?: string;
    postalCode?: string;
  };
  // Direct properties from Radar API response
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

// Step schemas
const step1Schema = z.object({
  scheduledDate: z.date({
    message: "A date of service is required.",
  }),
  scheduledTime: z.string().min(1, "Please select a time"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().optional(), // Make ZIP optional since not all addresses have postal codes
  locationNotes: z.string().optional(),
});

const step2Schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[\d\s()+-]+$/, "Phone number contains invalid characters"),
  email: z.string().email("Please enter a valid email"),
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
        type: z.enum(["car", "truck", "suv"]),
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

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

}

export default function AppointmentModal({
  open,
  onOpenChange,
  // preselectedServices = [],
}: AppointmentModalProps) {
  // Use Zustand store for persisted state
  const {
    currentStep,
    setCurrentStep,
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
  const { user, isLoaded, isSignedIn } = useUser();

  // Load saved data on mount if needed (Zustand persist handles this automatically, but we might want to pre-fill forms)
  // We'll trust Zustand's persist middleware for the data

  // Load saved data on mount if needed (Zustand persist handles this automatically)

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

  /* 
     Logic removed: Old localStorage fallback. 
     Zustand persist middleware handles this now.
  */

  const services = useQuery(api.services.list);
  const createUserAndAppointment = useMutation(
    api.users.createUserWithAppointment,
  );
  const createBookingCheckout = useAction(api.payments.createBookingCheckout);


  // Step forms
  // Note: step1Form is already defined above

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      name: step2Data?.name || "",
      phone: step2Data?.phone || "",
      email: step2Data?.email || "",
    },
  });

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      vehicles: (step3Data?.vehicles || [
        { year: "", make: "", model: "", color: "", licensePlate: "", type: "car", size: "small" },
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

  // Pre-fill user data if authenticated
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const currentValues = step2Form.getValues();
      if (!currentValues.name || !currentValues.email) {
        const fullName = user.fullName || "";
        const email = user.primaryEmailAddress?.emailAddress || "";
        
        step2Form.setValue("name", fullName);
        step2Form.setValue("email", email);
        
        // Also update store
        setStep2Data({
          ...step2Data,
          name: fullName,
          email: email,
          phone: step2Data?.phone || "",
        });
      }
    }
  }, [isLoaded, isSignedIn, user, step2Form, setStep2Data, step2Data]);

  // Step 5 form is no longer needed as we use Clerk components


  // Memoized address selection callback to prevent Radar reinitialization
  const handleAddressSelect = useCallback(
    (address: RadarAddress) => {
      console.log("Processing address selection:", address);

      // Store the full address data in localStorage for persistence
      localStorage.setItem("selectedAddress", JSON.stringify(address));

      // Update form fields - Radar returns data directly on the address object
      step1Form.setValue(
        "street",
        address.street || address.formattedAddress || "",
        {
          shouldValidate: true,
          shouldDirty: true,
        },
      );
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

      // Save current form data to localStorage
      const currentData = step1Form.getValues();
      console.log("Updated form data:", currentData);
      localStorage.setItem("appointmentFormData", JSON.stringify(currentData));
    },
    [step1Form],
  );

  const addVehicle = async () => {
    // Validate current vehicles before adding new one
    const isValid = await step3Form.trigger();
    if (!isValid) return;

    const currentVehicles = step3Form.getValues("vehicles") || [];
    step3Form.setValue("vehicles", [
      ...currentVehicles,
      { year: "", make: "", model: "", color: "", licensePlate: "", type: "car", size: "small" },
    ]);
  };

  const getVehicleSize = (
    vehicleType: "car" | "truck" | "suv" | undefined,
  ): "small" | "medium" | "large" => {
    switch (vehicleType) {
      case "car":
        return "small";
      case "truck":
        return "large";
      case "suv":
        return "medium";
      default:
        return "medium"; // default fallback
    }
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
        console.log("Step 1 validation result:", isValid);
        console.log("Step 1 form values:", step1Form.getValues());
        console.log("Step 1 form errors:", step1Form.formState.errors);
        if (isValid) {
          const formData = step1Form.getValues();
          setStep1Data(formData);
          // Save form data to localStorage
          localStorage.setItem("appointmentFormData", JSON.stringify(formData));
          setCurrentStep(2);
        } else {
          console.log("Step 1 validation failed");
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
          setStep3Data(step3Form.getValues());
          setCurrentStep(4);
        }
        break;
      case 4:
        isValid = await step4Form.trigger();
        if (isValid) {
          setStep4Data(step4Form.getValues());
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

  // Check if services are available
  const hasServices = services && services.length > 0;

  const onSubmit = async () => {
    // Validate that all required data is present
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

    // Check if services are available
    if (!hasServices) {
      toast.error(
        "No services are available at this time. Please contact us directly.",
      );
      return;
    }

    setIsLoading(true);
    try {
      // Determine user details (Guest vs Auth)
      const fullName = isSignedIn && user?.fullName ? user.fullName : step2Data.name;
      const email = isSignedIn && user?.primaryEmailAddress?.emailAddress 
        ? user.primaryEmailAddress.emailAddress 
        : step2Data.email;
      const phone = step2Data.phone; 

      console.log("Submitting appointment for:", email);

      // Create user (ensure syncing) and appointment
      const { appointmentId, invoiceId } = await createUserAndAppointment({
        name: fullName!,
        email: email!,
        phone: phone!,
        address: {
          street: step1Data.street,
          city: step1Data.city,
          state: step1Data.state,
          zip: step1Data.zip || "",
        },
        vehicles: step3Data.vehicles.map((vehicle) => ({
          year: parseInt(vehicle.year), // Ensure year is number
          make: vehicle.make,
          model: vehicle.model,
          size: vehicle.size,
          color: vehicle.color,
          licensePlate: vehicle.licensePlate,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceIds: (step4Data?.serviceIds || []) as any,
        scheduledDate: new Date(step1Data.scheduledDate).toISOString(),
        scheduledTime: step1Data.scheduledTime,
        locationNotes: step1Data.locationNotes,
      });

      // Create checkout session for booking (guest or auth)
      const { url } = await createBookingCheckout({
        appointmentId,
        invoiceId,
        successUrl: `${window.location.origin}/dashboard/appointments?payment=success`,
        cancelUrl: `${window.location.origin}/dashboard/appointments?payment=cancelled`,
        // Pass optional contact info to ensure user is persisted correctly
        name: fullName || undefined,
        email: email || undefined,
        phone: phone || undefined,
      });

      if (url) {
        // Clear the booking store before redirecting to Stripe
        resetBooking();
        // Clear local storage fallbacks if any remain
        if (typeof window !== "undefined") {
             localStorage.removeItem("selectedAddress");
             localStorage.removeItem("appointmentFormData");
        }
        
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create appointment",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Reset function to clear all state
  const resetModal = () => {
    resetBooking();
    // Clear saved data from localStorage (legacy/redundant but safe)
    if (typeof window !== "undefined") {
      localStorage.removeItem("selectedAddress");
      localStorage.removeItem("appointmentFormData");
    }
    step1Form.reset();
    step2Form.reset();
    step3Form.reset();
    step4Form.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      resetModal();
    }
  };

  // Show loading state while data is being fetched
  if (services === undefined) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Schedule Your Detailing
            </DialogTitle>
            <DialogDescription>Loading available services...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error state if no services are available
  if (services === null || !hasServices) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              No Services Available
            </DialogTitle>
            <DialogDescription className="text-center">
              Our services are being configured.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              No detailing services are available for booking at this time.
              Please contact us directly.
            </p>
            <div className="space-y-2">
              <p className="font-medium">Call us at:</p>
              <a
                href="tel:501-454-7140"
                className="text-accent hover:underline font-medium"
              >
                (501) 454-7140
              </a>
            </div>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Schedule Your Detailing
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 5:{" "}
            {currentStep === 1
              ? "Date & Location"
              : currentStep === 2
                ? "Personal Info"
                : currentStep === 3
                  ? "Vehicle Details"
                  : currentStep === 4
                    ? "Service Selection"
                    : "Create Account"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-all ${
                step === currentStep
                  ? "w-12 bg-accent"
                  : step < currentStep
                    ? "w-8 bg-accent/60"
                    : "w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Date & Location */}
        {currentStep === 1 && (
          <Form {...step1Form}>
            <form className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={step1Form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Date</FormLabel>
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
                              // Adjust for timezone offset to prevent day shifting
                              const userTimezoneOffset =
                                date.getTimezoneOffset() * 60000;
                              const adjustedDate = new Date(
                                date.getTime() + userTimezoneOffset,
                              );
                              field.onChange(adjustedDate);
                            }}
                            className="bg-background-50 border-gray-200"
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
                      <FormLabel>Preferred Time</FormLabel>
                      <FormControl>
                        <TimeSlotPicker 
                          date={step1Form.watch("scheduledDate")?.toISOString() ?? ""}
                          selectedTime={field.value}
                          onTimeSelect={(time) => field.onChange(time)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Service Location</h3>
                <AddressInput
                  onAddressSelect={handleAddressSelect}
                  label="Service Address"
                  placeholder="Search for your service address"
                />
                {/* Hidden form fields for validation */}
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
                      <FormLabel>Location Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Any special instructions for finding the location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        type="tel" 
                        placeholder="123-456-7890"
                        onChange={(e) => {
                           // Allow user to type, validation is handled by schema on submit
                           field.onChange(e);
                        }}
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
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} type="email" />
                    </FormControl>
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
                  <h3 className="text-sm font-medium">Vehicle Details</h3>
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

                {step3Form.watch("vehicles")?.map((_, index) => (
                  <Card key={index} className="relative">
                     <div className="absolute top-2 right-2">
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeVehicle(index)}
                          >
                            <span className="sr-only">Remove</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          </Button>
                        )}
                     </div>
                      <CardContent className="pt-6 space-y-4">
                        <FormField
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          control={step3Form.control as any}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          name={`vehicles.${index}.type` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle Type</FormLabel>
                              <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                const size = getVehicleSize(value as "car" | "truck" | "suv");
                                step3Form.setValue(`vehicles.${index}.size`, size);
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select vehicle type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="car">Car</SelectItem>
                                <SelectItem value="truck">Truck</SelectItem>
                                <SelectItem value="suv">SUV</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          control={step3Form.control as any}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          name={`vehicles.${index}.year` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Year</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  type="number"
                                  placeholder="YYYY"
                                  min={1900}
                                  max={new Date().getFullYear() + 1}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          control={step3Form.control as any}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          name={`vehicles.${index}.make` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Make</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          control={step3Form.control as any}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          name={`vehicles.${index}.model` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Model</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          control={step3Form.control as any}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          name={`vehicles.${index}.color` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Color (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        control={step3Form.control as any}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        name={`vehicles.${index}.licensePlate` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Plate (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
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
                <h3 className="text-sm font-medium">Select Services</h3>
                
                <FormField
                  control={step4Form.control}
                  name="serviceIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="space-y-8">
                          
                          {/* Packages Section (Single Select) */}
                          <div className="space-y-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">ONE REQUIRED</span>
                              Packages
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {services
                                ?.filter(s => s.isActive && (s.serviceType === "standard" || !s.serviceType))
                                .map(service => {
                                  // Fix: Access vehicleType from the first vehicle in the array
                                  const vehicle = step3Data?.vehicles?.[0];
                                  const vehicleType = vehicle?.type;
                                  const vehicleSize = vehicleType === "car" ? "small" : vehicleType === "suv" ? "medium" : "large";
                                  const isSelected = field.value?.includes(service._id) || false;

                                  return (
                                    <ServiceCard
                                      key={service._id}
                                      service={service}
                                      vehicleSize={vehicleSize}
                                      isSelected={isSelected}
                                      onSelect={() => {
                                        const current = field.value || [];
                                        // Remove other standard services, keep addons/subs
                                        const otherServices = current.filter(id => {
                                          const s = services.find(s => s._id === id);
                                          return s && s.serviceType !== "standard" && s.serviceType; // Keep non-standards
                                        });
                                        // If clicking same, keep it (enforce at least one? logic handles in schema) 
                                        // actually user said "select one", so radio behavior usually means you can't deselect the only one by clicking it, but let's allow switching.
                                        // Simply set the value to [...others, newId]
                                        field.onChange([...otherServices, service._id]);
                                      }}
                                    />
                                  );
                                })}
                            </div>
                          </div>

                          {/* Add-ons Section (Multi Select) */}
                          <div className="space-y-3">
                            <h4 className="font-medium text-muted-foreground">Add-ons (Optional)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {services
                                ?.filter(s => s.isActive && s.serviceType === "addon")
                                .map(service => {
                                  // Fix: Access vehicleType from the first vehicle in the array
                                  const vehicle = step3Data?.vehicles?.[0];
                                  const vehicleType = vehicle?.type;
                                  const vehicleSize = vehicleType === "car" ? "small" : vehicleType === "suv" ? "medium" : "large";


                                  return (
                                    <ServiceCard
                                      key={service._id}
                                      service={service}
                                      vehicleSize={vehicleSize}
                                      isSelected={step4Data?.serviceIds.includes(service._id) || false}
                                      onSelect={() => {
                                        const currentIds = step4Data?.serviceIds || [];
                                        const isSelected = currentIds.includes(service._id);
                                        let newIds;
                                        if (isSelected) {
                                          newIds = currentIds.filter((id) => id !== service._id);
                                        } else {
                                          newIds = [...currentIds, service._id];
                                        }
                                        setStep4Data({ serviceIds: newIds });
                                      }}
                                    />
                                  );
                                })}
                                {services?.filter(s => s.isActive && s.serviceType === "addon").length === 0 && (
                                  <p className="text-sm text-muted-foreground italic col-span-full">No add-ons available.</p>
                                )}
                            </div>
                          </div>

                          {/* Subscriptions Section (Single Select) */}
                          <div className="space-y-3">
                            <h4 className="font-medium text-muted-foreground">Subscriptions (Optional)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {services
                                ?.filter(s => s.isActive && s.serviceType === "subscription")
                                .map(service => {
                                  // Fix: Access vehicleType from the first vehicle in the array
                                  const vehicle = step3Data?.vehicles?.[0];
                                  const vehicleType = vehicle?.type;
                                  const vehicleSize = vehicleType === "car" ? "small" : vehicleType === "suv" ? "medium" : "large";
                                  const isSelected = field.value?.includes(service._id) || false;

                                  return (
                                    <ServiceCard
                                      key={service._id}
                                      service={service}
                                      vehicleSize={vehicleSize}
                                      isSelected={isSelected}
                                      onSelect={(selected) => {
                                        const current = field.value || [];
                                        const otherServices = current.filter(id => {
                                          const s = services.find(s => s._id === id);
                                          return s && s.serviceType !== "subscription";
                                        });
                                        
                                        if (selected) {
                                           // Select this one, remove other subscriptions
                                           field.onChange([...otherServices, service._id]);
                                        } else {
                                           // Deselect allowed for subscriptions
                                           field.onChange(otherServices);
                                        }
                                      }}
                                    />
                                  );
                                })}
                                {services?.filter(s => s.isActive && s.serviceType === "subscription").length === 0 && (
                                  <p className="text-sm text-muted-foreground italic col-span-full">No subscriptions available.</p>
                                )}
                            </div>
                          </div>

                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormMessage />
              </div>
            </form>
          </Form>
        )}

        {/* Step 5: Create Account & Deposit */}

        {currentStep === 5 && (
          <div className="space-y-6">
             <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
               <h3 className="font-semibold mb-3 flex items-center gap-2">
                 <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">✓</span>
                 Order Summary
               </h3>
               {services
                 ?.filter((s) => step4Data?.serviceIds?.includes(s._id))
                 .map((service) => {
                   const serviceId = service._id;
                   const isSubscription = service.serviceType === "subscription";
                   
                   // Find vehicle size based on step 3 data
                   // Create a safeguard for empty step3Data although logic prevents reaching step 5 without it
                   if (!step3Data?.vehicles?.[0]) return null;
                   
                   const vehicleType = step3Data.vehicleType;
                   const vehicleSize =
                     vehicleType === "car"
                       ? "small"
                       : vehicleType === "suv"
                         ? "medium"
                         : "large";

                   const price =
                     vehicleSize === "small"
                       ? service.basePriceSmall
                       : vehicleSize === "medium"
                         ? service.basePriceMedium
                         : service.basePriceLarge;
                         
                   return (
                     <div key={serviceId} className="flex justify-between text-sm mb-2">
                       <span className="text-muted-foreground">{service.name}</span>
                       <div className="flex items-center gap-1">
                          <span className="font-medium">${price?.toFixed(2)}</span>
                          {isSubscription && <span className="text-[10px] text-muted-foreground">/mo</span>}
                       </div>
                     </div>
                   );
                 })}

                 
                 <div className="border-t border-dashed my-3" />
                 
                 <div className="flex justify-between items-end">
                   <div>
                     <span className="font-bold text-base block">Deposit Due Now</span>
                     <span className="text-xs text-muted-foreground">Secure payment via Stripe</span>
                   </div>
                   <span className="font-bold text-xl text-primary">$50.00</span>
                 </div>
             </div>

             <div className="mt-6">
                {!isSignedIn ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-md text-sm mb-4 border border-blue-200 dark:border-blue-800 text-center">
                       You will receive an account setup link via email after payment.
                    </div>
                ) : (
                   <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3 rounded-md text-sm mb-4 flex items-center gap-2 border border-green-200 dark:border-green-800">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Logged in as {user?.primaryEmailAddress?.emailAddress}
                   </div>
                )}
             </div>
          </div>
        )}



      {/* Navigation Buttons */}
        <div className="flex gap-4 pt-4 border-t mt-4">
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
          {currentStep < 5 ? (
            <Button type="button" onClick={nextStep} className="flex-1">
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  Pay Deposit & Confirm
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
