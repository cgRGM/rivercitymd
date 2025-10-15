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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
// import { AddAppointmentForm } from "@/components/forms"; // TODO: Fix form

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export default function AppointmentsClient({}: Props) {
  const appointmentsQuery = useQuery(api.appointments.listWithDetails, {});
  const updateStatus = useMutation(api.appointments.updateStatus);
  const deleteAppointment = useMutation(api.appointments.deleteAppointment);

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<Id<"appointments"> | null>(null);
  // const [showAddForm, setShowAddForm] = useState(false); // TODO: Re-enable when form is fixed

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
    ? appointments.filter((apt) => apt.status === statusFilter)
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

  const handleDelete = async (appointmentId: Id<"appointments">) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;

    setLoadingId(appointmentId);
    try {
      await deleteAppointment({ appointmentId });
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Appointments</h2>
          <p className="text-muted-foreground">
            Manage your appointments and schedule
          </p>
        </div>
        {/* TODO: Re-enable when AddAppointmentForm is fixed */}
        {/* <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Appointment
        </Button> */}
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
          Pending ({appointments.filter((a) => a.status === "pending").length})
        </Button>
        <Button
          variant={statusFilter === "confirmed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("confirmed")}
        >
          Confirmed (
          {appointments.filter((a) => a.status === "confirmed").length})
        </Button>
        <Button
          variant={statusFilter === "in_progress" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("in_progress")}
        >
          In Progress (
          {appointments.filter((a) => a.status === "in_progress").length})
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("completed")}
        >
          Completed (
          {appointments.filter((a) => a.status === "completed").length})
        </Button>
      </div>

      {/* Appointments List */}
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
          {filteredAppointments.map((appointment, index) => {
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
                          ? services.map((s) => s.name).join(", ")
                          : "No services"}{" "}
                        •{" "}
                        {vehicles.length > 0
                          ? vehicles
                              .map((v) => `${v.year} ${v.make} ${v.model}`)
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
                      onClick={() => handleDelete(appointment._id)}
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

      {/* TODO: Fix AddAppointmentForm to match new schema */}
      {/* <AddAppointmentForm open={showAddForm} onOpenChange={setShowAddForm} /> */}
    </div>
  );
}
