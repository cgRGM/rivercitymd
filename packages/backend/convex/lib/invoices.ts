export const REMAINING_BALANCE_DUE_DAYS = 3;

export function getInvoiceDueDateFromDateKey(
  dateKey: string,
  daysUntilDue = REMAINING_BALANCE_DUE_DAYS,
): string {
  const dueDate = new Date(`${dateKey}T00:00:00.000Z`);
  dueDate.setUTCDate(dueDate.getUTCDate() + daysUntilDue);
  return dueDate.toISOString().split("T")[0];
}

export function getInvoiceDueDateFromDate(
  date: Date,
  daysUntilDue = REMAINING_BALANCE_DUE_DAYS,
): string {
  const dueDate = new Date(date);
  dueDate.setUTCDate(dueDate.getUTCDate() + daysUntilDue);
  return dueDate.toISOString().split("T")[0];
}
