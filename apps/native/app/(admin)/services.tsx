import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Doc, Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import { CarFront, Check, Clock, DollarSign, Plus, Sparkles, Tag } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

const CATEGORY_TABS = [
  { label: "All", value: "all" },
  { label: "Packages", value: "standard" },
  { label: "Add-ons", value: "addon" },
  { label: "Subscriptions", value: "subscription" },
] as const;

export default function AdminServicesScreen() {
  const services = useQuery(api.services.list, {});
  const updateServiceMutation = useMutation(api.services.update);

  const [activeCategory, setActiveCategory] = React.useState<string>("all");
  const [selectedService, setSelectedService] = React.useState<Doc<"services"> | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const filteredServices = (services || []).filter((s) => {
    if (activeCategory === "all") return true;
    return (s.serviceType || "standard") === activeCategory;
  });

  const handleToggleActive = async (service: Doc<"services">, nextActive: boolean) => {
    setIsUpdating(true);
    try {
      await updateServiceMutation({
        serviceId: service._id,
        name: service.name,
        description: service.description,
        basePriceSmall: service.basePriceSmall,
        basePriceMedium: service.basePriceMedium,
        basePriceLarge: service.basePriceLarge,
        duration: service.duration,
        serviceType: service.serviceType,
        isActive: nextActive,
      });
      setSelectedService(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to toggle service status";
      Alert.alert("Error", msg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Catalog"
        title="Services & Pricing"
        description="Manage detailing packages, add-ons, durations, and vehicle size pricing."
      />

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-1"
        contentContainerStyle={{ paddingHorizontal: 4, gap: 6 }}
      >
        {CATEGORY_TABS.map((tab) => {
          const isSelected = activeCategory === tab.value;
          return (
            <Pressable
              key={tab.value}
              accessibilityRole="button"
              onPress={() => setActiveCategory(tab.value)}
              className={`rounded-full px-4 py-2 border ${
                isSelected
                  ? "border-accent bg-accent"
                  : "border-border bg-card active:bg-secondary"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  isSelected ? "text-accent-foreground" : "text-foreground"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Services List */}
      {filteredServices.length ? (
        <View className="gap-3">
          {filteredServices.map((service) => (
            <Card key={service._id} className="border border-border">
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedService(service)}
                className="p-4 gap-3 active:bg-secondary/30"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-bold text-base">{service.name}</Text>
                      <Badge
                        variant={service.isActive ? "success" : "destructive"}
                        size="sm"
                        label={service.isActive ? "Active" : "Inactive"}
                      />
                    </View>
                    <Text className="text-xs text-muted-foreground leading-4" numberOfLines={2}>
                      {service.description}
                    </Text>
                  </View>
                  <Text className="font-extrabold text-base text-accent">
                    ${service.basePriceMedium?.toFixed(2) || service.basePrice?.toFixed(2) || "0.00"}
                  </Text>
                </View>

                {/* Sizing Price Badges */}
                <View className="flex-row items-center justify-between border-t border-border pt-2.5">
                  <View className="flex-row gap-2">
                    {service.basePriceSmall ? (
                      <Badge variant="secondary" size="sm" label={`Sm: $${service.basePriceSmall}`} />
                    ) : null}
                    {service.basePriceMedium ? (
                      <Badge variant="secondary" size="sm" label={`Med: $${service.basePriceMedium}`} />
                    ) : null}
                    {service.basePriceLarge ? (
                      <Badge variant="secondary" size="sm" label={`Lg: $${service.basePriceLarge}`} />
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Clock size={13} color={THEME.light.mutedForeground} />
                    <Text className="text-xs text-muted-foreground">{service.duration} mins</Text>
                  </View>
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No services found"
          description="Services in this category will appear here."
        />
      )}

      {/* Service Detail Modal */}
      <Modal
        visible={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        title={selectedService?.name || "Service Details"}
        description={selectedService?.serviceType ? `${selectedService.serviceType.toUpperCase()} Tier` : "Package"}
      >
        {selectedService ? (
          <View className="gap-4">
            <Text className="text-sm text-muted-foreground leading-5">
              {selectedService.description}
            </Text>

            {/* Sizing Matrix */}
            <View className="rounded-2xl border border-border bg-secondary/50 p-4 gap-2.5">
              <Text className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Pricing by Vehicle Size
              </Text>
              <View className="flex-row justify-between border-b border-border/50 pb-2">
                <Text className="text-xs text-muted-foreground">Small / Compact / Moto</Text>
                <Text className="font-bold text-xs">
                  ${selectedService.basePriceSmall?.toFixed(2) || "N/A"}
                </Text>
              </View>
              <View className="flex-row justify-between border-b border-border/50 pb-2">
                <Text className="text-xs text-muted-foreground">Mid-Size Sedan / Standard</Text>
                <Text className="font-bold text-xs">
                  ${selectedService.basePriceMedium?.toFixed(2) || "N/A"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Large SUV / Truck / Van</Text>
                <Text className="font-bold text-xs">
                  ${selectedService.basePriceLarge?.toFixed(2) || "N/A"}
                </Text>
              </View>
            </View>

            {/* Active Toggle */}
            <Switch
              label="Available for Online Booking"
              description="When active, customers can select this service in the booking flow."
              value={selectedService.isActive}
              onValueChange={(val) => handleToggleActive(selectedService, val)}
              disabled={isUpdating}
            />
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}
