"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpDown,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
} from "lucide-react";

type RequestStatus =
  | "new"
  | "reviewing"
  | "contacted"
  | "approved"
  | "declined"
  | "notified";

type OutOfAreaRequest = {
  _id: Id<"outOfAreaRequests">;
  _creationTime: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
  };
  scheduledDate?: string;
  scheduledTime?: string;
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    vehicleTypeName?: string;
    color?: string;
    licensePlate?: string;
    hasPet?: boolean;
  };
  estimatedDistanceMiles?: number;
  estimatedTravelFee?: number;
  status: RequestStatus;
  adminNotes?: string;
  createdAt: number;
};

const statusLabels: Record<RequestStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  approved: "Approved",
  declined: "Declined",
  notified: "Notified",
};

function statusVariant(status: RequestStatus) {
  if (status === "new") return "destructive";
  if (status === "approved") return "default";
  if (status === "declined") return "outline";
  return "secondary";
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time?: string) {
  if (!time) return "No time";
  const [hourValue, minute = "00"] = time.split(":");
  const hour = Number(hourValue);
  if (!Number.isFinite(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function vehicleLabel(request: OutOfAreaRequest) {
  if (!request.vehicle) return "No vehicle";
  return (
    [
      request.vehicle.year,
      request.vehicle.make,
      request.vehicle.model,
    ]
      .filter(Boolean)
      .join(" ") || "Vehicle details pending"
  );
}

function locationLabel(request: OutOfAreaRequest) {
  return [
    request.address.street,
    request.address.city,
    request.address.state,
    request.address.zip,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function OutOfAreaRequestsClient() {
  const requests = useQuery(api.bookingDrafts.listOutOfAreaRequestsForAdmin);
  const updateStatus = useMutation(api.bookingDrafts.updateOutOfAreaRequestStatus);
  const [selectedRequest, setSelectedRequest] =
    useState<OutOfAreaRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updatingId, setUpdatingId] = useState<Id<"outOfAreaRequests"> | null>(
    null,
  );

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error(`Failed to copy ${label}`);
    }
  };

  const setStatus = async (request: OutOfAreaRequest, status: RequestStatus) => {
    setUpdatingId(request._id);
    try {
      await updateStatus({
        requestId: request._id,
        status,
        adminNotes:
          selectedRequest?._id === request._id
            ? adminNotes || undefined
            : request.adminNotes,
      });
      toast.success(`Marked ${statusLabels[status].toLowerCase()}`);
    } catch {
      toast.error("Failed to update request");
    } finally {
      setUpdatingId(null);
    }
  };

  const columns: ColumnDef<OutOfAreaRequest>[] = [
    {
      accessorKey: "customerName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <p className="font-medium">{row.original.customerName}</p>
          <p className="text-xs text-muted-foreground">
            Requested {formatDate(row.original.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: "contact",
      accessorFn: (row) => `${row.customerEmail} ${row.customerPhone}`,
      header: "Contact",
      cell: ({ row }) => (
        <div className="min-w-[220px] space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            {row.original.customerEmail}
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            {row.original.customerPhone}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "address.city",
      header: "Location",
      cell: ({ row }) => (
        <div className="flex min-w-[220px] items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{locationLabel(row.original)}</span>
        </div>
      ),
    },
    {
      accessorKey: "scheduledDate",
      header: "Requested Time",
      cell: ({ row }) => (
        <div className="min-w-[150px] text-sm">
          <p>{row.original.scheduledDate || "No date"}</p>
          <p className="text-xs text-muted-foreground">
            {formatTime(row.original.scheduledTime)}
          </p>
        </div>
      ),
    },
    {
      id: "travel",
      accessorFn: (row) => row.estimatedTravelFee ?? 0,
      header: "Travel",
      cell: ({ row }) => (
        <div className="min-w-[130px] text-sm">
          <p className="font-medium">
            {row.original.estimatedTravelFee !== undefined
              ? `$${row.original.estimatedTravelFee.toFixed(2)}`
              : "Unavailable"}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.estimatedDistanceMiles !== undefined
              ? `${row.original.estimatedDistanceMiles.toFixed(1)} miles`
              : "No distance"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {statusLabels[row.original.status]}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(event) => event.stopPropagation()}
              disabled={updatingId === row.original._id}
            >
              <span className="sr-only">Open actions</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                setSelectedRequest(row.original);
                setAdminNotes(row.original.adminNotes || "");
              }}
            >
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => copyValue(row.original.customerEmail, "email")}
            >
              Copy Email
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => copyValue(row.original.customerPhone, "phone")}
            >
              Copy Phone
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.keys(statusLabels).map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() =>
                  setStatus(row.original, status as RequestStatus)
                }
              >
                Mark {statusLabels[status as RequestStatus]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (requests === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Out-of-Area Requests</h2>
          <p className="mt-1 text-muted-foreground">
            Review customers outside the regular service area
          </p>
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

  if (requests === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Out-of-Area Requests</h2>
          <p className="mt-1 text-muted-foreground">
            Review customers outside the regular service area
          </p>
        </div>
        <Card className="py-12 text-center">
          <CardContent>
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Unable to load requests</h3>
            <p className="mb-6 text-muted-foreground">
              There was an error loading out-of-area requests.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold">Out-of-Area Requests</h2>
        <p className="text-muted-foreground">
          Review manual service requests before scheduling or taking payment
        </p>
      </div>

      <DataTable
        columns={columns}
        data={requests as OutOfAreaRequest[]}
        filterColumn="customerName"
        filterPlaceholder="Search requests by customer..."
        tableMinWidthClass="min-w-[1180px]"
        onRowClick={(request) => {
          setSelectedRequest(request as OutOfAreaRequest);
          setAdminNotes((request as OutOfAreaRequest).adminNotes || "");
        }}
      />

      {selectedRequest && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedRequest(null);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRequest.customerName}</DialogTitle>
              <DialogDescription>
                Out-of-area request from {formatDate(selectedRequest.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">Contact</p>
                <p className="text-sm">{selectedRequest.customerEmail}</p>
                <p className="text-sm">{selectedRequest.customerPhone}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">Requested Time</p>
                <p className="text-sm">
                  {selectedRequest.scheduledDate || "No date"} at{" "}
                  {formatTime(selectedRequest.scheduledTime)}
                </p>
              </div>
              <div className="rounded-md border p-3 sm:col-span-2">
                <p className="mb-2 text-sm font-semibold">Location</p>
                <p className="text-sm">{locationLabel(selectedRequest)}</p>
                {selectedRequest.address.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedRequest.address.notes}
                  </p>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">Vehicle</p>
                <p className="text-sm">{vehicleLabel(selectedRequest)}</p>
                {selectedRequest.vehicle?.vehicleTypeName && (
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.vehicle.vehicleTypeName}
                  </p>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">Estimate</p>
                <p className="text-sm">
                  {selectedRequest.estimatedTravelFee !== undefined
                    ? `$${selectedRequest.estimatedTravelFee.toFixed(2)}`
                    : "Travel fee unavailable"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.estimatedDistanceMiles !== undefined
                    ? `${selectedRequest.estimatedDistanceMiles.toFixed(1)} miles`
                    : "Distance unavailable"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Admin Notes</p>
              <Textarea
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                placeholder="Add internal notes"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {Object.keys(statusLabels).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={
                    selectedRequest.status === status ? "default" : "outline"
                  }
                  onClick={() =>
                    setStatus(selectedRequest, status as RequestStatus)
                  }
                  disabled={updatingId === selectedRequest._id}
                >
                  {statusLabels[status as RequestStatus]}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
