import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, Navigation } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function AdminTripLogsScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const isAdmin = currentUser?.role === "admin";
  const tripLogs = useQuery(api.tripLogs.list, isAdmin ? {} : "skip");

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        className="flex-row items-center gap-1.5 self-start active:opacity-70"
      >
        <ArrowLeft size={18} color={THEME.light.foreground} />
        <Text className="text-sm font-semibold">More Menu</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="Fleet Operations"
        title="Trip Logs & Mileage"
        description="Completed service travel logs, technician mileage, and expense records."
      />

      {tripLogs?.length ? (
        <View className="gap-3">
          {tripLogs.map((log: any) => (
            <Card key={log._id} className="border border-border">
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-bold text-base">
                      {log.appointment?.customerName || "Appointment Log"}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{log.logDate}</Text>
                  </View>
                  <Badge
                    variant={log.status === "completed" ? "success" : "warning"}
                    size="sm"
                    label={log.status}
                  />
                </View>

                <View className="flex-row items-center justify-between border-t border-border pt-2.5">
                  <View className="flex-row items-center gap-1.5">
                    <Navigation size={14} color={THEME.light.mutedForeground} />
                    <Text className="text-xs text-muted-foreground">
                      {log.milesDriven ? `${log.milesDriven} miles` : "Mileage not logged"}
                    </Text>
                  </View>
                  {log.gasExpense ? (
                    <Text className="text-xs font-semibold text-accent">
                      ${log.gasExpense.toFixed(2)} Fuel
                    </Text>
                  ) : null}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No trip logs"
          description="Trip logs generated for completed appointments will be tracked here."
        />
      )}
    </Screen>
  );
}
