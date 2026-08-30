import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { ArrowLeft, Star, User } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function AdminReviewsScreen() {
  const reviews = useQuery(api.reviews.listForAdmin, {});

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
        eyebrow="Feedback"
        title="Customer Reviews"
        description="Inspect customer ratings, testimonials, and service experiences."
      />

      {reviews?.length ? (
        <View className="gap-3">
          {reviews.map((rev: any) => (
            <Card key={rev._id} className="border border-border">
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-bold text-base">{rev.user?.name || "Verified Customer"}</Text>
                    <Text className="text-xs text-muted-foreground">{rev.appointment?.scheduledDate || "Past Service"}</Text>
                  </View>

                  <View className="flex-row gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={15}
                        fill={i < rev.rating ? THEME.light.accent : "transparent"}
                        color={i < rev.rating ? THEME.light.accent : THEME.light.border}
                      />
                    ))}
                  </View>
                </View>

                {rev.comment ? (
                  <Text className="text-sm leading-5 text-foreground italic bg-secondary/30 rounded-xl p-3">
                    “{rev.comment}”
                  </Text>
                ) : (
                  <Text className="text-xs text-muted-foreground italic">No written comment.</Text>
                )}
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No reviews yet"
          description="Customer ratings will show up here after completed detailing services."
        />
      )}
    </Screen>
  );
}
