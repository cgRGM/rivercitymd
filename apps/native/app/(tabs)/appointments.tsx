import { api } from "@rivercitymd/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { CalendarDays, MapPin } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

function formatDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function AppointmentsScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const appointments = useQuery(api.appointments.list, currentUser ? {} : "skip");
  const orderedAppointments = appointments
    ?.slice()
    .sort((a, b) =>
      `${a.scheduledDate}T${a.scheduledTime}`.localeCompare(
        `${b.scheduledDate}T${b.scheduledTime}`,
      ),
    );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Customer portal"
        title="Appointments"
        description="Your service schedule, all in one place."
      />

      {orderedAppointments?.length ? (
        <View className="gap-3">
          {orderedAppointments.map((appointment) => (
            <Card key={appointment._id}>
              <CardContent className="gap-4 py-5">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1 gap-1">
                    <Text className="text-lg font-semibold">{formatDate(appointment.scheduledDate)}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {appointment.scheduledTime} · {appointment.duration} minutes
                    </Text>
                  </View>
                  <StatusPill status={appointment.status} />
                </View>
                <View className="gap-2">
                  <View className="flex-row items-center gap-2">
                    <MapPin size={16} color={THEME.light.mutedForeground} />
                    <Text className="flex-1 text-sm text-muted-foreground">
                      {appointment.location.street}, {appointment.location.city}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <CalendarDays size={16} color={THEME.light.mutedForeground} />
                    <Text className="text-sm text-muted-foreground">
                      {appointment.vehicleIds.length} vehicle
                      {appointment.vehicleIds.length === 1 ? "" : "s"} · ${appointment.totalPrice.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No appointments yet"
          description="When you book a detail, your upcoming and past services will show up here."
        />
      )}
    </Screen>
  );
}
