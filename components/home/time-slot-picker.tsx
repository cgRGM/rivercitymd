"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Clock } from "lucide-react";

export interface TimeSlot {
  time: string;
  displayTime: string;
  available: boolean;
  reason?: string;
}

interface TimeSlotPickerProps {
  date: string;
  selectedTime?: string;
  onTimeSelect: (time: string) => void;
  serviceDuration?: number;
  ignoreAppointmentId?: Id<"appointments">;
}

export function TimeSlotPicker({
  date,
  selectedTime,
  onTimeSelect,
  serviceDuration = 60, // Default to 60 min if not specified
  ignoreAppointmentId,
}: TimeSlotPickerProps) {
  const slots = useQuery(api.availability.getAvailableTimeSlots, {
    date: date || "",
    serviceDuration,
    ignoreAppointmentId,
  });

  // No date selected — show disabled placeholder
  if (!date) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full bg-muted/30 border-dashed text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Select a date first</span>
          </div>
        </SelectTrigger>
      </Select>
    );
  }

  // Loading
  if (slots === undefined) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading times...</span>
          </div>
        </SelectTrigger>
      </Select>
    );
  }

  // Filter out past times if the date is today
  const now = new Date();
  const selectedDateKey = date.includes("T") ? date.split("T")[0] : date;
  const todayKey = now.toISOString().split("T")[0];
  const isToday = selectedDateKey === todayKey;

  const filteredSlots = slots.filter((slot) => {
    if (!isToday) return true;
    const slotDate = new Date(`${selectedDateKey}T${slot.time}:00`);
    return slotDate > now;
  });

  const availableSlots = filteredSlots.filter((slot) => slot.available);

  // No slots at all
  if (filteredSlots.length === 0 || availableSlots.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full bg-muted/30 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              {isToday
                ? "No more times available today"
                : "No times available for this date"}
            </span>
          </div>
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={selectedTime || ""} onValueChange={onTimeSelect}>
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Select a time" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {filteredSlots.map((slot) => (
          <SelectItem
            key={slot.time}
            value={slot.time}
            disabled={!slot.available}
          >
            <span className={!slot.available ? "text-muted-foreground line-through" : ""}>
              {slot.displayTime}
            </span>
            {!slot.available && slot.reason && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({slot.reason})
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
