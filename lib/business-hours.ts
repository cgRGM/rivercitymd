import type { Doc } from "@/convex/_generated/dataModel";

export const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type AvailabilityDay = Pick<
  Doc<"availability">,
  "dayOfWeek" | "startTime" | "endTime" | "isActive"
>;

export type BusinessHoursFormDay = {
  day: (typeof WEEK_DAYS)[number];
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export function buildBusinessHoursForm(
  businessHours?: ReadonlyArray<AvailabilityDay> | null,
): BusinessHoursFormDay[] {
  const hoursByDay = new Map(
    businessHours?.map((hour) => [hour.dayOfWeek, hour]) ?? [],
  );

  return WEEK_DAYS.map((day, dayOfWeek) => {
    const existing = hoursByDay.get(dayOfWeek);
    return {
      day,
      dayOfWeek,
      startTime: existing?.startTime ?? "09:00",
      endTime: existing?.endTime ?? "17:00",
      isActive: existing?.isActive ?? dayOfWeek > 0,
    };
  });
}
