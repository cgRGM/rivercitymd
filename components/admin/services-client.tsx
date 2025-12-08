"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, AlertCircle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { AddServiceForm } from "@/components/forms";
import { AddAddonForm } from "@/components/admin/forms/add-addon-form";
import { EditServiceForm } from "@/components/forms/admin/edit-service-form";
import type { Id } from "@/convex/_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

// Hardcoded category IDs for easy reference
const CATEGORY_IDS = {
  STANDARD: "mn7bmjfryfs87q7xzjja2b96hn7vyqnb",
  ADD_ON: "mn7av50tfv8pz9e3vrc11skdbd7vydmc",
  SUBSCRIPTION: "mn73n62t43q4khjvj4g76jp8wx7vzgpm",
} as const;

export default function ServicesClient({}: Props) {
  const servicesQuery = useQuery(api.services.listWithBookingStats);
  const categoriesQuery = useQuery(api.services.listCategories);
  const deleteService = useMutation(api.services.deleteService);
  const [showServiceTypeDialog, setShowServiceTypeDialog] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddAddonForm, setShowAddAddonForm] = useState(false);
  const [showAddSubscriptionForm, setShowAddSubscriptionForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"services"> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Handle loading state
  if (servicesQuery === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Services</h2>
            <p className="text-muted-foreground mt-1">
              Manage your service offerings
            </p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (servicesQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Services</h2>
          <p className="text-muted-foreground mt-1">
            Manage your service offerings
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load services
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading the services. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = categoriesQuery;

  const handleDeleteService = async (serviceId: Id<"services">) => {
    if (
      !confirm(
        "Are you sure you want to delete this service? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(serviceId);
    try {
      await deleteService({ serviceId });
      toast.success("Service deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete service",
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Group services by category, ensuring all categories are shown
  const servicesByCategory = categories
    ? categories.reduce(
        (acc, category) => {
          const categoryServices = (servicesQuery || []).filter(
            (service) => service.categoryId === category._id,
          );
          acc[category.name] = categoryServices;
          return acc;
        },
        {} as Record<string, NonNullable<typeof servicesQuery>>,
      )
    : {
        "Standard Services": [],
        "Add-on Services": [],
        "Subscription Plans": [],
      }; // Fallback for debugging
  const getPopularityColor = (popularity: string) => {
    switch (popularity) {
      case "Very High":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "High":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "Medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Services</h2>
          <p className="text-muted-foreground">Manage your service offerings</p>
        </div>
        <Button onClick={() => setShowServiceTypeDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create a Service
        </Button>
      </div>

      <div className="space-y-8">
        {categories &&
          servicesByCategory &&
          Object.entries(servicesByCategory).map(
            ([categoryName, categoryServices]) => (
              <div key={categoryName} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-semibold">{categoryName}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {categoryServices?.map((service, index) => (
                    <Card
                      key={service._id}
                      className="animate-fade-in-up hover:shadow-lg transition-all"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              {service.icon && (
                                <div className="text-2xl">{service.icon}</div>
                              )}
                              <div className="flex-1">
                                <CardTitle className="text-xl">
                                  {service.name}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {service.description}
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingId(service._id)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteService(service._id)}
                              disabled={deletingId === service._id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Features */}
                        {service.features && service.features.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">
                              Features:
                            </div>
                            <ul className="text-sm space-y-1">
                              {service.features
                                .slice(0, 3)
                                .map((feature: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-center gap-2"
                                  >
                                    <Check className="w-3 h-3 text-accent" />
                                    {feature}
                                  </li>
                                ))}
                              {service.features.length > 3 && (
                                <li className="text-muted-foreground">
                                  +{service.features.length - 3} more features
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Small
                            </div>
                            <div className="font-semibold">
                              $
                              {service.basePriceSmall?.toFixed(2) ||
                                service.basePrice?.toFixed(2) ||
                                "N/A"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Medium
                            </div>
                            <div className="font-semibold">
                              $
                              {service.basePriceMedium?.toFixed(2) ||
                                service.basePrice?.toFixed(2) ||
                                "N/A"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Large
                            </div>
                            <div className="font-semibold">
                              $
                              {service.basePriceLarge?.toFixed(2) ||
                                service.basePrice?.toFixed(2) ||
                                "N/A"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <div>
                            <div className="text-sm text-muted-foreground">
                              Duration
                            </div>
                            <div className="font-medium">
                              {Math.floor(service.duration / 60)}h{" "}
                              {service.duration % 60}m
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">
                              Bookings
                            </div>
                            <div className="font-medium">
                              {service.bookings} this month
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Popularity:
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getPopularityColor(service.popularity)}`}
                          >
                            {service.popularity}
                          </span>
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setEditingId(service._id)}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDeleteService(service._id)}
                            disabled={deletingId === service._id}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            {deletingId === service._id
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ),
          )}
      </div>

      {/* Service Type Selection Dialog */}
      <Dialog
        open={showServiceTypeDialog}
        onOpenChange={setShowServiceTypeDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Service</DialogTitle>
            <DialogDescription>
              Choose the type of service you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => {
                setShowServiceTypeDialog(false);
                setShowAddForm(true);
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Standard Service</div>
                <div className="text-sm text-muted-foreground">
                  Main services with size-based pricing
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => {
                setShowServiceTypeDialog(false);
                setShowAddAddonForm(true);
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Add-on Service</div>
                <div className="text-sm text-muted-foreground">
                  Additional services with flat pricing
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => {
                setShowServiceTypeDialog(false);
                setShowAddSubscriptionForm(true);
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Subscription Plan</div>
                <div className="text-sm text-muted-foreground">
                  Recurring services with subscription pricing
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddServiceForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        defaultCategoryId={CATEGORY_IDS.STANDARD}
      />
      <AddAddonForm
        open={showAddAddonForm}
        onOpenChange={setShowAddAddonForm}
        defaultCategoryId={CATEGORY_IDS.ADD_ON}
      />
      <AddServiceForm
        open={showAddSubscriptionForm}
        onOpenChange={setShowAddSubscriptionForm}
        subscriptionMode={true}
        defaultCategoryId={CATEGORY_IDS.SUBSCRIPTION}
      />
      <EditServiceForm
        serviceId={editingId}
        open={!!editingId}
        onOpenChange={(open) => !open && setEditingId(null)}
      />
    </div>
  );
}
