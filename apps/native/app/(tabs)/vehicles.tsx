import { api } from "@rivercitymd/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { CarFront, Palette } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function VehiclesScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const vehicles = useQuery(
    api.vehicles.getByUser,
    currentUser ? { userId: currentUser._id } : "skip",
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Your garage"
        title="Vehicles"
        description="Keep your vehicle details ready for a faster booking."
      />

      {vehicles?.length ? (
        <View className="gap-3">
          {vehicles.map((vehicle) => (
            <Card key={vehicle._id}>
              <CardContent className="flex-row items-center gap-4 py-5">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                  <CarFront size={24} color={THEME.light.accent} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-semibold">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {vehicle.vehicleType?.name || vehicle.size || "Vehicle details"}
                  </Text>
                  {vehicle.color ? (
                    <View className="flex-row items-center gap-1.5">
                      <Palette size={13} color={THEME.light.mutedForeground} />
                      <Text className="text-xs text-muted-foreground">{vehicle.color}</Text>
                    </View>
                  ) : null}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Your garage is empty"
          description="Add a vehicle during your next booking so we can tailor the service to it."
        />
      )}
    </Screen>
  );
}
