import React, { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  vehicleIds: z.array(z.string()).min(1, "Please select at least one vehicle"),
  serviceIds: z.array(z.string()).min(1, "Please select at least one service"),
  scheduledDate: z.string().min(1, "Please select a date"),
  scheduledTime: z.string().min(1, "Please select a time"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  locationNotes: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DashboardAppointmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DashboardAppointmentForm({
  open,
  onOpenChange,
}: DashboardAppointmentFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser);
  const userVehicles = useQuery(api.vehicles.getMyVehicles);
  const services = useQuery(api.services.list);
  const createAppointment = useMutation(api.appointments.create);
  const createStripeInvoice = useAction(api.appointments.createStripeInvoice);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleIds: [],
      serviceIds: [],
      scheduledDate: "",
      scheduledTime: "",
      street: currentUser?.address?.street || "",
      city: currentUser?.address?.city || "",
      state: currentUser?.address?.state || "",
      zip: currentUser?.address?.zip || "",
      locationNotes: "",
      notes: "",
    },
  });

  // Update form defaults when user data loads
  React.useEffect(() => {
    if (currentUser?.address) {
      form.setValue("street", currentUser.address.street);
      form.setValue("city", currentUser.address.city);
      form.setValue("state", currentUser.address.state);
      form.setValue("zip", currentUser.address.zip);
    }
  }, [currentUser, form]);

  const onSubmit = async (data: FormData) => {
    if (!currentUser || !userVehicles || !services) return;

    setIsLoading(true);
    try {
      // Create the appointment first
      const appointmentId = await createAppointment({
        userId: currentUser._id,
        vehicleIds: data.vehicleIds as Id<"vehicles">[],
        serviceIds: data.serviceIds as Id<"services">[],
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        street: data.street,
        city: data.city,
        state: data.state,
        zip: data.zip,
        locationNotes: data.locationNotes,
        notes: data.notes,
      });

      // Get the selected services and vehicles data
      const selectedServices = services.filter((service) =>
        data.serviceIds.includes(service._id),
      );
      const selectedVehicles = userVehicles.filter((vehicle) =>
        data.vehicleIds.includes(vehicle._id),
      );

      // Calculate total price
      const vehicleSize = selectedVehicles[0]?.size || "medium";
      const totalPrice =
        selectedServices.reduce((sum, service) => {
          let price = service.basePriceMedium || service.basePrice || 0;
          if (vehicleSize === "small") {
            price =
              service.basePriceSmall ||
              service.basePriceMedium ||
              service.basePrice ||
              0;
          } else if (vehicleSize === "large") {
            price =
              service.basePriceLarge ||
              service.basePriceMedium ||
              service.basePrice ||
              0;
          }
          return sum + price;
        }, 0) * selectedVehicles.length;

      // Create Stripe invoice
      await createStripeInvoice({
        appointmentId,
        userId: currentUser._id,
        services: selectedServices.map((s) => ({
          _id: s._id,
          stripePriceIds: s.stripePriceIds || [],
          basePriceSmall: s.basePriceSmall,
          basePriceMedium: s.basePriceMedium,
          basePriceLarge: s.basePriceLarge,
          name: s.name,
        })),
        vehicles: selectedVehicles.map((v) => ({ size: v.size })),
        totalPrice,
        scheduledDate: data.scheduledDate,
      });

      toast.success("Appointment scheduled successfully!");
      onOpenChange(false);
      form.reset();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule New Appointment</DialogTitle>
          <DialogDescription>
            Select your vehicles, services, and preferred date/time
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Vehicles Selection */}
            <FormField
              control={form.control}
              name="vehicleIds"
              render={() => (
                <FormItem>
                  <FormLabel>Select Vehicles</FormLabel>
                  <div className="space-y-2">
                    {userVehicles?.map((vehicle) => (
                      <FormField
                        key={vehicle._id}
                        control={form.control}
                        name="vehicleIds"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(vehicle._id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, vehicle._id]);
                                  } else {
                                    field.onChange(
                                      current.filter(
                                        (id) => id !== vehicle._id,
                                      ),
                                    );
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                              {vehicle.color && ` (${vehicle.color})`}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Services Selection */}
            <FormField
              control={form.control}
              name="serviceIds"
              render={() => (
                <FormItem>
                  <FormLabel>Select Services</FormLabel>
                  <div className="space-y-2">
                    {services?.map((service) => (
                      <FormField
                        key={service._id}
                        control={form.control}
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
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              <div className="font-medium">{service.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {service.description} • ${service.basePrice}
                              </div>
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
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
                control={form.control}
                name="scheduledTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Service Location</h3>
              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={5} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Any special requests or notes for your appointment"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Scheduling..." : "Schedule Appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
