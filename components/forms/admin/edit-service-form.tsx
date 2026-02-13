"use client";

import React, { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  basePriceSmall: z.number().min(0, "Price must be non-negative"),
  basePriceMedium: z.number().min(0, "Price must be non-negative"),
  basePriceLarge: z.number().min(0, "Price must be non-negative"),
  features: z.array(z.string()).optional(),
  icon: z.string().optional(),
  includedServiceIds: z.array(z.string()).optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface EditServiceFormProps {
  serviceId: Id<"services"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditServiceForm({
  serviceId,
  open,
  onOpenChange,
}: EditServiceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [newFeature, setNewFeature] = useState("");

  const allServices = useQuery(api.services.list);
  const service = useQuery(
    api.services.getById,
    serviceId ? { serviceId } : "skip",
  );
  const updateService = useMutation(api.services.update);
  const updateStripeProduct = useMutation(api.services.updateStripeProduct);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      duration: 60,
      basePriceSmall: 0,
      basePriceMedium: 0,
      basePriceLarge: 0,
      features: [],
      icon: "",
      includedServiceIds: [],
      isActive: true,
    },
  });

  // Update form when service data loads
  React.useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        description: service.description,
        duration: service.duration,
        basePriceSmall: service.basePriceSmall || 0,
        basePriceMedium: service.basePriceMedium || 0,
        basePriceLarge: service.basePriceLarge || 0,
        features: service.features || [],
        icon: service.icon || "",
        includedServiceIds: service.includedServiceIds?.map((id) => id) || [],
        isActive: service.isActive,
      });
    }
  }, [service, form]);

  const onSubmit = async (data: FormData) => {
    if (!serviceId) return;

    setIsLoading(true);
    try {
      await updateService({
        serviceId,
        name: data.name,
        description: data.description,
        basePriceSmall: data.basePriceSmall,
        basePriceMedium: data.basePriceMedium,
        basePriceLarge: data.basePriceLarge,
        duration: data.duration,
        serviceType: service?.serviceType ?? "standard",
        includedServiceIds: data.includedServiceIds as Id<"services">[],
        features: data.features,
        icon: data.icon,
        isActive: data.isActive,
      });

      // Update Stripe product if it exists
      if (service?.stripeProductId) {
        await updateStripeProduct({ serviceId });
      }

      toast.success("Service updated successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update service");
    } finally {
      setIsLoading(false);
    }
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      const currentFeatures = form.getValues("features") || [];
      form.setValue("features", [...currentFeatures, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    const currentFeatures = form.getValues("features") || [];
    form.setValue(
      "features",
      currentFeatures.filter((_, i) => i !== index),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
          <DialogDescription>
            Update service details and pricing
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Full Detail" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this service includes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon (Emoji)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="🚗" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Size-Based Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Pricing by Vehicle Size</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="basePriceSmall"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Small Vehicles</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="basePriceMedium"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medium Vehicles</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="basePriceLarge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Large Vehicles</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <FormLabel>Features</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Add a feature..."
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addFeature())
                  }
                />
                <Button type="button" onClick={addFeature} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.watch("features")?.map((feature, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {feature}
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="inline-flex items-center"
                      aria-label={`Remove feature ${feature}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Included Services */}
            <FormField
              control={form.control}
              name="includedServiceIds"
              render={() => (
                <FormItem>
                  <FormLabel>Included Services (Optional)</FormLabel>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {allServices?.map((svc) => (
                      <FormField
                        key={svc._id}
                        control={form.control}
                        name="includedServiceIds"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value?.includes(svc._id)}
                                onChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked.target.checked) {
                                    field.onChange([...current, svc._id]);
                                  } else {
                                    field.onChange(
                                      current.filter((id) => id !== svc._id),
                                    );
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                              {svc.name}
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

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Service"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
