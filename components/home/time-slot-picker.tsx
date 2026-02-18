"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
}

export function TimeSlotPicker({
  date,
  selectedTime,
  onTimeSelect,
  serviceDuration = 60, // Default to 60 min if not specified
}: TimeSlotPickerProps) {
  const slots = useQuery(api.availability.getAvailableTimeSlots, {
    date: date || "",
    serviceDuration,
  });

  if (!date) {
    return (
      <div className="text-center p-4 text-muted-foreground bg-muted/30 rounded-md border border-dashed">
        Please select a date first
      </div>
    );
  }

  if (slots === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground bg-muted/30 rounded-md">
        No available slots for this date.
      </div>
    );
  }

  // Filter out past times if the date is today
  // Note: perform this check on client side for immediate feedback, 
  // though backend should also handle it.
  const now = new Date();
  const selectedDate = new Date(date);
  const isToday =
    selectedDate.getDate() === now.getDate() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getFullYear() === now.getFullYear();

  const filteredSlots = slots.filter((slot) => {
    if (!isToday) return true;
    const [hours, minutes] = slot.time.split(":").map(Number);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hours, minutes, 0, 0);
    return slotDate > now;
  });

  if (filteredSlots.length === 0) {
     return (
      <div className="text-center p-4 text-muted-foreground bg-muted/30 rounded-md">
        No more available slots for today.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px] w-full rounded-md border p-4">
      <div className="grid grid-cols-3 gap-2">
        {filteredSlots.map((slot) => (
          <Button
            key={slot.time}
            variant={selectedTime === slot.time ? "default" : "outline"}
            className={cn(
              "w-full text-[13px]",
              selectedTime === slot.time && "bg-primary text-primary-foreground"
            )}
            disabled={!slot.available}
            onClick={() => onTimeSelect(slot.time)}
            type="button"
          >
            {slot.displayTime}
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
