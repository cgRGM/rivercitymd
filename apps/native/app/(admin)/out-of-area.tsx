import * as React from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { ArrowLeft, CheckCircle2, Mail, MapPinned, MessageSquare, Phone, X } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function AdminOutOfAreaScreen() {
  const requests = useQuery(api.bookingDrafts.listOutOfAreaRequestsForAdmin, {});
  const updateStatusMutation = useMutation(api.bookingDrafts.updateOutOfAreaRequestStatus);

  const handleUpdateStatus = async (requestId: any, status: "contacted" | "approved" | "declined") => {
    try {
      await updateStatusMutation({
        requestId,
        status,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      Alert.alert("Error", msg);
    }
  };

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
        eyebrow="Coverage"
        title="Out-of-Area Requests"
        description="Leads and special requests outside primary service boundaries."
      />

      {requests?.length ? (
        <View className="gap-3">
          {requests.map((req: any) => (
            <Card key={req._id} className="border border-border">
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-bold text-base">{req.name || "Expansion Lead"}</Text>
                    <Text className="text-xs text-muted-foreground">{req.email || "No email"}</Text>
                  </View>
                  <Badge
                    variant={req.status === "approved" ? "success" : req.status === "declined" ? "destructive" : "warning"}
                    size="sm"
                    label={req.status || "Pending"}
                  />
                </View>

                {req.address ? (
                  <View className="rounded-xl bg-secondary/50 p-2.5">
                    <Text className="text-xs text-muted-foreground">
                      {req.address.street || ""}, {req.address.city}, {req.address.state} {req.address.zip}
                    </Text>
                  </View>
                ) : null}

                {req.notes ? (
                  <Text className="text-xs italic text-muted-foreground">Notes: {req.notes}</Text>
                ) : null}

                {/* Quick actions */}
                <View className="flex-row gap-2 border-t border-border pt-2.5">
                  {req.phone ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => Linking.openURL(`tel:${req.phone}`)}
                      className="flex-1 flex-row items-center justify-center gap-1.5"
                    >
                      <Phone size={13} color={THEME.light.foreground} />
                      <Text className="text-xs font-semibold">Call</Text>
                    </Button>
                  ) : null}

                  {req.status === "pending" ? (
                    <Button
                      variant="default"
                      size="sm"
                      onPress={() => handleUpdateStatus(req._id, "approved")}
                      className="flex-1"
                    >
                      <Text className="text-xs font-bold text-primary-foreground">Approve</Text>
                    </Button>
                  ) : null}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No out-of-area requests"
          description="Requests submitted outside the default travel zone will appear here."
        />
      )}
    </Screen>
  );
}
