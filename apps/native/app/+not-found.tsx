import { Link, Stack } from "expo-router";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
        <Text variant="h2" className="border-0 pb-0 text-center">
          This screen is off the map.
        </Text>
        <Link href="/(tabs)" asChild>
          <Button>
            <Text>Back to overview</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}
