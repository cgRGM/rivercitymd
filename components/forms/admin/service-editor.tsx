"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, Plus, Save, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  VehiclePricingEditor,
  type VehiclePriceFormRow,
} from "@/components/forms/admin/vehicle-pricing-editor";

export type ServiceEditorType = "standard" | "addon" | "subscription";

const formSchema = z
  .object({
    name: z.string().min(1, "Service name is required"),
    description: z.string().min(1, "Description is required"),
    duration: z.number().min(0, "Duration must be non-negative"),
    vehiclePrices: z.array(
      z.object({
        vehicleTypeId: z.string().optional(),
        vehicleTypeName: z.string().optional(),
        price: z.number().min(0, "Price must be non-negative"),
        duration: z.number().min(0, "Duration must be non-negative"),
        isAvailable: z.boolean(),
      }),
    ),
    features: z.array(z.string()).optional(),
    icon: z.string().optional(),
    includedServiceIds: z.array(z.string()).optional(),
    isActive: z.boolean(),
  })
  .refine(
    (data) =>
      data.vehiclePrices.some((row) => row.isAvailable && row.price > 0),
    {
      message:
        "At least one vehicle type price must be available and greater than $0.",
      path: ["vehiclePrices"],
    },
  );

type FormData = z.infer<typeof formSchema>;

type ServiceEditorProps = {
  mode: "create" | "edit";
  serviceId?: Id<"services">;
  initialType?: ServiceEditorType;
};

const TYPE_LABELS: Record<ServiceEditorType, string> = {
  standard: "Standard service",
  addon: "Add-on",
  subscription: "Subscription plan",
};

