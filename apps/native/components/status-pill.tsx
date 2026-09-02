import { View } from "react-native";

import { Text } from "@/components/ui/text";

type Status = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "rescheduled";

const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export function StatusPill({ status }: { status: Status }) {
  const isPositive = status === "confirmed" || status === "completed";
  const isNegative = status === "cancelled";

  return (
    <View
      className={
        isNegative
          ? "rounded-full bg-destructive/10 px-3 py-1"
          : isPositive
            ? "rounded-full bg-accent/10 px-3 py-1"
            : "rounded-full bg-secondary px-3 py-1"
      }
    >
      <Text
        className={
          isNegative
            ? "text-xs font-semibold text-destructive"
            : isPositive
              ? "text-xs font-semibold text-accent"
              : "text-xs font-semibold text-secondary-foreground"
        }
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
