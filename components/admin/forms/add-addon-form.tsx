"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  VehiclePricingEditor,
  type VehiclePriceFormRow,
} from "@/components/forms/admin/vehicle-pricing-editor";

const formSchema = z
  .object({
    name: z.string().min(1, "Add-on name is required"),
    description: z.string().min(1, "Description is required"),
    duration: z.number().min(0, "Duration must be non-negative"),
    vehiclePrices: z.array(z.object({
      vehicleTypeId: z.string().optional(),
      vehicleTypeName: z.string().optional(),
      price: z.number().min(0, "Price must be non-negative"),
      duration: z.number().min(0, "Duration must be non-negative"),
      isAvailable: z.boolean(),
    })),
    features: z.array(z.string()).optional(),
    icon: z.string().optional(),
  })
  .refine(
    (data) => {
      return data.vehiclePrices.some((row) => row.isAvailable && row.price > 0);
    },
    {
      message: "At least one vehicle type price must be available and greater than $0.",
      path: ["vehiclePrices"],
    },
  );

type FormData = z.infer<typeof formSchema>;

interface AddAddonFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAddonForm({ open, onOpenChange }: AddAddonFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [newFeature, setNewFeature] = useState("");

  const createService = useMutation(api.services.create);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      duration: 0,
      vehiclePrices: [] as VehiclePriceFormRow[],
      features: [],
      icon: "",
    },
  });

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

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await createService({
        name: data.name,
        description: data.description,
        basePriceSmall: data.vehiclePrices[0]?.price ?? 0,
        duration: data.duration,
        serviceType: "addon",
        vehiclePrices: data.vehiclePrices.map((row) => ({
          vehicleTypeId: row.vehicleTypeId as Id<"vehicleTypes"> | undefined,
          vehicleTypeName: row.vehicleTypeName,
          price: row.price,
          duration: row.duration,
          isAvailable: row.isAvailable,
        })),
        includedServiceIds: [],
        features: data.features,
        icon: data.icon,
      });

      toast.success("Add-on created successfully");
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create add-on");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Add-on</DialogTitle>
          <DialogDescription>
            Create a new add-on service with single price or price range
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
                    <FormLabel>Add-on Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., 1-Step Paint Correction"
                      />
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
                        placeholder="Describe what this add-on includes"
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
                      <Input {...field} placeholder="✨" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Extra calendar time (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="5"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10) || 0)
                      }
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <VehiclePricingEditor form={form} defaultDuration={form.watch("duration")} />

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

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Add-on"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
