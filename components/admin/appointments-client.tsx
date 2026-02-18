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
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
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
import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { AddAppointmentForm } from "@/components/forms";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export default function AppointmentsClient({}: Props) {
  const appointmentsQuery = useQuery(api.appointments.listWithDetails, {});
  const updateStatus = useMutation(api.appointments.updateStatus);
  const deleteAppointment = useMutation(api.appointments.deleteAppointment);

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<Id<"appointments"> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Id<"appointments"> | null>(null);

  // Handle loading state
  if (appointmentsQuery === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Appointments</h2>
            <p className="text-muted-foreground mt-1">
              Manage all customer appointments
            </p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="flex gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20" />
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (appointmentsQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Appointments</h2>
          <p className="text-muted-foreground mt-1">
            Manage all customer appointments
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load appointments
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading the appointments. Please try again
              later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const appointments = appointmentsQuery;

  const filteredAppointments = statusFilter
    ? appointments.filter(
        (apt: { status: string }) => apt.status === statusFilter,
      )
    : appointments;

  const handleStatusUpdate = async (
    appointmentId: Id<"appointments">,
    newStatus: "confirmed" | "in_progress" | "completed" | "cancelled",
  ) => {
    setLoadingId(appointmentId);
    try {
      await updateStatus({ appointmentId, status: newStatus });
      toast.success(`Appointment ${newStatus.replace("_", " ")}`);
    } catch {
      toast.error("Failed to update appointment status");
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "user.name",
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
      accessorKey: "services",
      header: "Service",
      cell: ({ row }) => {
        const services = row.original.services || [];
        return (
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {services.map((s: any) => (
              <span key={s._id} className="text-sm">
                {s.name}
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
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span>{formatDate(row.getValue("scheduledDate"))}</span>
        </div>
      ),
    },
    {
      accessorKey: "scheduledTime",
      header: "Time",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span>{row.getValue("scheduledTime")}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        // Map status to badge variant logic roughly
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        if (status === "confirmed") variant = "default"; // green-ish usually but default works
        if (status === "cancelled") variant = "destructive";
        if (status === "pending") variant = "secondary";
        
        return (
          <Badge variant={variant} className={getStatusColor(status)}>
            {status.replace("_", " ")}
          </Badge>
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
        const amount = parseFloat(row.getValue("totalPrice"));
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const appointment = row.original;
        return (
          <DropdownMenu>
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
              {appointment.status === "pending" && (
                <DropdownMenuItem onClick={() => handleStatusUpdate(appointment._id, "confirmed")}>
                  Confirm
                </DropdownMenuItem>
              )}
              {appointment.status === "confirmed" && (
                 <DropdownMenuItem onClick={() => handleStatusUpdate(appointment._id, "in_progress")}>
                  Start
                </DropdownMenuItem>
              )}
               {appointment.status === "in_progress" && (
                 <DropdownMenuItem onClick={() => handleStatusUpdate(appointment._id, "completed")}>
                  Complete
                </DropdownMenuItem>
              )}
              {appointment.status !== "cancelled" && appointment.status !== "completed" && (
                 <DropdownMenuItem onClick={() => handleStatusUpdate(appointment._id, "cancelled")} className="text-destructive">
                  Cancel
                </DropdownMenuItem>
              )}
               <DropdownMenuSeparator />
               <DropdownMenuItem 
                  onClick={() => setAppointmentToDelete(appointment._id)}
                  className="text-destructive"
                >
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Appointments</h2>
          <p className="text-muted-foreground">
            Manage your appointments and schedule
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Appointment
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
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
          Pending (
          {
            appointments.filter(
              (a: { status: string }) => a.status === "pending",
            ).length
          }
          )
        </Button>
        <Button
          variant={statusFilter === "confirmed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("confirmed")}
        >
          Confirmed (
          {
            appointments.filter(
              (a: { status: string }) => a.status === "confirmed",
            ).length
          }
          )
        </Button>
         <Button
          variant={statusFilter === "in_progress" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("in_progress")}
        >
          In Progress (
          {
            appointments.filter(
              (a: { status: string }) => a.status === "in_progress",
            ).length
          }
          )
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("completed")}
        >
          Completed (
          {
            appointments.filter(
              (a: { status: string }) => a.status === "completed",
            ).length
          }
          )
        </Button>
      </div>

      {/* Desktop: Data Table */}
      <div className="hidden md:block">
        <DataTable
            columns={columns}
            data={filteredAppointments}
            filterColumn="user_name" 
            filterPlaceholder="Filter by customer..."
        />
      </div>

      {/* Mobile: Cards List */}
      <div className="md:hidden space-y-4">
      {filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {statusFilter
                ? `No ${statusFilter.replace("_", " ")} appointments`
                : "No appointments yet"}
            </p>
            <Button className="mt-4" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Create First Appointment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {filteredAppointments.map((appointment: any, index: number) => {
            const user = appointment.user;
            const services = appointment.services;
            const vehicles = appointment.vehicles;
            const isLoading = loadingId === appointment._id;

            return (
              <Card
                key={appointment._id}
                className="animate-fade-in-up hover:shadow-lg transition-all"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {user?.name || "Unknown User"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {services.length > 0
                          ? services
                              .map((s: { name: string }) => s.name)
                              .join(", ")
                          : "No services"}{" "}
                        •{" "}
                        {vehicles.length > 0
                          ? vehicles
                              .map(
                                (v: {
                                  year: number;
                                  make: string;
                                  model: string;
                                }) => `${v.year} ${v.make} ${v.model}`,
                              )
                              .join(", ")
                          : "No vehicles"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          appointment.status,
                        )}`}
                      >
                        {appointment.status.replace("_", " ")}
                      </span>
                      <span className="text-lg font-bold">
                        ${appointment.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDate(appointment.scheduledDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {appointment.scheduledTime} ({appointment.duration}{" "}
                          min)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {appointment.location.street},{" "}
                          {appointment.location.city},{" "}
                          {appointment.location.state}{" "}
                          {appointment.location.zip}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {user && (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>{user.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{user.email}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {appointment.notes && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Notes:</span>{" "}
                        {appointment.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 flex-wrap">
                    {appointment.status === "pending" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          handleStatusUpdate(appointment._id, "confirmed")
                        }
                        disabled={isLoading}
                      >
                        Confirm
                      </Button>
                    )}
                    {appointment.status === "confirmed" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          handleStatusUpdate(appointment._id, "in_progress")
                        }
                        disabled={isLoading}
                      >
                        Start
                      </Button>
                    )}
                    {appointment.status === "in_progress" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          handleStatusUpdate(appointment._id, "completed")
                        }
                        disabled={isLoading}
                      >
                        Complete
                      </Button>
                    )}
                    {appointment.status !== "completed" &&
                      appointment.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleStatusUpdate(appointment._id, "cancelled")
                          }
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                      )}
                    <Button variant="outline" size="sm" disabled={isLoading}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAppointmentToDelete(appointment._id)}
                      disabled={isLoading}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!appointmentToDelete}
        onOpenChange={(open) => !open && setAppointmentToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              appointment from your database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setAppointmentToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete Appointment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddAppointmentForm open={showAddForm} onOpenChange={setShowAddForm} />
    </div>
  );
}
