import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Sun,
  Sunrise,
} from "lucide-react-native";

import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { THEME } from "@/lib/theme";

import type { Id } from "@rivercitymd/backend/convex/_generated/dataModel";

export interface TimeSlotPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange?: (date: string) => void;
  onSelectDate?: (date: string) => void;
  selectedTime: string; // HH:MM
  onTimeChange?: (time: string) => void;
  onSelectTime?: (time: string) => void;
  duration?: number;
  durationMinutes?: number;
  ignoreAppointmentId?: Id<"appointments">;
}

function getNextDays(count = 14) {
  const days: Array<{ date: string; dayOfWeek: string; dayNum: string; month: string }> = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    days.push({
      date: dateStr,
      dayOfWeek: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: String(d.getDate()),
      month: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  return days;
}

function formatTime12h(timeStr: string) {
  if (!timeStr) return "";
  const [hoursStr, minutesStr] = timeStr.split(":");
  const hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutesStr} ${ampm}`;
}

export function TimeSlotPicker({
  selectedDate,
  onDateChange,
  onSelectDate,
  selectedTime,
  onTimeChange,
  onSelectTime,
  duration,
  durationMinutes = 60,
  ignoreAppointmentId,
}: TimeSlotPickerProps) {
  const handleDateChange = onDateChange || onSelectDate || (() => {});
  const handleTimeChange = onTimeChange || onSelectTime || (() => {});
  const resolvedDuration = duration ?? durationMinutes;

  const [isPickerModalOpen, setIsPickerModalOpen] = React.useState(false);
  const days = React.useMemo(() => getNextDays(14), []);

  // Initialize selectedDate if empty
  React.useEffect(() => {
    if (!selectedDate && days.length > 0) {
      handleDateChange(days[0].date);
    }
  }, [selectedDate, days, handleDateChange]);

  const slotsQuery = useQuery(
    api.availability.getAvailableTimeSlots,
    selectedDate
      ? {
          date: selectedDate,
          serviceDuration: resolvedDuration,
          ignoreAppointmentId,
        }
      : "skip",
  );

  const isLoading = selectedDate ? slotsQuery === undefined : false;
  const rawSlots = slotsQuery || [];

  // Filter strictly for available slots and exclude past time slots for today
  const availableSlots = React.useMemo(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = String(now.getMonth() + 1).padStart(2, "0");
    const todayDay = String(now.getDate()).padStart(2, "0");
    const todayKey = `${todayYear}-${todayMonth}-${todayDay}`;
    const isToday = selectedDate === todayKey;

    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    return rawSlots.filter((slot) => {
      if (!slot.available) return false;
      if (isToday) {
        const [h, m] = slot.time.split(":").map(Number);
        const slotMinutes = h * 60 + m;
        // Require at least a 30-minute lead time for same-day booking
        return slotMinutes > currentTotalMinutes + 30;
      }
      return true;
    });
  }, [rawSlots, selectedDate]);

  // If selectedTime is in the past for today or not in availableSlots, clear it
  React.useEffect(() => {
    if (selectedTime && availableSlots.length > 0) {
      const isValid = availableSlots.some((s) => s.time === selectedTime);
      if (!isValid && !isLoading) {
        handleTimeChange("");
      }
    }
  }, [selectedDate, availableSlots, selectedTime, isLoading, handleTimeChange]);

  const morningSlots = React.useMemo(() => {
    return availableSlots.filter((s) => {
      const h = parseInt(s.time.split(":")[0], 10);
      return h < 12;
    });
  }, [availableSlots]);

  const afternoonSlots = React.useMemo(() => {
    return availableSlots.filter((s) => {
      const h = parseInt(s.time.split(":")[0], 10);
      return h >= 12;
    });
  }, [availableSlots]);

  return (
    <View className="gap-4">
      {/* Date Picker Horizontal Bar */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select Date
          </Text>
          {selectedDate ? (
            <Text className="text-xs font-semibold text-accent">
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-1"
          contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
        >
          {days.map((item) => {
            const isSelected = selectedDate === item.date;
            return (
              <Pressable
                key={item.date}
                accessibilityRole="button"
                onPress={() => {
                  handleDateChange(item.date);
                  handleTimeChange(""); // Reset selected time on date change
                }}
                className={`min-w-16 items-center justify-center rounded-2xl border px-3.5 py-3 ${
                  isSelected
                    ? "border-accent bg-accent"
                    : "border-border bg-card"
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.dayOfWeek}
                </Text>
                <Text
                  className={`my-0.5 text-xl font-bold ${
                    isSelected ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {item.dayNum}
                </Text>
                <Text
                  className={`text-[10px] ${
                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.month}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Dropdown Time Picker Trigger */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Arrival Time
          </Text>
          {resolvedDuration ? (
            <Badge variant="secondary" size="sm" label={`Est. ${resolvedDuration} mins`} />
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setIsPickerModalOpen(true)}
          disabled={isLoading || availableSlots.length === 0}
          className={`flex-row items-center justify-between rounded-2xl border p-4 active:bg-secondary/40 ${
            selectedTime
              ? "border-accent bg-accent/5"
              : availableSlots.length === 0
                ? "border-border bg-muted/40 opacity-70"
                : "border-border bg-card"
          }`}
        >
          <View className="flex-row items-center gap-3 flex-1">
            <View
              className={`h-10 w-10 items-center justify-center rounded-xl ${
                selectedTime ? "bg-accent" : "bg-secondary"
              }`}
            >
              <Clock
                size={20}
                color={
                  selectedTime
                    ? THEME.light.accentForeground
                    : THEME.light.foreground
                }
              />
            </View>

            <View className="flex-1">
              <Text className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                {selectedTime ? "Selected Arrival Time" : "Choose Start Window"}
              </Text>
              <Text className="text-base font-bold text-foreground">
                {isLoading
                  ? "Checking availability..."
                  : selectedTime
                    ? formatTime12h(selectedTime)
                    : availableSlots.length === 0
                      ? "No slots available today"
                      : `${availableSlots.length} available slots (Tap to choose)`}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {selectedTime ? (
              <Badge variant="accent" size="sm" label="Confirmed" />
            ) : (
              <ChevronDown size={20} color={THEME.light.mutedForeground} />
            )}
          </View>
        </Pressable>

        {/* Inline Quick-Select Pills if Time is Not Yet Selected */}
        {!selectedTime && availableSlots.length > 0 ? (
          <View className="mt-1 gap-2">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Select Available Hours:
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {availableSlots.slice(0, 6).map((slot) => (
                <Pressable
                  key={slot.time}
                  accessibilityRole="button"
                  onPress={() => handleTimeChange(slot.time)}
                  className="rounded-xl border border-border bg-card px-3.5 py-2 active:bg-secondary"
                >
                  <Text className="text-xs font-semibold text-foreground">
                    {formatTime12h(slot.time)}
                  </Text>
                </Pressable>
              ))}
              {availableSlots.length > 6 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsPickerModalOpen(true)}
                  className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 active:opacity-70"
                >
                  <Text className="text-xs font-bold text-accent">
                    +{availableSlots.length - 6} more
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* Full Time Slot Picker Bottom Sheet Modal */}
      <Modal
        visible={isPickerModalOpen}
        onClose={() => setIsPickerModalOpen(false)}
        title="Select Arrival Time"
        description={
          selectedDate
            ? `Available start windows for ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}`
            : "Choose an available start window"
        }
      >
        <ScrollView className="max-h-[60vh]" showsVerticalScrollIndicator={false}>
          <View className="gap-5 py-2">
            {availableSlots.length === 0 ? (
              <View className="items-center justify-center py-8 gap-2">
                <Calendar size={24} color={THEME.light.mutedForeground} />
                <Text className="text-center font-semibold text-foreground">
                  No Remaining Slots Today
                </Text>
                <Text className="text-center text-xs text-muted-foreground">
                  All start times for this day have passed or are booked. Please select another date.
                </Text>
              </View>
            ) : (
              <>
                {/* Morning Section */}
                {morningSlots.length > 0 ? (
                  <View className="gap-2.5">
                    <View className="flex-row items-center gap-1.5">
                      <Sunrise size={16} color={THEME.light.accent} />
                      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Morning Hours
                      </Text>
                    </View>
                    <View className="gap-2">
                      {morningSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
                            accessibilityRole="button"
                            onPress={() => {
                              handleTimeChange(slot.time);
                              setIsPickerModalOpen(false);
                            }}
                            className={`flex-row items-center justify-between rounded-xl border p-3.5 ${
                              isSelected
                                ? "border-accent bg-accent/10"
                                : "border-border bg-card active:bg-secondary"
                            }`}
                          >
                            <View className="flex-row items-center gap-3">
                              <Clock size={16} color={isSelected ? THEME.light.accent : THEME.light.mutedForeground} />
                              <Text className={`font-semibold ${isSelected ? "text-accent font-bold" : "text-foreground"}`}>
                                {formatTime12h(slot.time)}
                              </Text>
                            </View>
                            {isSelected ? (
                              <Check size={18} color={THEME.light.accent} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Afternoon Section */}
                {afternoonSlots.length > 0 ? (
                  <View className="gap-2.5">
                    <View className="flex-row items-center gap-1.5">
                      <Sun size={16} color={THEME.light.accent} />
                      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Afternoon Hours
                      </Text>
                    </View>
                    <View className="gap-2">
                      {afternoonSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
                            accessibilityRole="button"
                            onPress={() => {
                              handleTimeChange(slot.time);
                              setIsPickerModalOpen(false);
                            }}
                            className={`flex-row items-center justify-between rounded-xl border p-3.5 ${
                              isSelected
                                ? "border-accent bg-accent/10"
                                : "border-border bg-card active:bg-secondary"
                            }`}
                          >
                            <View className="flex-row items-center gap-3">
                              <Clock size={16} color={isSelected ? THEME.light.accent : THEME.light.mutedForeground} />
                              <Text className={`font-semibold ${isSelected ? "text-accent font-bold" : "text-foreground"}`}>
                                {formatTime12h(slot.time)}
                              </Text>
                            </View>
                            {isSelected ? (
                              <Check size={18} color={THEME.light.accent} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}
