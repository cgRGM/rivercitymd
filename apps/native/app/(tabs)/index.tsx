import { api } from "@rivercitymd/backend/convex/_generated/api";
import { useUser } from "@clerk/expo";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { CalendarDays, CarFront, CheckCircle2, Clock, MapPin, Plus, Sparkles } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { BrandMark } from "@/components/brand-mark";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { THEME } from "@/lib/theme";

function formatAppointmentDate(date: string, time: string) {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) return `${date} · ${time}`;
  return value.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function OverviewScreen() {
  const { user } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const appointments = useQuery(api.appointments.list, currentUser ? {} : "skip");
  const nextAppointment = appointments
    ?.filter(
      (appointment) =>
        appointment.status !== "cancelled" &&
        appointment.status !== "completed" &&
        new Date(`${appointment.scheduledDate}T${appointment.scheduledTime}`).getTime() >=
          Date.now(),
    )
    .sort((a, b) =>
      `${a.scheduledDate}T${a.scheduledTime}`.localeCompare(
        `${b.scheduledDate}T${b.scheduledTime}`,
      ),
    )[0];

  const displayName = currentUser?.name || user?.firstName || "there";

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <BrandMark />
          <View className="gap-0.5">
            <Text className="text-xs font-bold tracking-wider text-muted-foreground">
              RiverCityMD
            </Text>
            <Text className="text-base font-semibold">Customer Portal</Text>
          </View>
        </View>
        <View className="h-2.5 w-2.5 rounded-full bg-accent" />
      </View>

      <ScreenHeader
        eyebrow="Mobile Detailing Service"
        title={`Good morning, ${displayName.split(" ")[0]}.`}
        description="We bring showroom-level mobile car detailing straight to your driveway."
      />

      {/* Primary Action Card */}
      <Card className="overflow-hidden border-0 bg-primary">
        <CardHeader className="gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <Sparkles size={20} color={THEME.light.accentForeground} />
          </View>
          <CardTitle className="text-xl text-primary-foreground">Ready for a detail?</CardTitle>
          <CardDescription className="text-primary-foreground/70">
            Book in 2 minutes. We bring pure water, power, and high-end detailing to your home or office.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-row gap-3">
          <Button
            variant="secondary"
            onPress={() => router.push("/book")}
            className="flex-row items-center gap-2"
          >
            <Plus size={16} color={THEME.light.secondaryForeground} />
            <Text className="font-bold">Book Detail Now</Text>
          </Button>
          <Button
            variant="outline"
            onPress={() => router.push("/(tabs)/appointments")}
            className="border-primary-foreground/20 bg-transparent active:bg-primary-foreground/10"
          >
            <Text className="text-primary-foreground">Schedule</Text>
          </Button>
        </CardContent>
      </Card>

      {/* Next Appointment Spotlight */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="h3" className="text-xl font-bold">Next Appointment</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/appointments")}
            className="rounded-full px-2 py-1 active:bg-secondary"
          >
            <Text className="text-sm font-semibold text-accent">View all</Text>
          </Pressable>
        </View>

        {nextAppointment ? (
          <Card className="border border-border">
            <CardContent className="gap-4 py-5">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-bold">
                    {formatAppointmentDate(
                      nextAppointment.scheduledDate,
                      nextAppointment.scheduledTime,
                    )}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <Clock size={14} color={THEME.light.mutedForeground} />
                    <Text className="text-sm text-muted-foreground">
                      {nextAppointment.scheduledTime} · {nextAppointment.duration} mins
                    </Text>
                  </View>
                </View>
                <Badge
                  variant={nextAppointment.status === "confirmed" ? "success" : "warning"}
                  size="default"
                  label={nextAppointment.status === "confirmed" ? "Confirmed" : "Pending"}
                />
              </View>
              <View className="flex-row items-center gap-2 border-t border-border pt-3">
                <MapPin size={16} color={THEME.light.mutedForeground} />
                <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={1}>
                  {nextAppointment.location.street}, {nextAppointment.location.city}
                </Text>
              </View>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="gap-3 py-5">
              <Text className="font-semibold">Nothing on the calendar yet</Text>
              <Text className="text-sm leading-5 text-muted-foreground">
                Your next detail will appear here once booked.
              </Text>
              <Button onPress={() => router.push("/book")} className="self-start">
                <Text className="font-bold text-primary-foreground">Start a Booking</Text>
              </Button>
            </CardContent>
          </Card>
        )}
      </View>

      {/* Quick Access */}
      <View className="gap-3">
        <Text variant="h3" className="text-xl font-bold">Quick Access</Text>
        <View className="flex-row gap-3">
          <QuickAccess
            icon={<CalendarDays size={21} color={THEME.light.accent} />}
            label="Appointments"
            onPress={() => router.push("/(tabs)/appointments")}
          />
          <QuickAccess
            icon={<CarFront size={21} color={THEME.light.accent} />}
            label="My Garage"
            onPress={() => router.push("/(tabs)/vehicles")}
          />
        </View>
      </View>
    </Screen>
  );
}

function QuickAccess({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-28 flex-1 gap-3 rounded-2xl border border-border bg-card p-4 active:bg-secondary"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/10">{icon}</View>
      <Text className="text-sm font-semibold">{label}</Text>
    </Pressable>
  );
}
