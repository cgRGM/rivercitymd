"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Edit2,
  X,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import AppointmentModal from "@/components/home/appointment-modal";
import { toast } from "sonner";

type Service = {
  _id: Id<"services">;
  name: string;
  description: string;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  duration: number;
  isActive: boolean;
};

type Vehicle = {
  _id: Id<"vehicles">;
  year: number;
  make: string;
  model: string;
  color?: string;
  licensePlate?: string;
};

type Appointment = {
  _id: Id<"appointments">;
  userId: Id<"users">;
  vehicleIds: Id<"vehicles">[];
  serviceIds: Id<"services">[];
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  location: {
    street: string;
    city: string;
    state: string;
    zip: string;
    notes?: string;
  };
  status:
    | "pending"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "rescheduled";
  totalPrice: number;
  notes?: string;
  services: Service[];
  vehicles: Vehicle[];
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AppointmentsClientProps {}

export default function AppointmentsClient({}: AppointmentsClientProps) {
  const { isAuthenticated } = useConvexAuth();
  const appointmentsData = useQuery(api.appointments.getUserAppointments);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  const updateStatus = useMutation(api.appointments.updateStatus);

  // Handle unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Appointments</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your service appointments
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Authentication Required
            </h3>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your appointments.
            </p>
            <Button onClick={() => (window.location.href = "/sign-in")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle loading state
  if (appointmentsData === undefined) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Appointments</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your service appointments
          </p>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-9 w-32" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Skeleton className="h-5 w-24 mb-1" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-6 w-12" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="h-8 flex-1" />
                          <Skeleton className="h-8 flex-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Handle error state
  if (appointmentsData === null) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Appointments</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your service appointments
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load appointments
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading your appointments. Please try again
              later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const appointments = appointmentsData;

  const handleCancelAppointment = async (appointmentId: Id<"appointments">) => {
    try {
      await updateStatus({
        appointmentId,
        status: "cancelled",
      });
      toast.success("Appointment cancelled successfully");
    } catch {
      toast.error("Failed to cancel appointment");
    }
  };

  const formatAppointmentData = (appointment: Appointment) => {
    const serviceNames =
      appointment.services?.map((s) => s.name).join(", ") || "Service";
    const vehicleNames =
      appointment.vehicles
        ?.map((v) => `${v.year} ${v.make} ${v.model}`)
        .join(", ") || "Vehicle";

    return {
      id: appointment._id,
      service: serviceNames,
      vehicle: vehicleNames,
      date: new Date(appointment.scheduledDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: appointment.scheduledTime,
      location: `${appointment.location.street}, ${appointment.location.city}, ${appointment.location.state} ${appointment.location.zip}`,
      status: appointment.status,
      price: `$${appointment.totalPrice}`,
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">My Appointments</h2>
          <p className="text-muted-foreground">
            View and manage your appointments
          </p>
        </div>
        <Button onClick={() => setIsAppointmentOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Appointment
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">
            Upcoming ({appointments.upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({appointments.past.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4 mt-6">
          {appointments.upcoming.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No upcoming appointments
                </h3>
                <p className="text-muted-foreground mb-4">
                  You don&apos;t have any upcoming appointments scheduled.
                </p>
                <Button onClick={() => setIsAppointmentOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Appointment
                </Button>
              </CardContent>
            </Card>
          ) : (
            appointments.upcoming.map(
              (appointment: Appointment, index: number) => {
                const formatted = formatAppointmentData(appointment);
                return (
                  <Card
                    key={formatted.id}
                    className="animate-fade-in-up hover:shadow-lg transition-all"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">
                            {formatted.service}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {formatted.vehicle}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                            {formatted.status}
                          </span>
                          <span className="text-lg font-bold">
                            {formatted.price}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{formatted.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{formatted.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{formatted.location}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Dialog
                          open={
                            isRescheduleOpen &&
                            selectedAppointment?._id === formatted.id
                          }
                          onOpenChange={(open) => {
                            setIsRescheduleOpen(open);
                            if (open) setSelectedAppointment(appointment);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit2 className="w-4 h-4 mr-2" />
                              Reschedule
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>Reschedule Appointment</DialogTitle>
                              <DialogDescription>
                                Choose a new date and time for your service
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Current Appointment</Label>
                                <div className="p-3 bg-secondary rounded-lg text-sm">
                                  <div className="font-medium">
                                    {formatted.service}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {formatted.date} at {formatted.time}
                                  </div>
                                </div>
                              </div>
                              <div className="h-[300px] flex items-center justify-center bg-secondary/30 rounded-lg">
                                <p className="text-muted-foreground">
                                  Cal.com scheduling widget would go here
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 bg-transparent"
                                  onClick={() => setIsRescheduleOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button className="flex-1">
                                  Confirm Reschedule
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelAppointment(formatted.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              },
            )
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4 mt-6">
          {appointments.past.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No past appointments
                </h3>
                <p className="text-muted-foreground">
                  Your completed appointments will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            appointments.past.map((appointment: Appointment, index: number) => {
              const formatted = formatAppointmentData(appointment);
              return (
                <Card
                  key={formatted.id}
                  className="animate-fade-in-up hover:shadow-lg transition-all"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">
                          {formatted.service}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {formatted.vehicle}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                          {formatted.status}
                        </span>
                        <span className="text-lg font-bold">
                          {formatted.price}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{formatted.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{formatted.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{formatted.location}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                      >
                        Book Again
                      </Button>
                      {appointment.status === "completed" && (
                        <Button size="sm" className="flex-1">
                          Leave Review
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <AppointmentModal
        open={isAppointmentOpen}
        onOpenChange={setIsAppointmentOpen}
      />
    </div>
  );
}
