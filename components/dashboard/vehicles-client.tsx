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
import { Plus, Trash2, Calendar, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";

type Vehicle = {
  _id: Id<"vehicles">;
  userId: Id<"users">;
  year: number;
  make: string;
  model: string;
  color?: string;
  licensePlate?: string;
  notes?: string;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface VehiclesClientProps {}

export default function VehiclesClient({}: VehiclesClientProps) {
  const { isAuthenticated } = useConvexAuth();

  // Always call hooks at the top level - never conditionally
  const vehiclesQuery = useQuery(api.vehicles.getMyVehicles);
  const currentUser = useQuery(api.users.getCurrentUser);
  const userAppointments =
    useQuery(
      api.appointments.getByUser,
      currentUser?._id ? { userId: currentUser._id } : "skip",
    ) || [];

  const [isAddOpen, setIsAddOpen] = useState(false);

  const [formData, setFormData] = useState({
    year: "",
    make: "",
    model: "",
    color: "",
    licensePlate: "",
    notes: "",
  });

  const createVehicle = useMutation(api.vehicles.create);
  const deleteVehicle = useMutation(api.vehicles.deleteVehicle);

  // Handle unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Vehicles</h2>
          <p className="text-muted-foreground mt-1">
            Manage your vehicle information and service history
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Authentication Required
            </h3>
            <p className="text-muted-foreground mb-6">
              Please sign in to manage your vehicles.
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
  if (vehiclesQuery === undefined || currentUser === undefined) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">My Vehicles</h2>
            <p className="text-muted-foreground mt-1">
              Manage your vehicle information
            </p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
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
  if (vehiclesQuery === null || currentUser === null) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Vehicles</h2>
          <p className="text-muted-foreground mt-1">
            Manage your vehicle information
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load vehicles
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading your vehicles. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const vehicles = vehiclesQuery;

  const getVehicleStats = (vehicleId: string) => {
    const vehicleAppointments = userAppointments.filter((apt) =>
      apt.vehicleIds.includes(vehicleId as Id<"vehicles">),
    );
    const completedAppointments = vehicleAppointments.filter(
      (apt) => apt.status === "completed",
    );
    const lastService =
      completedAppointments.length > 0
        ? completedAppointments.sort(
            (a, b) =>
              new Date(b.scheduledDate).getTime() -
              new Date(a.scheduledDate).getTime(),
          )[0].scheduledDate
        : null;

    return {
      totalServices: completedAppointments.length,
      lastService: lastService
        ? new Date(lastService).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "No services yet",
    };
  };

  const handleAddVehicle = async () => {
    if (!currentUser?._id) return;

    try {
      await createVehicle({
        userId: currentUser._id,
        year: parseInt(formData.year),
        make: formData.make,
        model: formData.model,
        color: formData.color || undefined,
        licensePlate: formData.licensePlate || undefined,
        notes: formData.notes || undefined,
      });

      toast.success("Vehicle added successfully");
      setIsAddOpen(false);
      setFormData({
        year: "",
        make: "",
        model: "",
        color: "",
        licensePlate: "",
        notes: "",
      });
    } catch {
      toast.error("Failed to add vehicle");
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    try {
      await deleteVehicle({ id: vehicleId as Id<"vehicles"> });
      toast.success("Vehicle deleted successfully");
    } catch {
      toast.error("Failed to delete vehicle");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">My Vehicles</h2>
          <p className="text-muted-foreground">
            Manage your vehicle information
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
              <DialogDescription>
                Enter your vehicle details to add it to your garage
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    placeholder="2024"
                    value={formData.year}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, year: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    placeholder="Toyota"
                    value={formData.make}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, make: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="Camry"
                  value={formData.model}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, model: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="Silver"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licensePlate">License Plate</Label>
                <Input
                  id="licensePlate"
                  placeholder="ABC-123"
                  value={formData.licensePlate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      licensePlate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Any special notes about this vehicle"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAddVehicle}
                disabled={!formData.year || !formData.make || !formData.model}
              >
                Add Vehicle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vehicle Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {vehicles.map((vehicle: Vehicle, index: number) => {
          const stats = getVehicleStats(vehicle._id);
          return (
            <Card
              key={vehicle._id}
              className="animate-fade-in-up hover:shadow-lg transition-all"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {vehicle.color && `${vehicle.color} • `}
                      {vehicle.licensePlate && `Plate: ${vehicle.licensePlate}`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteVehicle(vehicle._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Last Service
                    </div>
                    <div className="font-semibold flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {stats.lastService}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Total Services
                    </div>
                    <div className="font-semibold text-center mt-1">
                      {stats.totalServices}
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-transparent" variant="outline">
                  Book Service for This Vehicle
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {vehicles.length === 0 && (
        <Card className="animate-fade-in-up">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No vehicles yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first vehicle to start booking services
            </p>
            <Button onClick={() => setIsAddOpen(true)}>
              Add Your First Vehicle
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
