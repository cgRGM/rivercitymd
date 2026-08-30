import * as React from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import { Calendar, CalendarDays, Clock, DollarSign, MapPin, Plus, RefreshCw, X } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { THEME } from "@/lib/theme";

function formatDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function AppointmentsScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const appointments = useQuery(api.appointments.list, currentUser ? {} : "skip");
  const rescheduleMutation = useMutation(api.appointments.reschedule);
  const updateStatusMutation = useMutation(api.appointments.updateStatus);

  const [activeTab, setActiveTab] = React.useState<"upcoming" | "past">("upcoming");
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<Id<"appointments"> | null>(null);
  const [rescheduleDate, setRescheduleDate] = React.useState("");
  const [rescheduleTime, setRescheduleTime] = React.useState("");
  const [isRescheduling, setIsRescheduling] = React.useState(false);

  const now = Date.now();
  const upcomingAppointments = appointments
    ?.filter(
      (a) =>
        a.status !== "completed" &&
        a.status !== "cancelled" &&
        new Date(`${a.scheduledDate}T${a.scheduledTime}`).getTime() >= now,
    )
    .sort((a, b) => `${a.scheduledDate}T${a.scheduledTime}`.localeCompare(`${b.scheduledDate}T${b.scheduledTime}`));

  const pastAppointments = appointments
    ?.filter(
      (a) =>
        a.status === "completed" ||
        a.status === "cancelled" ||
        new Date(`${a.scheduledDate}T${a.scheduledTime}`).getTime() < now,
    )
    .sort((a, b) => `${b.scheduledDate}T${b.scheduledTime}`.localeCompare(`${a.scheduledDate}T${a.scheduledTime}`));

  const displayedList = activeTab === "upcoming" ? upcomingAppointments : pastAppointments;

  const handleCancelAppointment = (id: Id<"appointments">) => {
    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this detailing appointment?",
      [
        { text: "Keep Appointment", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateStatusMutation({ appointmentId: id, status: "cancelled" });
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Failed to cancel appointment";
              Alert.alert("Error", msg);
            }
          },
        },
      ],
    );
  };

  const handleConfirmReschedule = async () => {
    if (!selectedAppointmentId || !rescheduleDate || !rescheduleTime) {
      Alert.alert("Incomplete", "Please pick a new date and time slot.");
      return;
    }

    setIsRescheduling(true);
    try {
      await rescheduleMutation({
        appointmentId: selectedAppointmentId,
        newDate: rescheduleDate,
        newTime: rescheduleTime,
      });
      setSelectedAppointmentId(null);
      setRescheduleDate("");
      setRescheduleTime("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reschedule";
      Alert.alert("Reschedule Conflict", msg);
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <ScreenHeader
          eyebrow="Customer Portal"
          title="Appointments"
          description="Your mobile detailing service schedule."
        />
      </View>

      <View className="flex-row items-center justify-between">
        {/* Tab switch */}
        <View className="flex-row rounded-xl bg-secondary p-1">
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab("upcoming")}
            className={`rounded-lg px-4 py-1.5 ${
              activeTab === "upcoming" ? "bg-card shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === "upcoming" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Upcoming ({upcomingAppointments?.length || 0})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab("past")}
            className={`rounded-lg px-4 py-1.5 ${
              activeTab === "past" ? "bg-card shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === "past" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Past ({pastAppointments?.length || 0})
            </Text>
          </Pressable>
        </View>

        <Button
          size="sm"
          onPress={() => router.push("/book")}
          className="flex-row items-center gap-1.5"
        >
          <Plus size={14} color={THEME.light.primaryForeground} />
          <Text className="text-xs font-bold text-primary-foreground">Book</Text>
        </Button>
      </View>

      {displayedList?.length ? (
        <View className="gap-3">
          {displayedList.map((appointment) => (
            <Card key={appointment._id} className="border border-border">
              <CardContent className="gap-4 p-4">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1 gap-1">
                    <Text className="text-lg font-bold">
                      {formatDate(appointment.scheduledDate)}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Clock size={13} color={THEME.light.mutedForeground} />
                      <Text className="text-xs text-muted-foreground">
                        {appointment.scheduledTime} · {appointment.duration} mins
                      </Text>
                    </View>
                  </View>
                  <StatusPill status={appointment.status} />
                </View>

                <View className="gap-2 border-t border-border pt-3">
                  <View className="flex-row items-center gap-2">
                    <MapPin size={15} color={THEME.light.mutedForeground} />
                    <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={1}>
                      {appointment.location.street}, {appointment.location.city}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <CalendarDays size={15} color={THEME.light.mutedForeground} />
                      <Text className="text-sm text-muted-foreground">
                        {appointment.vehicleIds.length} vehicle
                        {appointment.vehicleIds.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Text className="text-base font-extrabold text-accent">
                      ${appointment.totalPrice.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Actions for upcoming appointments */}
                {activeTab === "upcoming" &&
                appointment.status !== "cancelled" &&
                appointment.status !== "completed" ? (
                  <View className="flex-row gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setSelectedAppointmentId(appointment._id);
                        setRescheduleDate(appointment.scheduledDate);
                        setRescheduleTime(appointment.scheduledTime);
                      }}
                      className="flex-1 flex-row items-center justify-center gap-1.5"
                    >
                      <RefreshCw size={13} color={THEME.light.foreground} />
                      <Text className="text-xs font-semibold">Reschedule</Text>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => handleCancelAppointment(appointment._id)}
                      className="flex-1 flex-row items-center justify-center gap-1.5 text-destructive active:bg-destructive/10"
                    >
                      <X size={13} color={THEME.light.destructive} />
                      <Text className="text-xs font-semibold text-destructive">Cancel</Text>
                    </Button>
                  </View>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title={activeTab === "upcoming" ? "No upcoming details" : "No past services"}
          description={
            activeTab === "upcoming"
              ? "Book a mobile detail and we'll come directly to your driveway."
              : "Completed appointment records will be saved here."
          }
        />
      )}

      {/* Reschedule Modal */}
      <Modal
        visible={Boolean(selectedAppointmentId)}
        onClose={() => setSelectedAppointmentId(null)}
        title="Reschedule Appointment"
        description="Pick a new date and time that fits your schedule."
      >
        <View className="gap-4">
          <TimeSlotPicker
            selectedDate={rescheduleDate}
            onDateChange={setRescheduleDate}
            selectedTime={rescheduleTime}
            onTimeChange={setRescheduleTime}
            duration={60}
          />

          <View className="flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onPress={() => setSelectedAppointmentId(null)}
              className="flex-1"
              disabled={isRescheduling}
            >
              <Text className="font-semibold">Keep Current</Text>
            </Button>
            <Button
              variant="default"
              onPress={handleConfirmReschedule}
              className="flex-2"
              disabled={isRescheduling || !rescheduleDate || !rescheduleTime}
            >
              {isRescheduling ? (
                <ActivityIndicator size="small" color={THEME.light.primaryForeground} />
              ) : (
                <Text className="font-bold text-primary-foreground">Confirm New Time</Text>
              )}
            </Button>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
