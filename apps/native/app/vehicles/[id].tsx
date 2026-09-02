import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Palette,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react-native";

import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function VehicleDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useQuery(
    api.vehicles.getById,
    id ? { id: id as Id<"vehicles"> } : "skip",
  );
  const deleteVehicle = useMutation(api.vehicles.deleteVehicle);

  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = () => {
    if (!vehicle) return;
    Alert.alert(
      "Remove Vehicle",
      `Are you sure you want to remove your ${vehicle.year} ${vehicle.make} ${vehicle.model} from your garage?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteVehicle({ id: vehicle._id });
              router.back();
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Failed to remove vehicle";
              Alert.alert("Error", msg);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (vehicle === undefined) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="small" color={THEME.light.accent} />
          <Text className="text-xs text-muted-foreground mt-2">Loading vehicle details...</Text>
        </View>
      </Screen>
    );
  }

  if (vehicle === null) {
    return (
      <Screen>
        <View className="items-center justify-center py-20 gap-3">
          <CarFront size={36} color={THEME.light.mutedForeground} />
          <Text className="text-base font-bold">Vehicle Not Found</Text>
          <Text className="text-xs text-muted-foreground">This vehicle may have been removed.</Text>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Top Header */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="flex-row items-center gap-2 rounded-full px-2 py-1 active:bg-secondary"
        >
          <ArrowLeft size={20} color={THEME.light.foreground} />
          <Text className="text-sm font-semibold">My Garage</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handleDelete}
          disabled={isDeleting}
          className="h-9 w-9 items-center justify-center rounded-full bg-destructive/10 active:bg-destructive/20"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={THEME.light.destructive} />
          ) : (
            <Trash2 size={16} color={THEME.light.destructive} />
          )}
        </Pressable>
      </View>

      {/* Hero Vehicle Card */}
      <Card className="border border-border overflow-hidden">
        <CardContent className="p-5 gap-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-row items-center gap-3.5 flex-1">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <CarFront size={28} color={THEME.light.accent} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-xl font-bold">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Text>
                <View className="flex-row items-center gap-2 flex-wrap">
                  {vehicle.vehicleType?.name || vehicle.size ? (
                    <Badge
                      variant="accent"
                      size="sm"
                      label={vehicle.vehicleType?.name || vehicle.size?.toUpperCase() || "Standard"}
                    />
                  ) : null}
                  {vehicle.color ? (
                    <View className="flex-row items-center gap-1">
                      <Palette size={13} color={THEME.light.mutedForeground} />
                      <Text className="text-xs text-muted-foreground">{vehicle.color}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {/* Quick specs pill row */}
          <View className="flex-row items-center justify-between border-t border-border/60 pt-3">
            <View className="gap-0.5">
              <Text className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Pricing Class
              </Text>
              <Text className="text-sm font-bold">
                {vehicle.vehicleType?.name || "Standard Class"}
              </Text>
            </View>

            {vehicle.licensePlate ? (
              <View className="gap-0.5 items-end">
                <Text className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Plate
                </Text>
                <Text className="text-sm font-bold">{vehicle.licensePlate}</Text>
              </View>
            ) : null}
          </View>
        </CardContent>
      </Card>

      {/* Action: Book Detail for this vehicle */}
      <Button
        variant="default"
        size="lg"
        onPress={() => router.push("/book")}
        className="w-full flex-row items-center justify-center gap-2"
      >
        <Sparkles size={18} color={THEME.light.primaryForeground} />
        <Text className="font-bold text-primary-foreground">Book a Detail for this Car</Text>
      </Button>

      {/* Service History */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="h3" className="text-lg font-bold">Service History</Text>
          <Text className="text-xs font-semibold text-muted-foreground">
            {vehicle.appointments?.length || 0} session(s)
          </Text>
        </View>

        {vehicle.appointments && vehicle.appointments.length > 0 ? (
          <View className="gap-2.5">
            {vehicle.appointments.map((app) => (
              <Pressable
                key={app._id}
                accessibilityRole="button"
                onPress={() => router.push(`/appointments/${app._id}`)}
                className="active:opacity-90"
              >
                <Card className="border border-border">
                  <CardContent className="p-4 flex-row items-center justify-between">
                    <View className="gap-1 flex-1 mr-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="font-bold text-sm">
                          {app.scheduledDate} · {app.scheduledTime}
                        </Text>
                        <Badge
                          variant={
                            app.status === "completed"
                              ? "success"
                              : app.status === "confirmed"
                                ? "accent"
                                : "warning"
                          }
                          size="sm"
                          label={app.status}
                        />
                      </View>
                      <Text className="text-xs text-muted-foreground">
                        {app.location.street}, {app.location.city} · ${app.totalPrice.toFixed(2)}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={THEME.light.mutedForeground} />
                  </CardContent>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-5 items-center justify-center gap-1.5">
              <Clock size={24} color={THEME.light.mutedForeground} />
              <Text className="font-bold text-sm">No service history yet</Text>
              <Text className="text-xs text-muted-foreground text-center">
                Appointments booked for this vehicle will appear here with service records.
              </Text>
            </CardContent>
          </Card>
        )}
      </View>
    </Screen>
  );
}
