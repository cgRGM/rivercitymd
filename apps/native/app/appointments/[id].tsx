import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal as RNModal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CarFront,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react-native";

import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { TimeSlotPicker } from "@/components/forms/time-slot-picker";
import { THEME } from "@/lib/theme";

export default function AppointmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointment = useQuery(
    api.appointments.getByIdWithDetails,
    id ? { appointmentId: id as Id<"appointments"> } : "skip",
  );

  const rescheduleAppointment = useMutation(api.appointments.reschedule);
  const updateAppointmentStatus = useMutation(api.appointments.updateStatus);

  const [isRescheduling, setIsRescheduling] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState<string>("");
  const [newTime, setNewTime] = React.useState<string>("");

  const handleOpenInvoice = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open invoice URL in browser.");
    }
  };

  const handleCancelAppointment = () => {
    if (!appointment) return;
    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this detailing appointment? Deposits are non-refundable.",
      [
        { text: "Keep Appointment", style: "cancel" },
        {
          text: "Cancel Appointment",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              await updateAppointmentStatus({
                appointmentId: appointment._id,
                status: "cancelled",
              });
              Alert.alert("Appointment Cancelled", "Your appointment has been cancelled.");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Failed to cancel appointment";
              Alert.alert("Error", msg);
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleConfirmReschedule = async () => {
    if (!appointment || !newDate || !newTime) return;
    setIsRescheduling(true);
    try {
      await rescheduleAppointment({
        appointmentId: appointment._id,
        newDate,
        newTime,
      });
      setIsRescheduleModalOpen(false);
      Alert.alert("Appointment Rescheduled", `Your new appointment is set for ${newDate} at ${newTime}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reschedule appointment";
      Alert.alert("Error", msg);
    } finally {
      setIsRescheduling(false);
    }
  };

  if (appointment === undefined) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="small" color={THEME.light.accent} />
          <Text className="text-xs text-muted-foreground mt-2">Loading appointment details...</Text>
        </View>
      </Screen>
    );
  }

  if (appointment === null) {
    return (
      <Screen>
        <View className="items-center justify-center py-20 gap-3">
          <Calendar size={36} color={THEME.light.mutedForeground} />
          <Text className="text-base font-bold">Appointment Not Found</Text>
          <Text className="text-xs text-muted-foreground">This appointment may have been deleted.</Text>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  const invoice = appointment.invoice;
  const isDepositPaid = Boolean(invoice?.depositPaid);
  const isPaidInFull = invoice?.status === "paid" || (invoice?.remainingBalance ?? 1) <= 0;
  const remainingDue = invoice?.remainingBalance ?? (isDepositPaid ? Math.max(0, appointment.totalPrice - 50) : appointment.totalPrice);
  const stripeInvoiceUrl = invoice?.stripeInvoiceUrl;

  return (
    <Screen>
      {/* Top Bar */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="flex-row items-center gap-2 rounded-full px-2 py-1 active:bg-secondary"
        >
          <ArrowLeft size={20} color={THEME.light.foreground} />
          <Text className="text-sm font-semibold">Appointments</Text>
        </Pressable>

        <Badge
          variant={
            appointment.status === "completed"
              ? "success"
              : appointment.status === "confirmed"
                ? "accent"
                : appointment.status === "in_progress"
                  ? "secondary"
                  : appointment.status === "cancelled"
                    ? "destructive"
                    : "warning"
          }
          size="default"
          label={appointment.status.toUpperCase()}
        />
      </View>

      {/* Date & Time Header */}
      <Card className="border border-border overflow-hidden">
        <CardContent className="p-5 gap-4">
          <View className="flex-row items-center gap-3.5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
              <Calendar size={24} color={THEME.light.accent} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-xl font-bold">{appointment.scheduledDate}</Text>
              <View className="flex-row items-center gap-2">
                <Clock size={14} color={THEME.light.mutedForeground} />
                <Text className="text-sm text-muted-foreground">
                  {appointment.scheduledTime} · {appointment.duration} minutes
                </Text>
              </View>
            </View>
          </View>

          {/* Service Location */}
          <View className="border-t border-border/60 pt-3 flex-row items-start gap-2.5">
            <MapPin size={16} color={THEME.light.mutedForeground} className="mt-0.5" />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold">
                {appointment.location.street}, {appointment.location.city}, {appointment.location.state} {appointment.location.zip}
              </Text>
              {appointment.location.notes ? (
                <Text className="text-xs text-muted-foreground">Note: {appointment.location.notes}</Text>
              ) : null}
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Vehicles & Services */}
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vehicles & Services</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          {appointment.vehicles.map((v: any, index: number) => (
            <View
              key={v._id || index}
              className={`gap-1.5 ${index > 0 ? "border-t border-border/50 pt-2.5" : ""}`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <CarFront size={16} color={THEME.light.accent} />
                  <Text className="font-bold text-sm">
                    {v.year} {v.make} {v.model}
                  </Text>
                </View>
                <Badge variant="outline" size="sm" label={v.vehicleType?.name || v.size || "Standard"} />
              </View>

              {/* Matched services */}
              <View className="pl-6 gap-1">
                {appointment.services.map((s: any) => (
                  <View key={s._id} className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground">• {s.name}</Text>
                    <Text className="text-xs font-semibold">
                      ${((s as any).effectivePrice || s.basePrice).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {appointment.travelFee && appointment.travelFee > 0 ? (
            <View className="flex-row items-center justify-between border-t border-border/50 pt-2">
              <Text className="text-xs text-muted-foreground">Arkansas Travel Fee</Text>
              <Text className="text-xs font-semibold">${appointment.travelFee.toFixed(2)}</Text>
            </View>
          ) : null}
        </CardContent>
      </Card>

      {/* Payment & Invoice Breakdown */}
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payment & Invoicing</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">Total Service Price</Text>
            <Text className="text-base font-bold">${appointment.totalPrice.toFixed(2)}</Text>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <CheckCircle2
                size={15}
                color={isDepositPaid ? "#16a34a" : THEME.light.mutedForeground}
              />
              <Text className="text-sm text-muted-foreground">Deposit Paid (Stripe)</Text>
            </View>
            <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {isDepositPaid ? "$50.00 Paid" : "Pending"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between border-t border-border/60 pt-2.5">
            <View className="gap-0.5">
              <Text className="text-sm font-bold">Remaining Balance</Text>
              <Text className="text-xs text-muted-foreground">
                {isPaidInFull ? "Paid in full" : "Due upon completion"}
              </Text>
            </View>
            <Text className="text-lg font-extrabold text-primary">
              ${Math.max(0, remainingDue).toFixed(2)}
            </Text>
          </View>

          {/* Stripe Invoice Link Button */}
          {stripeInvoiceUrl ? (
            <Button
              variant="outline"
              size="sm"
              onPress={() => void handleOpenInvoice(stripeInvoiceUrl)}
              className="flex-row items-center justify-center gap-2 mt-1"
            >
              <FileText size={15} color={THEME.light.foreground} />
              <Text className="text-xs font-semibold">View Stripe Hosted Invoice</Text>
              <ExternalLink size={13} color={THEME.light.mutedForeground} />
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Action Buttons (Reschedule & Cancel) */}
      {appointment.status !== "completed" && appointment.status !== "cancelled" ? (
        <View className="gap-2.5 pt-1">
          <Button
            variant="outline"
            size="lg"
            onPress={() => {
              setNewDate(appointment.scheduledDate);
              setNewTime(appointment.scheduledTime);
              setIsRescheduleModalOpen(true);
            }}
            className="w-full flex-row items-center justify-center gap-2"
          >
            <RotateCcw size={16} color={THEME.light.foreground} />
            <Text className="font-semibold">Reschedule Appointment</Text>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onPress={handleCancelAppointment}
            disabled={isCancelling}
            className="w-full flex-row items-center justify-center gap-1.5"
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={THEME.light.destructive} />
            ) : (
              <>
                <XCircle size={15} color={THEME.light.destructive} />
                <Text className="text-xs font-semibold text-destructive">Cancel Appointment</Text>
              </>
            )}
          </Button>
        </View>
      ) : null}

      {/* Reschedule Modal */}
      <RNModal
        visible={isRescheduleModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRescheduleModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-background rounded-t-3xl p-5 gap-4 max-h-[85%] border-t border-border">
            <View className="flex-row items-center justify-between">
              <View className="gap-0.5">
                <Text className="text-lg font-bold">Reschedule Appointment</Text>
                <Text className="text-xs text-muted-foreground">
                  Select a new date and time slot for your detail.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsRescheduleModalOpen(false)}
                className="rounded-full p-1.5 active:bg-secondary"
              >
                <X size={20} color={THEME.light.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="gap-4">
              <TimeSlotPicker
                durationMinutes={appointment.duration}
                selectedDate={newDate || appointment.scheduledDate}
                selectedTime={newTime || appointment.scheduledTime}
                onSelectDate={setNewDate}
                onSelectTime={setNewTime}
                ignoreAppointmentId={appointment._id}
              />
            </ScrollView>

            <View className="flex-row gap-3 pt-2 border-t border-border">
              <Button
                variant="outline"
                onPress={() => setIsRescheduleModalOpen(false)}
                className="flex-1"
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                variant="default"
                onPress={() => void handleConfirmReschedule()}
                disabled={!newDate || !newTime || isRescheduling}
                className="flex-2"
              >
                {isRescheduling ? (
                  <ActivityIndicator size="small" color={THEME.light.primaryForeground} />
                ) : (
                  <Text className="font-bold text-primary-foreground">Confirm New Time</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </RNModal>
    </Screen>
  );
}
