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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";

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

export function AddAppointmentForm({
  open,
  onOpenChange,
}: AddAppointmentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    year: "",
    make: "",
    model: "",
    color: "",
    size: "medium" as "small" | "medium" | "large",
    licensePlate: "",
    notes: "",
  });

  const clients = useQuery(api.users.list);
  const services = useQuery(api.services.list);
  const createAppointment = useMutation(api.appointments.create);
  const createVehicle = useMutation(api.vehicles.create);

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

  const resetVehicleForm = () => {
    setNewVehicle({
      year: "",
      make: "",
      model: "",
      color: "",
      size: "medium",
      licensePlate: "",
      notes: "",
    });
  };

  const handleCustomerChange = (userId: string) => {
    form.setValue("userId", userId, { shouldValidate: true });
    form.setValue("vehicleIds", [], { shouldValidate: true });
    resetVehicleForm();

    const selectedClient = clients?.find((client) => client._id === userId);
    if (selectedClient?.address) {
      form.setValue("street", selectedClient.address.street ?? "");
      form.setValue("city", selectedClient.address.city ?? "");
      form.setValue("state", selectedClient.address.state ?? "");
      form.setValue("zip", selectedClient.address.zip ?? "");
    }
  };

  const handleCreateVehicle = async () => {
    if (!selectedUserId) {
      toast.error("Select a customer first");
      return;
    }

    if (!newVehicle.year || !newVehicle.make.trim() || !newVehicle.model.trim()) {
      toast.error("Vehicle year, make, and model are required");
      return;
    }

    setIsCreatingVehicle(true);
    try {
      const vehicleId = await createVehicle({
        userId: selectedUserId as Id<"users">,
        year: Number(newVehicle.year),
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        size: newVehicle.size,
        color: newVehicle.color.trim() || undefined,
        licensePlate: newVehicle.licensePlate.trim() || undefined,
        notes: newVehicle.notes.trim() || undefined,
      });

      const currentVehicleIds = form.getValues("vehicleIds");
      form.setValue("vehicleIds", [...currentVehicleIds, vehicleId], {
        shouldValidate: true,
      });
      resetVehicleForm();
      toast.success("Vehicle added for customer");
    } catch {
      toast.error("Failed to create vehicle");
    } finally {
      setIsCreatingVehicle(false);
    }
  };

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
            Schedule a new appointment for a client
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
                  <Select onValueChange={handleCustomerChange} value={field.value}>
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
                    <div className="space-y-4">
                      {userVehicles.length > 0 ? (
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
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          This customer does not have any vehicles yet. Add one below to continue.
                        </div>
                      )}

                      <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium">Add vehicle for this customer</p>
                            <p className="text-sm text-muted-foreground">
                              New vehicles are saved immediately and can be selected for this appointment.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="appointment-vehicle-year">Year</Label>
                            <Input
                              id="appointment-vehicle-year"
                              type="number"
                              value={newVehicle.year}
                              onChange={(event) =>
                                setNewVehicle((current) => ({
                                  ...current,
                                  year: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="appointment-vehicle-make">Make</Label>
                            <Input
                              id="appointment-vehicle-make"
                              value={newVehicle.make}
                              onChange={(event) =>
                                setNewVehicle((current) => ({
                                  ...current,
                                  make: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="appointment-vehicle-model">Model</Label>
                            <Input
                              id="appointment-vehicle-model"
                              value={newVehicle.model}
                              onChange={(event) =>
                                setNewVehicle((current) => ({
                                  ...current,
                                  model: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="appointment-vehicle-color">Color</Label>
                            <Input
                              id="appointment-vehicle-color"
                              value={newVehicle.color}
                              onChange={(event) =>
                                setNewVehicle((current) => ({
                                  ...current,
                                  color: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="appointment-vehicle-size">Vehicle size</Label>
                            <Select
                              value={newVehicle.size}
                              onValueChange={(value) =>
                                setNewVehicle((current) => ({
                                  ...current,
                                  size: value as "small" | "medium" | "large",
                                }))
                              }
                            >
                              <SelectTrigger id="appointment-vehicle-size">
                                <SelectValue placeholder="Select vehicle size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="small">Small</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="large">Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="appointment-vehicle-license">License plate</Label>
                            <Input
                              id="appointment-vehicle-license"
                              value={newVehicle.licensePlate}
                              onChange={(event) =>
                                setNewVehicle((current) => ({
                                  ...current,
                                  licensePlate: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="appointment-vehicle-notes">Vehicle notes</Label>
                          <Textarea
                            id="appointment-vehicle-notes"
                            value={newVehicle.notes}
                            onChange={(event) =>
                              setNewVehicle((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder="Optional notes about this vehicle"
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCreateVehicle}
                            disabled={isCreatingVehicle}
                          >
                            {isCreatingVehicle ? "Saving vehicle..." : "Save Vehicle"}
                          </Button>
                        </div>
                      </div>
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
                    {services
                      ?.filter((service) => service.isActive)
                      .map((service) => (
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
