"use client";

import { useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
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
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.string().optional(),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  basePriceSmall: z.number().min(0, "Price must be non-negative"),
  basePriceMedium: z.number().min(0, "Price must be non-negative"),
  basePriceLarge: z.number().min(0, "Price must be non-negative"),
  features: z.array(z.string()).optional(),
  icon: z.string().optional(),
  includedServiceIds: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addOnMode?: boolean;
  defaultCategoryId?: string;
}

export function AddServiceForm({
  open,
  onOpenChange,
  addOnMode = false,
  defaultCategoryId,
}: AddServiceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [newFeature, setNewFeature] = useState("");

  const categories = useQuery(api.services.listCategories);
  const allServices = useQuery(api.services.list);
  const createService = useMutation(api.services.create);

  // Use provided default category or auto-select based on mode
  const autoSelectedCategoryId = categories?.find((cat) =>
    addOnMode
      ? cat.name.toLowerCase().includes("add")
      : cat.name.toLowerCase().includes("standard"),
  )?._id;
  const finalDefaultCategoryId = defaultCategoryId || autoSelectedCategoryId;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: finalDefaultCategoryId,
      duration: 60,
      basePriceSmall: 0,
      basePriceMedium: 0,
      basePriceLarge: 0,
      features: [],
      icon: "",
      includedServiceIds: [],
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
      const categoryId = data.categoryId || defaultCategoryId;
      if (!categoryId) {
        toast.error(
          "No appropriate category found. Please ensure Standard and Add-on categories exist.",
        );
        return;
      }

      await createService({
        name: data.name,
        description: data.description,
        basePriceSmall: data.basePriceSmall,
        basePriceMedium: data.basePriceMedium,
        basePriceLarge: data.basePriceLarge,
        duration: data.duration,
        categoryId: categoryId as Id<"serviceCategories">,
        includedServiceIds: data.includedServiceIds as Id<"services">[],
        features: data.features,
        icon: data.icon,
      });

      toast.success(`${addOnMode ? "Add-on" : "Service"} created successfully`);
      form.reset({
        ...form.getValues(),
        categoryId: finalDefaultCategoryId,
      });
      onOpenChange(false);
    } catch {
      toast.error(`Failed to create ${addOnMode ? "add-on" : "service"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New {addOnMode ? "Add-on" : "Service"}</DialogTitle>
          <DialogDescription>
            Create a new{" "}
            {addOnMode ? "add-on" : "service offering with size-based pricing"}
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
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeFeature(index)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Included Services (Optional) */}
            <FormField
              control={form.control}
              name="includedServiceIds"
              render={() => (
                <FormItem>
                  <FormLabel>Included Services (Optional)</FormLabel>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {allServices?.map((service) => (
                      <FormField
                        key={service._id}
                        control={form.control}
                        name="includedServiceIds"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value?.includes(service._id)}
                                onChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked.target.checked) {
                                    field.onChange([...current, service._id]);
                                  } else {
                                    field.onChange(
                                      current.filter(
                                        (id) => id !== service._id,
                                      ),
                                    );
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                              {service.name}
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
                {isLoading
                  ? "Creating..."
                  : `Create ${addOnMode ? "Add-on" : "Service"}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
