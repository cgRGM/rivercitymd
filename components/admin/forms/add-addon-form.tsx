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

const formSchema = z
  .object({
    name: z.string().min(1, "Add-on name is required"),
    description: z.string().min(1, "Description is required"),
    pricingType: z.enum(["single", "range"]),
    singlePrice: z.number().min(0, "Price must be non-negative").optional(),
    priceMin: z.number().min(0, "Price must be non-negative").optional(),
    priceMax: z.number().min(0, "Price must be non-negative").optional(),
    features: z.array(z.string()).optional(),
    icon: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.pricingType === "single") {
        return data.singlePrice !== undefined && data.singlePrice >= 0;
      } else if (data.pricingType === "range") {
        return (
          data.priceMin !== undefined &&
          data.priceMax !== undefined &&
          data.priceMin >= 0 &&
          data.priceMax >= 0 &&
          data.priceMin <= data.priceMax
        );
      }
      return false;
    },
    {
      message: "Please provide valid pricing information",
      path: ["pricingType"],
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
      pricingType: "single",
      singlePrice: 0,
      priceMin: undefined,
      priceMax: undefined,
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
      let basePriceSmall, basePriceMedium, basePriceLarge;

      if (data.pricingType === "single") {
        basePriceSmall = data.singlePrice;
      } else if (data.pricingType === "range") {
        basePriceSmall = data.priceMin;
        basePriceMedium = data.priceMax;
      }

      await createService({
        name: data.name,
        description: data.description,
        basePriceSmall,
        basePriceMedium,
        basePriceLarge,
        duration: 0, // Add-ons don't have duration
        serviceType: "addon",
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

            {/* Pricing Type Selection */}
            <FormField
              control={form.control}
              name="pricingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing Type</FormLabel>
                  <FormControl>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="single"
                          checked={field.value === "single"}
                          onChange={() => field.onChange("single")}
                        />
                        Single Price
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="range"
                          checked={field.value === "range"}
                          onChange={() => field.onChange("range")}
                        />
                        Price Range
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pricing Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Pricing</h3>
              {form.watch("pricingType") === "single" ? (
                <FormField
                  control={form.control}
                  name="singlePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
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
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priceMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Price</FormLabel>
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
                    name="priceMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Price</FormLabel>
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
              )}
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
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeFeature(index)}
                    />
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
