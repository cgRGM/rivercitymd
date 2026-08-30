import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useClerk, useUser } from "@clerk/expo";
import { UserButton } from "@clerk/expo/native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { LogOut, Mail, MapPin, MessageSquare, Phone, ShieldCheck, User } from "lucide-react-native";

import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { THEME } from "@/lib/theme";

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateUserProfile = useMutation(api.users.updateUserProfile);

  const [isUpdatingSms, setIsUpdatingSms] = React.useState(false);
  const isSmsOptedIn = currentUser?.notificationPreferences?.operationalSmsConsent?.optedIn ?? false;

  const handleToggleSms = async (value: boolean) => {
    setIsUpdatingSms(true);
    try {
      await updateUserProfile({
        notificationPreferences: {
          smsNotifications: value,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update notification settings";
      Alert.alert("Error", msg);
    } finally {
      setIsUpdatingSms(false);
    }
  };

  const displayName = currentUser?.name || user?.fullName || "River City Customer";
  const displayEmail = currentUser?.email || user?.primaryEmailAddress?.emailAddress || "Email unavailable";
  const displayPhone = currentUser?.phone || user?.primaryPhoneNumber?.phoneNumber || "No phone added";
  const address = currentUser?.address;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Account"
        title="Profile & Settings"
        description="Manage your contact information, service location, and preferences."
      />

      {/* Account Info Card */}
      <Card className="border border-border">
        <CardHeader className="flex-row items-center gap-4">
          <UserButton />
          <View className="flex-1 gap-1">
            <CardTitle>{displayName}</CardTitle>
            <Text className="text-sm text-muted-foreground">{displayEmail}</Text>
          </View>
          {currentUser?.role === "admin" ? (
            <Badge variant="accent" size="sm" label="Admin" />
          ) : null}
        </CardHeader>

        <CardContent className="gap-3 pb-5">
          <View className="flex-row items-center gap-3 rounded-xl bg-secondary/50 p-3">
            <Phone size={16} color={THEME.light.mutedForeground} />
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">Mobile Phone</Text>
              <Text className="text-sm font-semibold">{displayPhone}</Text>
            </View>
          </View>

          {address?.street ? (
            <View className="flex-row items-center gap-3 rounded-xl bg-secondary/50 p-3">
              <MapPin size={16} color={THEME.light.mutedForeground} />
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground">Default Service Address</Text>
                <Text className="text-sm font-semibold">
                  {address.street}, {address.city}, {address.state} {address.zip}
                </Text>
              </View>
            </View>
          ) : null}
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <View className="gap-2.5">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preferences
        </Text>

        <Switch
          label="Operational SMS Alerts"
          description="Receive text message updates when technicians are en route and for service confirmations."
          value={isSmsOptedIn}
          onValueChange={handleToggleSms}
          disabled={isUpdatingSms}
        />
      </View>

      {/* Sign Out */}
      <Button
        variant="destructive"
        onPress={() => void signOut()}
        className="flex-row items-center justify-center gap-2 self-start mt-2"
      >
        <LogOut size={16} color="#fff" />
        <Text className="font-bold text-white">Sign Out</Text>
      </Button>
    </Screen>
  );
}
