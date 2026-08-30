import * as React from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { CarFront, DollarSign, Mail, MapPin, MessageSquare, Phone, Search, Star, User } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function AdminCustomersScreen() {
  const customers = useQuery(api.users.listWithStats, {});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCustomer, setSelectedCustomer] = React.useState<any | null>(null);

  const filteredCustomers = (customers || []).filter((customer: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = customer.name?.toLowerCase().includes(q);
    const emailMatch = customer.email?.toLowerCase().includes(q);
    const phoneMatch = customer.phone?.toLowerCase().includes(q);
    return nameMatch || emailMatch || phoneMatch;
  });

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Clients"
        title="Customer Directory"
        description="Search customer profiles, service records, and saved garages."
      />

      <Input
        placeholder="Search customers by name, email, or phone"
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon={<Search size={18} color={THEME.light.mutedForeground} />}
      />

      {filteredCustomers.length ? (
        <View className="gap-3">
          {filteredCustomers.map((customer: any) => (
            <Card key={customer._id} className="border border-border">
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedCustomer(customer)}
                className="p-4 gap-3 active:bg-secondary/30"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-bold text-base">{customer.name || "Customer"}</Text>
                    <Text className="text-xs text-muted-foreground">{customer.email || "No email"}</Text>
                  </View>
                  <Badge
                    variant="accent"
                    size="sm"
                    label={`${customer.timesServiced || 0} Service(s)`}
                  />
                </View>

                <View className="flex-row items-center justify-between border-t border-border pt-2.5">
                  <View className="flex-row items-center gap-1.5">
                    <Phone size={13} color={THEME.light.mutedForeground} />
                    <Text className="text-xs text-muted-foreground">{customer.phone || "No phone"}</Text>
                  </View>
                  <Text className="font-extrabold text-sm text-foreground">
                    ${customer.totalSpent?.toFixed(2) || "0.00"} spent
                  </Text>
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No customers found"
          description="Customers who sign up or book a detailing service will appear here."
        />
      )}

      {/* Customer Detail Modal */}
      <Modal
        visible={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name || "Customer Detail"}
        description={selectedCustomer?.email || "Account Info"}
      >
        {selectedCustomer ? (
          <ScrollView className="gap-4 max-h-[500px]">
            {/* Contact Actions */}
            {selectedCustomer.phone ? (
              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => Linking.openURL(`tel:${selectedCustomer.phone}`)}
                  className="flex-1 flex-row items-center justify-center gap-1.5"
                >
                  <Phone size={14} color={THEME.light.foreground} />
                  <Text className="text-xs font-semibold">Call {selectedCustomer.phone}</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => Linking.openURL(`sms:${selectedCustomer.phone}`)}
                  className="flex-1 flex-row items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} color={THEME.light.foreground} />
                  <Text className="text-xs font-semibold">Text</Text>
                </Button>
              </View>
            ) : null}

            {/* Address */}
            {selectedCustomer.address ? (
              <View className="rounded-2xl border border-border bg-secondary/50 p-4 gap-1">
                <Text className="font-bold text-sm">Service Address</Text>
                <Text className="text-xs text-muted-foreground">
                  {selectedCustomer.address.street}, {selectedCustomer.address.city}, {selectedCustomer.address.state} {selectedCustomer.address.zip}
                </Text>
              </View>
            ) : null}

            {/* Garage Vehicles */}
            <View className="rounded-2xl border border-border bg-secondary/50 p-4 gap-2">
              <Text className="font-bold text-sm">Garage Vehicles</Text>
              {selectedCustomer.vehicles?.length ? (
                selectedCustomer.vehicles.map((v: any, i: number) => (
                  <View key={i} className="flex-row items-center justify-between border-t border-border/50 pt-2 mt-1">
                    <View className="flex-row items-center gap-2">
                      <CarFront size={15} color={THEME.light.accent} />
                      <Text className="text-xs font-semibold">
                        {v.year} {v.make} {v.model}
                      </Text>
                    </View>
                    <Badge variant="secondary" size="sm" label={v.size || "Standard"} />
                  </View>
                ))
              ) : (
                <Text className="text-xs text-muted-foreground">No vehicles registered yet.</Text>
              )}
            </View>

            {/* Stats */}
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-border bg-card p-3 items-center">
                <Text className="text-xs text-muted-foreground">Total Spent</Text>
                <Text className="text-lg font-bold text-accent">
                  ${selectedCustomer.totalSpent?.toFixed(2) || "0.00"}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl border border-border bg-card p-3 items-center">
                <Text className="text-xs text-muted-foreground">Lifetime Visits</Text>
                <Text className="text-lg font-bold">
                  {selectedCustomer.timesServiced || 0}
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </Modal>
    </Screen>
  );
}
