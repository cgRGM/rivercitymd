import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { ArrowLeft, Clock, CreditCard, Dog, MapPin, Navigation, Settings } from "lucide-react-native";

import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function AdminSettingsScreen() {
  const depositSettings = useQuery(api.depositSettings.get);
  const petFeeSettings = useQuery(api.petFeeSettings.get);
  const travelFeeSettings = useQuery(api.travelFeeSettings.get);
  const businessInfo = useQuery(api.business.get);

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
        eyebrow="Configuration"
        title="Business Settings"
        description="Review operational parameters, travel fee tiers, deposits, and pet fees."
      />

      <View className="gap-4">
        {/* Business Info */}
        <Card className="border border-border">
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
              <MapPin size={18} color={THEME.light.accent} />
            </View>
            <View className="flex-1">
              <CardTitle className="text-base">{businessInfo?.name || "River City Mobile Detailing"}</CardTitle>
              <Text className="text-xs text-muted-foreground">{businessInfo?.cityStateZip || "Central Arkansas"}</Text>
            </View>
          </CardHeader>
        </Card>

        {/* Deposit Settings */}
        <Card className="border border-border">
          <CardContent className="gap-2.5 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <CreditCard size={18} color={THEME.light.accent} />
                <Text className="font-bold text-sm">Online Booking Deposit</Text>
              </View>
              <Badge variant="accent" size="sm" label="Active" />
            </View>
            <Text className="text-xs text-muted-foreground">
              Collected per vehicle during online checkout to secure appointment slots.
            </Text>
            <View className="flex-row items-center justify-between border-t border-border pt-2 mt-1">
              <Text className="text-xs text-muted-foreground">Deposit Rate</Text>
              <Text className="text-base font-extrabold text-accent">
                ${depositSettings?.amountPerVehicle ?? 50}.00 / vehicle
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* Pet Fee Settings */}
        <Card className="border border-border">
          <CardContent className="gap-2.5 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Dog size={18} color={THEME.light.accent} />
                <Text className="font-bold text-sm">Pet Hair Extraction Fees</Text>
              </View>
              <Badge
                variant={petFeeSettings?.isActive ? "success" : "secondary"}
                size="sm"
                label={petFeeSettings?.isActive ? "Enabled" : "Disabled"}
              />
            </View>
            <Text className="text-xs text-muted-foreground">
              Applied per vehicle when pet hair extraction is selected.
            </Text>
            <View className="gap-1.5 border-t border-border pt-2 mt-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Small Vehicle Fee</Text>
                <Text className="text-xs font-bold">${petFeeSettings?.basePriceSmall ?? 40}.00</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Standard / Mid-Size Fee</Text>
                <Text className="text-xs font-bold">${petFeeSettings?.basePriceMedium ?? 50}.00</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Large SUV / Truck Fee</Text>
                <Text className="text-xs font-bold">${petFeeSettings?.basePriceLarge ?? 60}.00</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Travel Fee Origin */}
        <Card className="border border-border">
          <CardContent className="gap-2.5 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Navigation size={18} color={THEME.light.accent} />
                <Text className="font-bold text-sm">Travel Fee Origin Hub</Text>
              </View>
              <Badge variant="secondary" size="sm" label="Arkansas Hub" />
            </View>
            <Text className="text-xs text-muted-foreground">
              {travelFeeSettings?.originStreet ? `${travelFeeSettings.originStreet}, ` : ""}
              {travelFeeSettings?.originCity || "Little Rock"}, {travelFeeSettings?.originState || "AR"}{" "}
              {travelFeeSettings?.originZip || "72201"}
            </Text>
          </CardContent>
        </Card>
      </View>
    </Screen>
  );
}
