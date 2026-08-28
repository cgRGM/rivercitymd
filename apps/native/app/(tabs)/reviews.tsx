import { api } from "@rivercitymd/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Star } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function ReviewsScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const reviews = useQuery(
    api.reviews.getUserReviewsWithDetails,
    currentUser ? {} : "skip",
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Your feedback"
        title="Reviews"
        description="A record of the details you have shared with us."
      />

      {reviews?.length ? (
        <View className="gap-3">
          {reviews.map((review) => (
            <Card key={review._id}>
              <CardContent className="gap-3 py-5">
                <View className="flex-row items-center justify-between gap-4">
                  <View className="flex-row gap-1">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={17}
                        fill={index < review.rating ? THEME.light.accent : "transparent"}
                        color={index < review.rating ? THEME.light.accent : THEME.light.border}
                      />
                    ))}
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {review.appointment.scheduledDate}
                  </Text>
                </View>
                {review.comment ? (
                  <Text className="text-base leading-6">“{review.comment}”</Text>
                ) : (
                  <Text className="text-sm italic text-muted-foreground">No written comment.</Text>
                )}
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No reviews yet"
          description="After a completed detail, you can share how everything went."
        />
      )}
    </Screen>
  );
}
