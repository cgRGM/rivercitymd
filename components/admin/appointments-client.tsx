"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  Plus,
  AlertCircle,
  MoreHorizontal,
  ArrowUpDown,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "sonner";
import { AddAppointmentForm } from "@/components/forms";
import { formatTime12h } from "@/lib/time";

type AppointmentRecord = {
  _id: Id<"appointments">;
  scheduledDate: string;
  scheduledTime: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "rescheduled";
  totalPrice: number;
  location: { street: string; city: string; state: string; zip: string; notes?: string };
  user: { name?: string; email?: string } | null;
  services: Array<{ _id: Id<"services">; name: string }>;
  vehicles: Array<{ _id: Id<"vehicles">; year: number; make: string; model: string; color?: string }>;
  tripLogStatus: "required" | "draft" | "completed" | null;
  tripLogId?: Id<"tripLogs">;
  tripLogRequiredReason?: "completed_without_log";
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

const BACKFILL_LOCALSTORAGE_KEY = "trip-log-backfill-last-run-date";

export default function AppointmentsClient({}: Props) {
  const router = useRouter();
  const appointmentsQuery = useQuery(api.appointments.listWithDetails, {}) as
    | AppointmentRecord[]
    | null
    | undefined;
  const updateStatus = useMutation(api.appointments.updateStatus);
  const deleteAppointment = useMutation(api.appointments.deleteAppointment);
  const ensureDraftForAppointment = useMutation(
    api.tripLogs.ensureDraftForAppointment,
  );
  const backfillCompletedAppointmentDrafts = useAction(
    api.tripLogs.backfillCompletedAppointmentDrafts,
  );

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<Id<"appointments"> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Id<"appointments"> | null>(null);
  const backfillStartedRef = useRef(false);

  useEffect(() => {
    if (backfillStartedRef.current) return;
    backfillStartedRef.current = true;

    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    if (window.localStorage.getItem(BACKFILL_LOCALSTORAGE_KEY) === today) {
      return;
    }

    void (async () => {
      try {
        const result = await backfillCompletedAppointmentDrafts({});
        window.localStorage.setItem(BACKFILL_LOCALSTORAGE_KEY, today);
        if (result.created > 0) {
          toast.success(`Created ${result.created} missing required trip log draft(s).`);
        }
      } catch (error) {
        console.warn("Trip log backfill failed", error);
      }
    })();
  }, [backfillCompletedAppointmentDrafts]);

  if (appointmentsQuery === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Appointments</h2>
            <p className="mt-1 text-muted-foreground">Manage all customer appointments</p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="mb-6 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20" />
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="mb-2 h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appointmentsQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Appointments</h2>
          <p className="mt-1 text-muted-foreground">Manage all customer appointments</p>
        </div>

        <Card className="py-12 text-center">
          <CardContent>
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Unable to load appointments</h3>
            <p className="mb-6 text-muted-foreground">
              There was an error loading the appointments. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const appointments = appointmentsQuery;

  const filteredAppointments = statusFilter
    ? appointments.filter((appointment) => appointment.status === statusFilter)
    : appointments;

  const handleStatusUpdate = async (
    appointmentId: Id<"appointments">,
    newStatus: "confirmed" | "in_progress" | "completed" | "cancelled",
  ) => {
    setLoadingId(appointmentId);
    try {
      await updateStatus({ appointmentId, status: newStatus });
      toast.success(`Appointment ${newStatus.replace("_", " ")}`);
      router.refresh();
    } catch {
      toast.error("Failed to update appointment status");
    } finally {
      setLoadingId(null);
    }
  };

  const handleOpenTripLog = async (appointment: AppointmentRecord) => {
    if (appointment.tripLogId) {
      router.push(`/admin/logs/${appointment.tripLogId}`);
      return;
    }

    if (appointment.status !== "completed") {
      toast.error("Trip logs are required after an appointment is completed.");
      return;
    }

    setLoadingId(appointment._id);
    try {
      const ensured = await ensureDraftForAppointment({ appointmentId: appointment._id });
      router.push(`/admin/logs/${ensured.tripLogId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open trip log");
    } finally {
      setLoadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!appointmentToDelete) return;

    setLoadingId(appointmentToDelete);
    setAppointmentToDelete(null);

    try {
      await deleteAppointment({ appointmentId: appointmentToDelete });
      toast.success("Appointment deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete appointment");
    } finally {
      setLoadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "in_progress":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "completed":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };


  const columns: ColumnDef<AppointmentRecord>[] = [
    {
      id: "customer",
      accessorFn: (row) => row.user?.name || "",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Customer
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{user?.name || "Unknown"}</span>
            <span className="text-xs text-muted-foreground">{user?.email}</span>
          </div>
        );
      },
    },
    {
      id: "service",
      accessorFn: (row) => row.services.map((service) => service.name).join(", "),
      header: "Service",
      cell: ({ row }) => {
        const services = row.original.services;
        return (
          <div className="flex flex-col gap-1">
            {services.map((service) => (
              <span key={service._id} className="text-sm">
                {service.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "vehicle",
      accessorFn: (row) =>
        row.vehicles.map((v) => `${v.year} ${v.make} ${v.model}`).join(", "),
      header: "Vehicle",
      cell: ({ row }) => {
        const vehicles = row.original.vehicles;
        if (!vehicles.length) {
          return <span className="text-xs text-muted-foreground">N/A</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {vehicles.map((v) => (
              <span key={v._id} className="text-sm">
                {v.year} {v.make} {v.model}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "scheduledDate",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{formatDate(row.original.scheduledDate)}</span>
        </div>
      ),
    },
    {
      accessorKey: "scheduledTime",
      header: "Time",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{formatTime12h(row.original.scheduledTime)}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={getStatusColor(row.original.status)}>
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      id: "address",
      accessorFn: (row) => `${row.location.street} ${row.location.city}`,
      header: "Address",
      cell: ({ row }) => {
        const loc = row.original.location;
        return (
          <div className="flex flex-col">
            <span className="text-sm">{loc.street}</span>
            <span className="text-xs text-muted-foreground">{loc.city}, {loc.state}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "totalPrice",
      header: ({ column }) => {
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Amount
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => {
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(row.original.totalPrice);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const appointment = row.original;
        return (
          <DropdownMenu
          ><div onClick={(e) => e.stopPropagation()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(appointment._id)}
              >
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {appointment.status === "pending" ? (
                <DropdownMenuItem
                  onClick={() => handleStatusUpdate(appointment._id, "confirmed")}
                >
                  Confirm
                </DropdownMenuItem>
              ) : null}
              {appointment.status === "confirmed" ? (
                <DropdownMenuItem
                  onClick={() => handleStatusUpdate(appointment._id, "in_progress")}
                >
                  Start
                </DropdownMenuItem>
              ) : null}
              {appointment.status === "in_progress" ? (
                <DropdownMenuItem
                  onClick={() => handleStatusUpdate(appointment._id, "completed")}
                >
                  Complete
                </DropdownMenuItem>
              ) : null}
              {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleStatusUpdate(appointment._id, "cancelled")}
                >
                  Cancel
                </DropdownMenuItem>
              ) : null}
              {appointment.status === "completed" || appointment.tripLogId ? (
                <DropdownMenuItem onClick={() => void handleOpenTripLog(appointment)}>
                  Open Trip Log
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setAppointmentToDelete(appointment._id)}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </div></DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Appointments</h2>
          <p className="text-muted-foreground">Manage your appointments and schedule</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(null)}
        >
          All ({appointments.length})
        </Button>
        <Button
          variant={statusFilter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("pending")}
        >
          Pending ({appointments.filter((appointment) => appointment.status === "pending").length})
        </Button>
        <Button
          variant={statusFilter === "confirmed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("confirmed")}
        >
          Confirmed ({appointments.filter((appointment) => appointment.status === "confirmed").length})
        </Button>
        <Button
          variant={statusFilter === "in_progress" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("in_progress")}
        >
          In Progress ({appointments.filter((appointment) => appointment.status === "in_progress").length})
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("completed")}
        >
          Completed ({appointments.filter((appointment) => appointment.status === "completed").length})
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredAppointments}
        filterColumn="customer"
        filterPlaceholder="Filter by customer..."
        tableMinWidthClass="min-w-[1280px]"
        onRowClick={(row) => router.push(`/admin/appointments/${row._id}`)}
      />

      <Dialog
        open={!!appointmentToDelete}
        onOpenChange={(open) => !open && setAppointmentToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the appointment from your database.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAppointmentToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Appointment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddAppointmentForm open={showAddForm} onOpenChange={setShowAddForm} />
    </div>
  );
}
