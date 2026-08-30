import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { Calendar, CheckCircle2, Clock, Sun, Sunrise } from "lucide-react-native";

import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
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
    const dateStr = d.toISOString().slice(0, 10);
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

  // Filter strictly for available slots from admin database availability
  const availableSlots = React.useMemo(() => {
    return rawSlots.filter((slot) => slot.available);
  }, [rawSlots]);

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

      {/* Available Time Slots View */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available Start Times
          </Text>
          {resolvedDuration ? (
            <Badge variant="secondary" size="sm" label={`Est. ${resolvedDuration} mins`} />
          ) : null}
        </View>

        {/* Selected Time Callout Banner */}
        {selectedTime ? (
          <View className="flex-row items-center justify-between rounded-xl bg-accent/10 border border-accent/20 px-3.5 py-2.5">
            <View className="flex-row items-center gap-2">
              <Clock size={16} color={THEME.light.accent} />
              <Text className="text-xs font-semibold text-foreground">
                Selected Start: <Text className="font-bold text-accent">{formatTime12h(selectedTime)}</Text>
              </Text>
            </View>
            <CheckCircle2 size={16} color={THEME.light.accent} />
          </View>
        ) : null}

        <Card className="border border-border">
          <CardContent className="p-4">
            {isLoading ? (
              <View className="items-center justify-center py-8 gap-2">
                <ActivityIndicator size="small" color={THEME.light.accent} />
                <Text className="text-xs text-muted-foreground">Checking technician schedule...</Text>
              </View>
            ) : availableSlots.length === 0 ? (
              <View className="items-center justify-center py-6 gap-1.5">
                <Calendar size={22} color={THEME.light.mutedForeground} />
                <Text className="font-semibold text-sm text-foreground">No open slots on this date</Text>
                <Text className="text-xs text-center text-muted-foreground">
                  The schedule is fully booked or closed for this day. Please select another day above.
                </Text>
              </View>
            ) : (
              <View className="gap-4">
                {/* Morning Slots */}
                {morningSlots.length > 0 ? (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-1.5">
                      <Sunrise size={14} color={THEME.light.accent} />
                      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Morning
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {morningSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
                            accessibilityRole="button"
                            onPress={() => handleTimeChange(slot.time)}
                            className={`px-3.5 py-2.5 rounded-xl border items-center justify-center ${
                              isSelected
                                ? "border-accent bg-accent"
                                : "border-border bg-card active:bg-secondary"
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-primary-foreground" : "text-foreground"
                              }`}
                            >
                              {formatTime12h(slot.time)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Afternoon Slots */}
                {afternoonSlots.length > 0 ? (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-1.5">
                      <Sun size={14} color={THEME.light.accent} />
                      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Afternoon
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {afternoonSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
                            accessibilityRole="button"
                            onPress={() => handleTimeChange(slot.time)}
                            className={`px-3.5 py-2.5 rounded-xl border items-center justify-center ${
                              isSelected
                                ? "border-accent bg-accent"
                                : "border-border bg-card active:bg-secondary"
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-primary-foreground" : "text-foreground"
                              }`}
                            >
                              {formatTime12h(slot.time)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </View>
  );
}
