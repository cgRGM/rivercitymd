export const BOOKING_BLOCK_MINUTES = 120;
export const DEFAULT_PET_FEE_TIME_MINUTES = 30;
export const NEXT_BOOKABLE_DATE_HORIZON_DAYS = 30;

export function calculateSchedulingDuration(args: {
  serviceDurations: number[];
  petFeeVehicleCount?: number;
  petFeeTimeMinutes?: number;
}): number {
  const serviceDuration = args.serviceDurations.reduce(
    (sum, duration) => sum + Math.max(0, duration || 0),
    0,
  );
  const petFeeDuration =
    Math.max(0, args.petFeeVehicleCount ?? 0) *
    Math.max(0, args.petFeeTimeMinutes ?? DEFAULT_PET_FEE_TIME_MINUTES);
  const computedDuration = serviceDuration + petFeeDuration;

  return Math.max(computedDuration, BOOKING_BLOCK_MINUTES);
}

export function normalizeDateKey(dateInput: string): string {
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date input: ${dateInput}`);
  }
  return parsed.toISOString().split("T")[0];
}

export function legacyIsoDateKey(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

export function getUtcDayOfWeek(dateKey: string): number {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.getUTCDay();
}
