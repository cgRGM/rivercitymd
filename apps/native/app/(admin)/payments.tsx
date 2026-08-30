import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { ArrowLeft, CheckCircle2, CreditCard, DollarSign, FileText, Search } from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function AdminPaymentsScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const isAdmin = currentUser?.role === "admin";
  const invoices = useQuery(api.invoices.listWithDetails, isAdmin ? {} : "skip");
  const [searchQuery, setSearchQuery] = React.useState("");

  const filtered = (invoices || []).filter((inv: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const invNum = inv.invoiceNumber?.toLowerCase().includes(q);
    const userMatch = inv.user?.name?.toLowerCase().includes(q);
    return invNum || userMatch;
  });

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
        eyebrow="Billing"
        title="Payments & Invoices"
        description="Track customer invoices, payment statuses, and collected deposits."
      />

      <Input
        placeholder="Search by invoice # or customer name"
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon={<Search size={18} color={THEME.light.mutedForeground} />}
      />

      {filtered.length ? (
        <View className="gap-3">
          {filtered.map((inv: any) => (
            <Card key={inv._id} className="border border-border">
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-bold text-base">#{inv.invoiceNumber}</Text>
                    <Text className="text-xs text-muted-foreground">{inv.user?.name || "Customer"}</Text>
                  </View>
                  <Badge
                    variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "destructive" : "warning"}
                    size="sm"
                    label={inv.status}
                  />
                </View>

                <View className="flex-row items-center justify-between border-t border-border pt-2.5">
                  <Text className="text-xs text-muted-foreground">Due {inv.dueDate}</Text>
                  <Text className="font-extrabold text-base text-accent">
                    ${inv.total?.toFixed(2) || "0.00"}
                  </Text>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No invoices found"
          description="Invoices created for appointments will show up here."
        />
      )}
    </Screen>
  );
}
