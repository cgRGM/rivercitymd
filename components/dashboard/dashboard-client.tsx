"use client";

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
import {
  Calendar,
  Car,
  Star,
  Clock,
  MapPin,
  Plus,
  AlertCircle,
} from "lucide-react";

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

export default function DashboardClient() {
  const { isAuthenticated } = useConvexAuth();
  const upcomingAppointmentsQuery = useQuery(api.appointments.getUpcoming);
  const currentUserQuery = useQuery(api.users.getCurrentUser);
  const userVehiclesQuery = useQuery(api.vehicles.getMyVehicles);
  const userAppointmentsQuery = useQuery(api.appointments.getUserAppointments);

  // Handle unauthenticated state
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
              <a href="/sign-in">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle loading state
  if (
    upcomingAppointmentsQuery === undefined ||
    currentUserQuery === undefined ||
    userVehiclesQuery === undefined ||
    userAppointmentsQuery === undefined
  ) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Section Skeleton */}
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Quick Stats Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-fade-in-up">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="w-4 h-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upcoming Bookings Skeleton */}
        <Card className="animate-fade-in-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-40 mb-2" />
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
      </div>
    );
  }

  // Handle error states
  if (
    upcomingAppointmentsQuery === null ||
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

  const upcomingAppointments = upcomingAppointmentsQuery;
  const currentUser = currentUserQuery;
  const userVehicles = userVehiclesQuery;
  const completedAppointments = userAppointmentsQuery.past || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold">
          Welcome back{currentUser?.name ? `, ${currentUser.name}` : ""}!
        </h2>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening with your vehicles
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming Bookings
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingAppointments.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingAppointments.length > 0
                ? `Next: ${upcomingAppointments[0]?.scheduledDate}`
                : "No upcoming bookings"}
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Vehicles
            </CardTitle>
            <Car className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userVehicles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All vehicles registered
            </p>
          </CardContent>
        </Card>

        <Card
          className="animate-fade-in-up"
          style={{ animationDelay: "100ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Services
            </CardTitle>
            <Star className="w-4 h-4 text-muted-foreground" />
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

      {/* Upcoming Bookings */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upcoming Bookings</CardTitle>
              <CardDescription>Your scheduled appointments</CardDescription>
            </div>
            <Button className="hidden sm:flex">
              <Plus className="w-4 h-4 mr-2" />
              Book Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appointment: RawAppointment) => (
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
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                          {appointment.status}
                        </span>
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
                        <span>{appointment.scheduledDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{appointment.scheduledTime}</span>
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
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No upcoming bookings
                </h3>
                <p className="text-muted-foreground mb-4">
                  You don&apos;t have any upcoming appointments scheduled.
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Book Your First Service
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest actions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {completedAppointments.length > 0 ? (
              completedAppointments
                .slice(0, 5)
                .map((appointment: RawAppointment) => (
                  <div key={appointment._id} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Service Completed</div>
                      <div className="text-sm text-muted-foreground break-words">
                        {appointment.serviceIds?.length || 0} services completed
                        on {appointment.scheduledDate}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground shrink-0">
                      {new Date(appointment._creationTime).toLocaleDateString()}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
                <p className="text-muted-foreground">
                  Your recent bookings and reviews will appear here.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