export function ServiceEditor({
  mode,
  serviceId,
  initialType = "standard",
}: ServiceEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [newFeature, setNewFeature] = useState("");
  const allServices = useQuery(api.services.list);
  const service = useQuery(
    api.services.getById,
    mode === "edit" && serviceId ? { serviceId } : "skip",
  );
  const createService = useMutation(api.services.create);
  const updateService = useMutation(api.services.update);
  const serviceType =
    mode === "edit"
      ? ((service?.serviceType ?? initialType) as ServiceEditorType)
      : initialType;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      duration: initialType === "addon" ? 0 : 60,
      vehiclePrices: [] as VehiclePriceFormRow[],
      features: [],
      icon: "",
      includedServiceIds: [],
      isActive: true,
    },
  });

  useEffect(() => {
    if (!service) return;
    form.reset({
      name: service.name,
      description: service.description,
      duration: service.duration,
      vehiclePrices:
        service.vehiclePrices?.map((price) => ({
          vehicleTypeId: price.vehicleTypeId,
          price: price.price,
          duration: price.duration || service.duration,
          isAvailable: price.isAvailable,
        })) ?? [],
      features: service.features ?? [],
      icon: service.icon ?? "",
      includedServiceIds: service.includedServiceIds?.map(String) ?? [],
      isActive: service.isActive,
    });
  }, [form, service]);

  const addFeature = () => {
    const feature = newFeature.trim();
    if (!feature) return;
    form.setValue("features", [...(form.getValues("features") ?? []), feature], {
      shouldDirty: true,
    });
    setNewFeature("");
  };

  const removeFeature = (index: number) => {
    form.setValue(
      "features",
      (form.getValues("features") ?? []).filter(
        (_, featureIndex) => featureIndex !== index,
      ),
      { shouldDirty: true },
    );
  };

  const onSubmit = async (data: FormData) => {
    setIsSaving(true);
    try {
      const vehiclePrices = data.vehiclePrices.map((row) => ({
        vehicleTypeId: row.vehicleTypeId as Id<"vehicleTypes"> | undefined,
        vehicleTypeName: row.vehicleTypeName,
        price: row.price,
        duration: row.duration,
        isAvailable: row.isAvailable,
      }));
      const legacyPrices = vehiclePrices
        .filter((row) => row.isAvailable && row.price > 0)
        .map((row) => row.price);
      const compatibilityPrice = legacyPrices[0] ?? 0;

      if (mode === "edit" && serviceId) {
        await updateService({
          serviceId,
          name: data.name,
          description: data.description,
          basePriceSmall: service?.basePriceSmall ?? compatibilityPrice,
          basePriceMedium: service?.basePriceMedium ?? compatibilityPrice,
          basePriceLarge: service?.basePriceLarge ?? compatibilityPrice,
          vehiclePrices,
          duration: data.duration,
          serviceType,
          includedServiceIds: data.includedServiceIds as Id<"services">[],
          features: data.features,
          icon: data.icon,
          isActive: data.isActive,
        });
        toast.success("Service updated");
      } else {
        await createService({
          name: data.name,
          description: data.description,
          basePriceSmall: compatibilityPrice,
          basePriceMedium: compatibilityPrice,
          basePriceLarge: compatibilityPrice,
          vehiclePrices,
          duration: data.duration,
          serviceType,
          includedServiceIds: data.includedServiceIds as Id<"services">[],
          features: data.features,
          icon: data.icon,
        });
        toast.success(`${TYPE_LABELS[serviceType]} created`);
      }

      router.push("/admin/services");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save service",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === "edit" && service === undefined) {
    return <div className="py-20 text-center text-muted-foreground">Loading service...</div>;
  }

  if (mode === "edit" && service === null) {
    return <div className="py-20 text-center">Service not found.</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/services" aria-label="Back to services">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">
                  {mode === "edit" ? "Edit product" : "Create product"}
                </h2>
                <Badge variant="secondary">{TYPE_LABELS[serviceType]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Define what customers see, which vehicles can book it, and how
                much calendar time each vehicle requires.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/services">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save product"}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full interior detail" />
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
                      <FormLabel>Icon</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Car" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="min-h-24"
                          placeholder="Describe what is included and what the customer should expect."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <VehiclePricingEditor
                  form={form}
                  defaultDuration={form.watch("duration")}
                />
                {form.formState.errors.vehiclePrices?.message && (
                  <p className="mt-3 text-sm font-medium text-destructive">
                    {String(form.formState.errors.vehiclePrices.message)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer-facing details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <FormLabel>Features</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      value={newFeature}
                      onChange={(event) => setNewFeature(event.target.value)}
                      placeholder="Add a feature"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addFeature();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addFeature}>
                      <Plus className="h-4 w-4" />
                      <span className="sr-only">Add feature</span>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch("features")?.map((feature, index) => (
                      <Badge key={`${feature}-${index}`} variant="secondary">
                        {feature}
                        <button
                          type="button"
                          className="ml-1 inline-flex"
                          onClick={() => removeFeature(index)}
                          aria-label={`Remove feature ${feature}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="includedServiceIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Included services</FormLabel>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {allServices
                          ?.filter((candidate) => candidate._id !== serviceId)
                          .map((candidate) => {
                            const checked = field.value?.includes(candidate._id);
                            return (
                              <label
                                key={candidate._id}
                                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(nextChecked) => {
                                    const current = field.value ?? [];
                                    field.onChange(
                                      nextChecked
                                        ? [...current, candidate._id]
                                        : current.filter(
                                            (id) => id !== candidate._id,
                                          ),
                                    );
                                  }}
                                />
                                <span className="text-sm">{candidate.name}</span>
                              </label>
                            );
                          })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 xl:sticky xl:top-24">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking defaults</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {serviceType === "addon"
                          ? "Default extra minutes"
                          : "Default duration (minutes)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="5"
                          {...field}
                          value={field.value || ""}
                          onChange={(event) =>
                            field.onChange(
                              Number.parseInt(event.target.value, 10) || 0,
                            )
                          }
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Used as the legacy fallback. Vehicle rows can override it.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {mode === "edit" && (
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem>
                        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true)
                            }
                          />
                          <span>
                            <span className="flex items-center gap-1 text-sm font-medium">
                              <Check className="h-3.5 w-3.5" />
                              Visible for booking
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Hide this product without deleting its history.
                            </span>
                          </span>
                        </label>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
