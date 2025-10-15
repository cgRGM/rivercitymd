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
import { Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddServiceForm } from "@/components/forms";
import type { Id } from "@/convex/_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export default function ServicesClient({}: Props) {
  const servicesQuery = useQuery(api.services.listWithBookingStats);
  const deleteService = useMutation(api.services.deleteService);
  const [showAddForm, setShowAddForm] = useState(false);
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

  const services = servicesQuery;

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
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map((service, index) => (
          <Card
            key={service._id}
            className="animate-fade-in-up hover:shadow-lg transition-all"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{service.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {service.description}
                  </CardDescription>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {service.categoryName}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="font-medium">
                    {Math.floor(service.duration / 60)}h {service.duration % 60}
                    m
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Bookings</div>
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
                  onClick={() => {
                    /* TODO: Implement edit */
                  }}
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
                  {deletingId === service._id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddServiceForm open={showAddForm} onOpenChange={setShowAddForm} />
    </div>
  );
}
