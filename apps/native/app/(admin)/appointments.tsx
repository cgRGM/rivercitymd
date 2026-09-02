import * as React from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Doc, Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import {
  Calendar,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  MapPin,
  MessageSquare,
  Phone,
  Play,
  Search,
  X,
} from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

export default function AdminAppointmentsScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const isAdmin = currentUser?.role === "admin";
  const appointments = useQuery(api.appointments.listWithDetails, isAdmin ? {} : "skip");
  const updateStatusMutation = useMutation(api.appointments.updateStatus);

  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedAppointment, setSelectedAppointment] = React.useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  const filteredAppointments = (appointments || []).filter((apt: any) => {
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = apt.user?.name?.toLowerCase().includes(q);
      const emailMatch = apt.user?.email?.toLowerCase().includes(q);
      const dateMatch = apt.scheduledDate?.includes(q);
      return nameMatch || emailMatch || dateMatch;
    }
    return true;
  });

  const handleStatusChange = async (appointmentId: Id<"appointments">, newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      await updateStatusMutation({
        appointmentId,
        status: newStatus as any,
      });
      setSelectedAppointment(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update appointment status";
      Alert.alert("Error", msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Operations"
        title="Appointments"
        description="Filter, inspect, and update live mobile detailing appointments."
      />

      {/* Search Input */}
      <Input
        placeholder="Search by customer name, email, or date (YYYY-MM-DD)"
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon={<Search size={18} color={THEME.light.mutedForeground} />}
      />

      {/* Horizontal Status Filter Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-1"
        contentContainerStyle={{ paddingHorizontal: 4, gap: 6 }}
      >
        {STATUS_FILTERS.map((tab) => {
          const isSelected = filterStatus === tab.value;
          return (
            <Pressable
              key={tab.value}
              accessibilityRole="button"
              onPress={() => setFilterStatus(tab.value)}
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

      {/* Appointments List */}
      {filteredAppointments.length ? (
        <View className="gap-3">
          {filteredAppointments.map((apt: any) => (
            <Card key={apt._id} className="border border-border">
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedAppointment(apt)}
                className="p-4 gap-3 active:bg-secondary/30"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 gap-1">
                    <Text className="font-bold text-base">
                      {apt.user?.name || "Customer"}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Calendar size={13} color={THEME.light.mutedForeground} />
                      <Text className="text-xs text-muted-foreground">
                        {apt.scheduledDate} · {apt.scheduledTime} ({apt.duration}m)
                      </Text>
                    </View>
                  </View>
                  <StatusPill status={apt.status} />
                </View>

                {/* Vehicles & Services */}
                <View className="gap-1.5 border-t border-border pt-2.5">
                  <View className="flex-row items-center gap-2">
                    <CarFront size={14} color={THEME.light.mutedForeground} />
                    <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
                      {apt.vehicles?.map((v: any) => `${v.year} ${v.make} ${v.model}`).join(", ") || "Vehicle on file"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <MapPin size={14} color={THEME.light.mutedForeground} />
                    <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
                      {apt.location?.street}, {apt.location?.city}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between border-t border-border pt-2 mt-1">
                  <Text className="text-xs text-muted-foreground">
                    {apt.services?.length || 0} service(s)
                  </Text>
                  <Text className="font-extrabold text-base text-accent">
                    ${apt.totalPrice?.toFixed(2) || "0.00"}
                  </Text>
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No appointments match"
          description="Try selecting a different status filter or clear your search."
        />
      )}

      {/* Appointment Detail & Status Update Modal */}
      <Modal
        visible={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Operations"
        description={selectedAppointment?.user?.name || "Customer Detail"}
      >
        {selectedAppointment ? (
          <ScrollView className="gap-4 max-h-[500px]">
            {/* Customer Contact Card */}
            <View className="rounded-2xl border border-border bg-secondary/50 p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-sm">Customer Info</Text>
                <StatusPill status={selectedAppointment.status} />
              </View>

              {selectedAppointment.user?.phone ? (
                <View className="flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => Linking.openURL(`tel:${selectedAppointment.user.phone}`)}
                    className="flex-1 flex-row items-center justify-center gap-1.5"
                  >
                    <Phone size={14} color={THEME.light.foreground} />
                    <Text className="text-xs font-semibold">Call</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => Linking.openURL(`sms:${selectedAppointment.user.phone}`)}
                    className="flex-1 flex-row items-center justify-center gap-1.5"
                  >
                    <MessageSquare size={14} color={THEME.light.foreground} />
                    <Text className="text-xs font-semibold">SMS</Text>
                  </Button>
                </View>
              ) : null}

              <Text className="text-xs text-muted-foreground">
                Email: {selectedAppointment.user?.email || "N/A"}
              </Text>
            </View>

            {/* Location & Navigation */}
            <View className="rounded-2xl border border-border bg-secondary/50 p-4 gap-2">
              <Text className="font-bold text-sm">Service Location</Text>
              <Text className="text-xs text-muted-foreground">
                {selectedAppointment.location?.street}, {selectedAppointment.location?.city}, {selectedAppointment.location?.state} {selectedAppointment.location?.zip}
              </Text>
              {selectedAppointment.location?.notes ? (
                <Text className="text-xs italic text-muted-foreground mt-1">
                  Notes: {selectedAppointment.location.notes}
                </Text>
              ) : null}
            </View>

            {/* Quick Status Transitions */}
            <View className="gap-2 pt-2">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Update Status
              </Text>

              <View className="flex-row flex-wrap gap-2">
                {selectedAppointment.status !== "confirmed" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleStatusChange(selectedAppointment._id, "confirmed")}
                    disabled={isUpdatingStatus}
                    className="flex-1 border-emerald-500/30 bg-emerald-500/10"
                  >
                    <Text className="text-xs font-bold text-emerald-600">Mark Confirmed</Text>
                  </Button>
                ) : null}

                {selectedAppointment.status !== "in_progress" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleStatusChange(selectedAppointment._id, "in_progress")}
                    disabled={isUpdatingStatus}
                    className="flex-1 border-blue-500/30 bg-blue-500/10"
                  >
                    <Text className="text-xs font-bold text-blue-600">Start Service</Text>
                  </Button>
                ) : null}

                {selectedAppointment.status !== "completed" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleStatusChange(selectedAppointment._id, "completed")}
                    disabled={isUpdatingStatus}
                    className="flex-1 border-purple-500/30 bg-purple-500/10"
                  >
                    <Text className="text-xs font-bold text-purple-600">Mark Completed</Text>
                  </Button>
                ) : null}

                {selectedAppointment.status !== "cancelled" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => handleStatusChange(selectedAppointment._id, "cancelled")}
                    disabled={isUpdatingStatus}
                    className="flex-1"
                  >
                    <Text className="text-xs font-semibold text-destructive">Cancel</Text>
                  </Button>
                ) : null}
              </View>
            </View>
          </ScrollView>
        ) : null}
      </Modal>
    </Screen>
  );
}
