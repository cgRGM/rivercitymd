import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function BookingCancelledScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  React.useEffect(() => {
    if (!token) {
      router.replace("/(tabs)/appointments");
      return;
    }

    // Keep the token so the confirmation screen can safely check whether a
    // payment completed before the customer closed Stripe Checkout.
    router.replace(`/booking/success?token=${encodeURIComponent(token)}&checkout=closed`);
  }, [token]);

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
      <ActivityIndicator size="small" color={THEME.light.accent} />
      <Text className="text-sm text-muted-foreground">Returning to RiverCityMD...</Text>
    </View>
  );
}
