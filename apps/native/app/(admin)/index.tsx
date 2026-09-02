import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react-native";

import { BrandMark } from "@/components/brand-mark";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function AdminOverviewScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const isAdmin = currentUser?.role === "admin";

  const stats = useQuery(api.analytics.getMonthlyStats, isAdmin ? {} : "skip") || {
    totalRevenue: 0,
    revenueChange: "0",
    bookingsCount: 0,
    bookingsChange: "0",
    activeCustomers: 0,
    avgServiceTime: "0",
    totalDeposits: 0,
    depositsChange: "0",
  };
  const upcomingAppointments = useQuery(api.appointments.getUpcoming, isAdmin ? {} : "skip") || [];
  const pendingTripLogs = useQuery(api.tripLogs.getPendingRequired, isAdmin ? { limit: 3 } : "skip") || [];

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <BrandMark />
          <View className="gap-0.5">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-accent">
              Admin Portal
            </Text>
            <Text className="text-base font-bold">Business Overview</Text>
          </View>
        </View>
        <Badge variant="accent" size="sm" label="Live Sync" />
      </View>

      <ScreenHeader
        eyebrow="Monthly Performance"
        title="Command Center"
        description="Live operational metrics, incoming bookings, and required vehicle logs."
      />

      {/* KPI Cards Grid */}
      <View className="gap-3">
        <View className="flex-row gap-3">
          {/* Revenue */}
          <Card className="flex-1 border border-border">
            <CardContent className="gap-1 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted-foreground">Revenue</Text>
                <DollarSign size={16} color={THEME.light.accent} />
              </View>
              <Text className="text-2xl font-extrabold text-foreground">
                ${stats.totalRevenue.toLocaleString()}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <TrendingUp size={12} color="#16a34a" />
                <Text className="text-[11px] font-semibold text-emerald-600">
                  {stats.revenueChange}% vs last mo
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Bookings */}
          <Card className="flex-1 border border-border">
            <CardContent className="gap-1 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted-foreground">Appointments</Text>
                <Calendar size={16} color={THEME.light.accent} />
              </View>
              <Text className="text-2xl font-extrabold text-foreground">
                {stats.bookingsCount}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <TrendingUp size={12} color="#16a34a" />
                <Text className="text-[11px] font-semibold text-emerald-600">
                  {stats.bookingsChange}% vs last mo
                </Text>
              </View>
            </CardContent>
          </Card>
        </View>

        <View className="flex-row gap-3">
          {/* Active Customers */}
          <Card className="flex-1 border border-border">
            <CardContent className="gap-1 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted-foreground">Customers</Text>
                <Users size={16} color={THEME.light.accent} />
              </View>
              <Text className="text-2xl font-extrabold text-foreground">
                {stats.activeCustomers}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-1">Active client base</Text>
            </CardContent>
          </Card>

          {/* Deposits */}
          <Card className="flex-1 border border-border">
            <CardContent className="gap-1 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted-foreground">Deposits</Text>
                <CreditCard size={16} color={THEME.light.accent} />
              </View>
              <Text className="text-2xl font-extrabold text-foreground">
                ${stats.totalDeposits.toLocaleString()}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-1">Collected upfront</Text>
            </CardContent>
          </Card>
        </View>
      </View>

      {/* Pending Trip Logs Alert */}
      {pendingTripLogs.length > 0 ? (
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardContent className="gap-3 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <AlertCircle size={18} color="#d97706" />
                <Text className="font-bold text-amber-700 dark:text-amber-400">
                  {pendingTripLogs.length} Pending Trip Log(s)
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(admin)/logs")}
                className="rounded-full bg-amber-500/20 px-2.5 py-1"
              >
                <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">Review</Text>
              </Pressable>
            </View>
            <Text className="text-xs text-muted-foreground">
              Completed appointments requiring mileage, drive time, and gas receipts.
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {/* Upcoming Appointments Section */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="h3" className="text-xl font-bold">Upcoming Schedule</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(admin)/appointments")}
            className="rounded-full px-2 py-1 active:bg-secondary"
          >
            <Text className="text-sm font-semibold text-accent">View all</Text>
          </Pressable>
        </View>

        {upcomingAppointments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 items-center justify-center gap-2">
              <Calendar size={24} color={THEME.light.mutedForeground} />
              <Text className="text-sm text-muted-foreground">No appointments booked for this week.</Text>
            </CardContent>
          </Card>
        ) : (
          <View className="gap-3">
            {upcomingAppointments.slice(0, 4).map((apt: any) => (
              <Card key={apt._id} className="border border-border">
                <CardContent className="gap-3 p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 gap-0.5">
                      <Text className="font-bold text-base">{apt.userName || "Customer"}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {apt.scheduledDate} · {apt.scheduledTime} ({apt.duration} mins)
                      </Text>
                    </View>
                    <Badge
                      variant={apt.status === "confirmed" ? "success" : "warning"}
                      size="sm"
                      label={apt.status}
                    />
                  </View>

                  <View className="flex-row items-center justify-between border-t border-border pt-2.5">
                    <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                      <MapPin size={14} color={THEME.light.mutedForeground} />
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {apt.location?.street || "Address on file"}, {apt.location?.city}
                      </Text>
                    </View>
                    <Text className="font-extrabold text-sm text-accent">
                      ${apt.totalPrice?.toFixed(2) || "0.00"}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
