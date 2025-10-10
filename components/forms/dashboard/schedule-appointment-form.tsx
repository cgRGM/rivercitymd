"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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

const formSchema = z.object({
  userId: z.string().min(1, "Please select a user"),
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

interface AddAppointmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleAppointmentForm({
  open,
  onOpenChange,
}: AddAppointmentFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const clients = useQuery(api.users.list);
  const services = useQuery(api.services.list);
  const createAppointment = useMutation(api.appointments.create);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "",
      vehicleIds: [],
      serviceIds: [],
      scheduledDate: "",
      scheduledTime: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      locationNotes: "",
      notes: "",
    },
  });

  const selectedUserId = form.watch("userId");
  const userVehicles = useQuery(
    api.vehicles.getByUser,
    selectedUserId ? { userId: selectedUserId as Id<"users"> } : "skip",
  );

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await createAppointment({
        userId: data.userId as Id<"users">,
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

      toast.success("Appointment created successfully");
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create appointment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Appointment</DialogTitle>
          <DialogDescription>
            Schedule a new appointment for a customer
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* User Selection */}
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients?.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.name || "Unnamed"} - {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vehicle Selection */}
            {selectedUserId && userVehicles && (
              <FormField
                control={form.control}
                name="vehicleIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Vehicles</FormLabel>
                    <div className="space-y-2">
                      {userVehicles.map((vehicle: (typeof userVehicles)[0]) => (
                        <FormField
                          key={vehicle._id}
                          control={form.control}
                          name="vehicleIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
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
                              <FormLabel className="text-sm font-normal">
                                {vehicle.year} {vehicle.make} {vehicle.model}
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
            )}

            {/* Service Selection */}
            <FormField
              control={form.control}
              name="serviceIds"
              render={() => (
                <FormItem>
                  <FormLabel>Services</FormLabel>
                  <div className="space-y-2">
                    {services?.map((service) => (
                      <FormField
                        key={service._id}
                        control={form.control}
                        name="serviceIds"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
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
                            <FormLabel className="text-sm font-normal">
                              {service.name} - ${service.basePrice}
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

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
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
                    <FormLabel>Time</FormLabel>
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
              <h3 className="text-sm font-medium">Location</h3>
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Any additional notes about this appointment"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
