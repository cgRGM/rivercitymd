import { useClerk, useUser } from "@clerk/expo";
import { UserButton } from "@clerk/expo/native";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Mail, ShieldCheck } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const currentUser = useQuery(api.users.getCurrentUser);

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Account"
        title="Profile"
        description="Your River City MD account and preferences."
      />

      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <UserButton />
          <View className="flex-1 gap-1">
            <CardTitle>{currentUser?.name || user?.fullName || "River City customer"}</CardTitle>
            <Text className="text-sm text-muted-foreground">
              {currentUser?.email || user?.primaryEmailAddress?.emailAddress || "Email not available"}
            </Text>
          </View>
        </CardHeader>
        <CardContent className="gap-3 pb-5">
          <View className="flex-row items-center gap-3 rounded-lg bg-secondary p-3">
            <Mail size={17} color={THEME.light.mutedForeground} />
            <Text className="flex-1 text-sm text-muted-foreground">
              Account details are managed securely by Clerk.
            </Text>
          </View>
          {currentUser?.role === "admin" ? (
            <View className="flex-row items-center gap-3 rounded-lg bg-accent/10 p-3">
              <ShieldCheck size={17} color={THEME.light.accent} />
              <Text className="flex-1 text-sm text-accent">Admin access enabled</Text>
            </View>
          ) : null}
        </CardContent>
      </Card>

      {!currentUser ? (
        <EmptyState
          title="Finish setting up your profile"
          description="Your account is authenticated. Complete onboarding on the web portal to add your customer details."
        />
      ) : null}

      <Button
        variant="outline"
        onPress={() => void signOut()}
        className="self-start"
      >
        <Text>Sign out</Text>
      </Button>
    </Screen>
  );
}
