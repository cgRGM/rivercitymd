"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";
import AddressInput from "@/components/ui/address-input";

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
  scheduledDate: z.string().min(1, "Please select a date"),
  scheduledTime: z.string().min(1, "Please select a time"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().optional(), // Make ZIP optional since not all addresses have postal codes
  locationNotes: z.string().optional(),
});

const step2Schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
});

const step3Schema = z.object({
  vehicleType: z.enum(["car", "truck", "suv"]).refine((val) => val, {
    message: "Please select a vehicle type",
  }),
  vehicles: z
    .array(
      z.object({
        year: z.string().min(1, "Year is required"),
        make: z.string().min(1, "Make is required"),
        model: z.string().min(1, "Model is required"),
        color: z.string().optional(),
        licensePlate: z.string().optional(),
        size: z.enum(["small", "medium", "large"]).optional(),
      }),
    )
    .min(1, "Please add at least one vehicle"),
});

const step4Schema = z.object({
  serviceIds: z.array(z.string()).min(1, "Please select at least one service"),
});

const step5Schema = z
  .object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;
type Step5Data = z.infer<typeof step5Schema>;

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedServices?: string[];
  onSuccess?: () => void;
}

export default function AppointmentModal({
  open,
  onOpenChange,
  preselectedServices = [],
  onSuccess,
}: AppointmentModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form states - initialize with saved data if available
  const [step1Data, setStep1Data] = useState<Partial<Step1Data>>(() => {
    // Load saved form data from localStorage
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem("appointmentFormData");
      if (savedData) {
        try {
          return JSON.parse(savedData);
        } catch (error) {
          console.warn("Error parsing saved form data:", error);
        }
      }

      // Fallback: load saved address from localStorage and merge with any existing data
      const savedAddress = localStorage.getItem("selectedAddress");
      if (savedAddress) {
        try {
          const address = JSON.parse(savedAddress);
          if (address.addressComponents) {
            const components = address.addressComponents;
            return {
              street: components.street || address.formattedAddress || "",
              city: components.city || components.locality || "",
              state: components.state || components.region || "",
              zip: components.postalCode || "",
            };
          }
        } catch (error) {
          console.warn("Error parsing saved address:", error);
        }
      }
    }
    return {};
  });
  const [step2Data, setStep2Data] = useState<Partial<Step2Data>>({});
  const [step3Data, setStep3Data] = useState<Partial<Step3Data>>({
    vehicles: [{ year: "", make: "", model: "", color: "", licensePlate: "" }],
  });
  const [step4Data, setStep4Data] = useState<Partial<Step4Data>>({
    serviceIds: preselectedServices,
  });
  const [step5Data, setStep5Data] = useState<Partial<Step5Data>>({});

  const services = useQuery(api.services.list);
  const createUserAndAppointment = useMutation(
    api.users.createUserWithAppointment,
  );

  // Step forms
  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      scheduledDate: step1Data.scheduledDate || "",
      scheduledTime: step1Data.scheduledTime || "",
      street: step1Data.street || "",
      city: step1Data.city || "",
      state: step1Data.state || "",
      zip: step1Data.zip || "",
      locationNotes: step1Data.locationNotes || "",
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      name: step2Data.name || "",
      phone: step2Data.phone || "",
    },
  });

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      vehicleType: step3Data.vehicleType || undefined,
      vehicles: step3Data.vehicles || [
        { year: "", make: "", model: "", color: "", licensePlate: "" },
      ],
    },
  });

  const step4Form = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      serviceIds: step4Data.serviceIds || [],
    },
  });

  const step5Form = useForm<Step5Data>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      email: step5Data.email || "",
      password: step5Data.password || "",
      confirmPassword: step5Data.confirmPassword || "",
    },
  });

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

  const addVehicle = () => {
    const vehicleType = step3Form.getValues("vehicleType");
    const size = getVehicleSize(vehicleType);
    const currentVehicles = step3Form.getValues("vehicles") || [];
    step3Form.setValue("vehicles", [
      ...currentVehicles,
      { year: "", make: "", model: "", color: "", licensePlate: "", size },
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
    const isValid = await step5Form.trigger();
    if (!isValid) return;

    // Validate that all required data is present
    if (!step2Data?.phone) {
      toast.error("Please go back and enter your phone number.");
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
      const finalData = {
        ...step1Data,
        ...step2Data,
        ...step3Data,
        ...step4Data,
        ...step5Form.getValues(),
      };

      await createUserAndAppointment({
        name: finalData.name!,
        email: finalData.email!,
        phone: finalData.phone!,
        password: finalData.password!,
        address: {
          street: finalData.street!,
          city: finalData.city!,
          state: finalData.state!,
          zip: finalData.zip!,
        },
        vehicles: finalData.vehicles!.map((vehicle) => ({
          ...vehicle,
          year: parseInt(vehicle.year),
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceIds: finalData.serviceIds! as any, // TODO: Fix service ID mapping
        scheduledDate: finalData.scheduledDate!,
        scheduledTime: finalData.scheduledTime!,
        locationNotes: finalData.locationNotes,
      });

      toast.success("Account created! Welcome to River City Mobile Detailing!");
      onOpenChange(false);
      onSuccess?.();
      router.push("/dashboard");
    } catch (error) {
      // Provide more user-friendly error messages
      let errorMessage = "Failed to create account";
      if (error instanceof Error) {
        if (error.message.includes("phone")) {
          errorMessage = "Please enter a valid phone number";
        } else if (error.message.includes("email")) {
          errorMessage = "Please enter a valid email address";
        } else if (error.message.includes("already exists")) {
          errorMessage = "An account with this email already exists";
        } else {
          errorMessage = error.message;
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setCurrentStep(1);
    setStep1Data({});
    setStep2Data({});
    setStep3Data({
      vehicles: [
        { year: "", make: "", model: "", color: "", licensePlate: "" },
      ],
    });
    setStep4Data({ serviceIds: preselectedServices });
    setStep5Data({});
    // Clear saved data from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("selectedAddress");
      localStorage.removeItem("appointmentFormData");
    }
    step1Form.reset();
    step2Form.reset();
    step3Form.reset();
    step4Form.reset();
    step5Form.reset();
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
                        <Input type="date" {...field} />
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
                      <Input
                        type="time"
                        {...field}
                        placeholder="Select preferred time"
                      />
                      <FormMessage />
                      <p className="text-sm text-muted-foreground mt-1">
                        We&apos;ll contact you to confirm availability and
                        schedule your appointment
                      </p>
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                      <Input {...field} />
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
                      <Input {...field} />
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
              <FormField
                control={step3Form.control}
                name="vehicleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Update size for all existing vehicles
                        const size = getVehicleSize(
                          value as "car" | "truck" | "suv",
                        );
                        const currentVehicles =
                          step3Form.getValues("vehicles") || [];
                        step3Form.setValue(
                          "vehicles",
                          currentVehicles.map((vehicle) => ({
                            ...vehicle,
                            size,
                          })),
                        );
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

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Vehicle Details</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVehicle}
                  >
                    Add Another Vehicle
                  </Button>
                </div>

                {step3Form.watch("vehicles")?.map((_, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-medium">Vehicle {index + 1}</h4>
                        {step3Form.watch("vehicles")!.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVehicle(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={step3Form.control}
                          name={`vehicles.${index}.year`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Year</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={step3Form.control}
                          name={`vehicles.${index}.make`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Make</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={step3Form.control}
                          name={`vehicles.${index}.model`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Model</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={step3Form.control}
                          name={`vehicles.${index}.color`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Color (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={step3Form.control}
                        name={`vehicles.${index}.licensePlate`}
                        render={({ field }) => (
                          <FormItem className="mt-4">
                            <FormLabel>License Plate (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                <div className="grid gap-3">
                  {services
                    ?.filter((service) => service.isActive)
                    .map((service) => {
                      // Get pricing based on the first vehicle's size
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
                        <FormField
                          key={service._id}
                          control={step4Form.control}
                          name="serviceIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(service._id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, service._id]);
                                    } else {
                                      field.onChange(
                                        current.filter(
                                          (id) => id !== service._id,
                                        ),
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="flex-1">
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  <div className="font-medium">
                                    {service.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {service.description} • $
                                    {price?.toFixed(2) || "N/A"}
                                  </div>
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      );
                    })}
                </div>
                <FormMessage />
              </div>
            </form>
          </Form>
        )}

        {/* Step 5: Create Account */}
        {currentStep === 5 && (
          <Form {...step5Form}>
            <form className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Create Your Account</h3>
                <FormField
                  control={step5Form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step5Form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step5Form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 pt-4">
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
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
