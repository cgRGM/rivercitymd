"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "sonner";
import { AddServiceForm } from "@/components/forms";
import { AddAddonForm } from "@/components/admin/forms/add-addon-form";
import { EditServiceForm } from "@/components/forms/admin/edit-service-form";
import {
  AlertCircle,
  ArrowUpDown,
  Edit,
  MoreHorizontal,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

type ServiceRecord = {
  _id: Id<"services">;
  name: string;
  description: string;
  icon?: string;
  serviceType?: "standard" | "addon" | "subscription";
  serviceTypeLabel?: string;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  basePrice?: number;
  duration: number;
  bookings?: number;
  popularity?: string;
  isActive: boolean;
  categoryId?: Id<"serviceCategories">;
  includedServiceIds?: Id<"services">[];
  features?: string[];
};

export default function ServicesClient() {
  const servicesQuery = useQuery(api.services.listWithBookingStats) as
    | ServiceRecord[]
    | null
    | undefined;
  const deleteService = useMutation(api.services.deleteService);
  const updateService = useMutation(api.services.update);
  const depositSettings = useQuery(api.depositSettings.get);
  const updateDepositSettings = useMutation(api.depositSettings.upsert);

  const [showServiceTypeDialog, setShowServiceTypeDialog] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddAddonForm, setShowAddAddonForm] = useState(false);
  const [showAddSubscriptionForm, setShowAddSubscriptionForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"services"> | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Id<"services"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"services"> | null>(null);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<Id<"services"> | null>(null);

  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(depositSettings?.amountPerVehicle ?? 50);

  useEffect(() => {
    if (depositSettings) {
      setDepositAmount(depositSettings.amountPerVehicle);
    }
  }, [depositSettings]);

  if (servicesQuery === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Services</h2>
            <p className="mt-1 text-muted-foreground">Manage your service offerings</p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <Card>
          <CardContent className="py-10">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (servicesQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Services</h2>
          <p className="mt-1 text-muted-foreground">Manage your service offerings</p>
        </div>

        <Card className="py-12 text-center">
          <CardContent>
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Unable to load services</h3>
            <p className="mb-6 text-muted-foreground">
              There was an error loading services. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const services = servicesQuery;

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const formatTypeLabel = (service: ServiceRecord) => {
    if (service.serviceTypeLabel) return service.serviceTypeLabel;
    if (service.serviceType === "addon") return "Add-on Services";
    if (service.serviceType === "subscription") return "Subscription Plans";
    return "Standard Services";
  };

  const formatPricing = (service: ServiceRecord) => {
    const small = service.basePriceSmall ?? service.basePrice;
    const medium = service.basePriceMedium ?? service.basePrice;
    const large = service.basePriceLarge ?? service.basePrice;

    const parts: string[] = [];
    if (small !== undefined) parts.push(`S $${small.toFixed(0)}`);
    if (medium !== undefined) parts.push(`M $${medium.toFixed(0)}`);
    if (large !== undefined) parts.push(`L $${large.toFixed(0)}`);
    return parts.join(" • ") || "N/A";
  };

  const popularityBadgeClass = (popularity?: string) => {
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

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    setDeletingId(serviceToDelete);
    setServiceToDelete(null);

    try {
      await deleteService({ serviceId: serviceToDelete });
      toast.success("Service deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete service");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleServiceVisibility = async (service: ServiceRecord) => {
    setUpdatingVisibilityId(service._id);
    try {
      await updateService({
        serviceId: service._id,
        name: service.name,
        description: service.description,
        basePriceSmall: service.basePriceSmall ?? service.basePrice ?? 0,
        basePriceMedium: service.basePriceMedium ?? service.basePrice ?? 0,
        basePriceLarge: service.basePriceLarge ?? service.basePrice ?? 0,
        duration: service.duration,
        serviceType: service.serviceType ?? "standard",
        categoryId: service.categoryId,
        includedServiceIds: service.includedServiceIds,
        features: service.features,
        icon: service.icon,
        isActive: !service.isActive,
      });

      toast.success(service.isActive ? "Service hidden" : "Service made visible");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update service visibility");
    } finally {
      setUpdatingVisibilityId(null);
    }
  };

  const columns: ColumnDef<ServiceRecord>[] = [
    {
      id: "name",
      accessorFn: (row) => row.name,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[260px]">
          <div className="flex items-center gap-2">
            {row.original.icon ? <span className="text-lg">{row.original.icon}</span> : null}
            <span className="font-medium">{row.original.name}</span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{row.original.description}</p>
        </div>
      ),
    },
    {
      id: "serviceType",
      accessorFn: (row) => row.serviceType ?? "standard",
      header: "Type",
      cell: ({ row }) => (
        <span className="min-w-[150px] text-sm text-muted-foreground">
          {formatTypeLabel(row.original)}
        </span>
      ),
    },
    {
      id: "pricing",
      accessorFn: (row) => formatPricing(row),
      header: "Pricing",
      cell: ({ row }) => <span className="min-w-[170px] text-sm">{formatPricing(row.original)}</span>,
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => <span>{formatDuration(row.original.duration)}</span>,
    },
    {
      id: "bookings",
      accessorFn: (row) => row.bookings ?? 0,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Bookings
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{row.original.bookings ?? 0}</span>,
    },
    {
      id: "popularity",
      accessorFn: (row) => row.popularity ?? "Low",
      header: "Popularity",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${popularityBadgeClass(
            row.original.popularity,
          )}`}
        >
          {row.original.popularity || "Low"}
        </span>
      ),
    },
    {
      id: "visibility",
      accessorFn: (row) => (row.isActive ? "active" : "hidden"),
      header: "Visibility",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Visible" : "Hidden"}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const service = row.original;
        const isBusy = deletingId === service._id || updatingVisibilityId === service._id;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" disabled={isBusy}>
                <span className="sr-only">Open actions</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setEditingId(service._id)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void toggleServiceVisibility(service)}>
                {service.isActive ? "Hide" : "Show"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setServiceToDelete(service._id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-bold">Services</h2>
          {isEditingDeposit ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Deposit:</span>
              <Input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(event) => setDepositAmount(parseFloat(event.target.value) || 50)}
                className="w-24"
              />
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await updateDepositSettings({ amountPerVehicle: depositAmount });
                    setIsEditingDeposit(false);
                    toast.success("Deposit amount updated");
                  } catch {
                    toast.error("Failed to update deposit amount");
                  }
                }}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditingDeposit(false);
                  setDepositAmount(depositSettings?.amountPerVehicle ?? 50);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Deposit: ${depositSettings?.amountPerVehicle ?? 50} per vehicle
              </span>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingDeposit(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Button onClick={() => setShowServiceTypeDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create a Service
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={services}
        filterColumn="name"
        filterPlaceholder="Search services by name..."
        tableMinWidthClass="min-w-[1340px]"
      />

      <Dialog open={showServiceTypeDialog} onOpenChange={setShowServiceTypeDialog}>
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
              className="h-auto justify-start p-4"
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
              className="h-auto justify-start p-4"
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
              className="h-auto justify-start p-4"
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

      <Dialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This permanently deletes a service only when it has never been used in any appointment.
              For used services, hide them instead.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setServiceToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Service
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddServiceForm open={showAddForm} onOpenChange={setShowAddForm} />
      <AddAddonForm open={showAddAddonForm} onOpenChange={setShowAddAddonForm} />
      <AddServiceForm
        open={showAddSubscriptionForm}
        onOpenChange={setShowAddSubscriptionForm}
        subscriptionMode={true}
      />
      <EditServiceForm
        serviceId={editingId}
        open={!!editingId}
        onOpenChange={(open) => !open && setEditingId(null)}
      />
    </div>
  );
}
