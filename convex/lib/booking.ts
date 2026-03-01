export const BOOKING_BLOCK_MINUTES = 120;
export const NEXT_BOOKABLE_DATE_HORIZON_DAYS = 30;

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
