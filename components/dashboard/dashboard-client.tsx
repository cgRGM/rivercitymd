"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
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
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Car,
  Star,
  Clock,
  MapPin,
  Plus,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { formatDateString, formatTime12h } from "@/lib/time";

type RawAppointment = {
  _id: Id<"appointments">;
  _creationTime: number;
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
  createdBy: Id<"users">;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-orange-100 text-orange-700",
};

const SIZE_LABELS: Record<string, string> = {
  small: "Small",
  medium: "Mid-Size",
  large: "Large",
};

export default function DashboardClient() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const queryArgs = isAuthenticated ? {} : ("skip" as const);
  const currentUserQuery = useQuery(api.users.getCurrentUser, queryArgs);
  const userVehiclesQuery = useQuery(api.vehicles.getMyVehicles, queryArgs);
  const userAppointmentsQuery = useQuery(api.appointments.getUserAppointments, queryArgs);

  // Loading state
  if (
    isAuthLoading ||
    (isAuthenticated &&
      (currentUserQuery === undefined ||
        userVehiclesQuery === undefined ||
        userAppointmentsQuery === undefined))
  ) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="rounded-2xl bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="w-9 h-9 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  // Unauthenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Access your dashboard and manage your appointments
          </p>
        </div>
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Authentication Required
            </h3>
            <p className="text-muted-foreground mb-6">
              Please sign in to access your dashboard.
            </p>
            <Button asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (
    currentUserQuery === null ||
    userVehiclesQuery === null ||
    userAppointmentsQuery === null
  ) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Unable to load dashboard data
          </p>
        </div>
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load dashboard
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading your dashboard data. Please try again
              later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const upcomingAppointments = (userAppointmentsQuery?.upcoming ?? []) as RawAppointment[];
  const currentUser = currentUserQuery ?? null;
  const userVehicles = userVehiclesQuery ?? [];
  const completedAppointments = userAppointmentsQuery?.past || [];
  const nextAppointment = upcomingAppointments[0] as RawAppointment | undefined;
  const remainingAppointments = upcomingAppointments.slice(1) as RawAppointment[];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Welcome Section */}
      <div className="relative rounded-2xl bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <h2 className="text-3xl font-bold">
            Welcome back{currentUser?.name ? `, ${currentUser.name}` : ""}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your vehicles
          </p>
          <Button className="mt-4" asChild>
            <Link href="/dashboard/appointments">
              <Plus className="w-4 h-4 mr-2" />
              Book Now
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="animate-fade-in-up group hover:border-accent/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming Bookings
            </CardTitle>
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingAppointments.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingAppointments.length > 0
                ? `Next: ${formatDateString(upcomingAppointments[0]?.scheduledDate)}`
                : "No upcoming bookings"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="animate-fade-in-up group hover:border-accent/30 transition-colors"
          style={{ animationDelay: "50ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Vehicles
            </CardTitle>
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
              <Car className="w-4 h-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userVehicles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All vehicles registered
            </p>
          </CardContent>
        </Card>

        <Card
          className="animate-fade-in-up group hover:border-accent/30 transition-colors"
          style={{ animationDelay: "100ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Services
            </CardTitle>
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentUser?.timesServiced || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Next Appointment Spotlight */}
      {nextAppointment && (
        <Card
          className="animate-fade-in-up border-l-4 border-l-accent overflow-hidden"
          style={{ animationDelay: "120ms" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-accent" />
              <CardTitle className="text-base">Next Appointment</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Date display */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-accent/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-accent uppercase">
                    {new Date(nextAppointment.scheduledDate + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-2xl font-bold text-accent leading-none">
                    {new Date(nextAppointment.scheduledDate + "T00:00:00").getDate()}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-lg">
                    {nextAppointment.serviceIds?.length || 0} Service{(nextAppointment.serviceIds?.length || 0) !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime12h(nextAppointment.scheduledTime)}
                    </span>
                    {nextAppointment.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {nextAppointment.location.city}, {nextAppointment.location.state}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 sm:ml-auto">
                <Badge className={STATUS_STYLES[nextAppointment.status] || "bg-gray-100 text-gray-600"}>
                  {nextAppointment.status.replace("_", " ")}
                </Badge>
                <span className="text-lg font-bold">
                  ${nextAppointment.totalPrice || 0}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                <Link
                  href={`/dashboard/appointments?appointmentId=${nextAppointment._id}&action=reschedule`}
                >
                  Reschedule
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                <Link
                  href={`/dashboard/appointments?appointmentId=${nextAppointment._id}&action=cancel`}
                >
                  Cancel
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Gallery Row */}
      {userVehicles.length > 0 && (
        <div className="animate-fade-in-up" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              My Vehicles
            </h3>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/vehicles">View All</Link>
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {userVehicles.map((vehicle) => (
              <Card
                key={vehicle._id}
                className="min-w-[180px] max-w-[220px] shrink-0 hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                    <Car className="w-5 h-5 text-accent" />
                  </div>
                  <div className="font-semibold text-sm truncate">
                    {vehicle.year} {vehicle.make}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {vehicle.model}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {vehicle.color && (
                      <span className="text-xs text-muted-foreground">
                        {vehicle.color}
                      </span>
                    )}
                    {vehicle.size && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                        {SIZE_LABELS[vehicle.size] || vehicle.size}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Remaining Upcoming Bookings */}
      {remainingAppointments.length > 0 && (
        <Card className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Bookings</CardTitle>
                <CardDescription>Your other scheduled appointments</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {remainingAppointments.map((appointment: RawAppointment) => (
                <Card
                  key={appointment._id}
                  className="hover:shadow-lg transition-all border-border"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">
                          {appointment.serviceIds?.length || 0} Services
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {appointment.vehicleIds?.length || 0} Vehicles
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={STATUS_STYLES[appointment.status] || "bg-gray-100 text-gray-600"}>
                          {appointment.status.replace("_", " ")}
                        </Badge>
                        <span className="text-base font-bold">
                          ${appointment.totalPrice || 0}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{formatDateString(appointment.scheduledDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{formatTime12h(appointment.scheduledTime)}</span>
                      </div>
                      {appointment.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="break-words">
                            {appointment.location.street},{" "}
                            {appointment.location.city},{" "}
                            {appointment.location.state}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        asChild
                      >
                        <Link
                          href={`/dashboard/appointments?appointmentId=${appointment._id}&action=reschedule`}
                        >
                          Reschedule
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        asChild
                      >
                        <Link
                          href={`/dashboard/appointments?appointmentId=${appointment._id}&action=cancel`}
                        >
                          Cancel
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state for no upcoming bookings (only if no next appointment either) */}
      {!nextAppointment && (
        <Card className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No upcoming bookings
            </h3>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have any upcoming appointments scheduled.
            </p>
            <Button asChild>
              <Link href="/dashboard/appointments">
                <Plus className="w-4 h-4 mr-2" />
                Book Your First Service
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Timeline */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest actions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          {completedAppointments.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-6">
                {completedAppointments
                  .slice(0, 5)
                  .map((appointment: RawAppointment, index: number) => {
                    const isCompleted = appointment.status === "completed";
                    return (
                      <div
                        key={appointment._id}
                        className="relative flex items-start gap-4 pl-1"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? "bg-accent/10 text-accent"
                              : "bg-yellow-100 text-yellow-600"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-sm">
                              {isCompleted
                                ? "Service Completed"
                                : `Service ${appointment.status.replace("_", " ")}`}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDateString(appointment.scheduledDate)}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {appointment.serviceIds?.length || 0} service
                            {(appointment.serviceIds?.length || 0) !== 1
                              ? "s"
                              : ""}{" "}
                            · ${appointment.totalPrice || 0}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
              <p className="text-muted-foreground">
                Your recent bookings and reviews will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
