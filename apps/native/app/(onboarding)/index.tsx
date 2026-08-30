import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/expo";
import { router } from "expo-router";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Sparkles, User } from "lucide-react-native";

import { BrandMark } from "@/components/brand-mark";
import { Screen, ScreenHeader } from "@/components/screen";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { AddressSearch, type AddressValue } from "@/components/forms/address-search";
import { VehicleLookup, type VehicleLookupValue } from "@/components/forms/vehicle-lookup";
import { THEME } from "@/lib/theme";

export default function OnboardingScreen() {
  const { user } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const createUserProfile = useMutation(api.users.createUserProfile);

  const [step, setStep] = React.useState<1 | 2>(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1: Contact & Service Address
  const [name, setName] = React.useState(
    currentUser?.name || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "",
  );
  const [phone, setPhone] = React.useState(currentUser?.phone || user?.primaryPhoneNumber?.phoneNumber || "");
  const [address, setAddress] = React.useState<AddressValue>({
    street: currentUser?.address?.street || "",
    city: currentUser?.address?.city || "",
    state: currentUser?.address?.state || "AR",
    zip: currentUser?.address?.zip || "",
  });

  // Step 2: Vehicles
  const [vehicles, setVehicles] = React.useState<VehicleLookupValue[]>([
    { year: "", make: "", model: "", size: "medium" },
  ]);

  const addVehicle = () => {
    setVehicles([...vehicles, { year: "", make: "", model: "", size: "medium" }]);
  };

  const removeVehicle = (index: number) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter((_, i) => i !== index));
    }
  };

  const updateVehicle = (index: number, updated: VehicleLookupValue) => {
    setVehicles(vehicles.map((v, i) => (i === index ? updated : v)));
  };

  const formatPhoneNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!name.trim()) {
        setError("Please enter your full name");
        return;
      }
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) {
        setError("Please enter a valid 10-digit phone number");
        return;
      }
      if (!address.street.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
        setError("Please complete your service address");
        return;
      }
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    const validVehicles = vehicles.filter(
      (v) => /^\d{4}$/.test(v.year) && v.make?.trim() && v.model?.trim(),
    );

    if (validVehicles.length === 0) {
      setError("Please add at least one valid vehicle (Year, Make, Model)");
      return;
    }

    setIsLoading(true);
    try {
      await createUserProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: {
          street: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim().toUpperCase(),
          zip: address.zip.trim(),
        },
        vehicles: validVehicles.map((v) => ({
          year: Number(v.year),
          make: v.make.trim(),
          model: v.model.trim(),
          color: v.color?.trim() || undefined,
          size: v.size ?? "medium",
          vehicleTypeId: v.vehicleTypeId as Id<"vehicleTypes"> | undefined,
          classification: v.classification,
        })),
      });

      // Redirect directly to customer dashboard
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <BrandMark />
          <View className="gap-0.5">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-muted-foreground">
              River City MD
            </Text>
            <Text className="text-base font-semibold">Account Setup</Text>
          </View>
        </View>
        <Text className="text-xs font-bold text-accent">Step {step} of 2</Text>
      </View>

      {/* Progress Bars */}
      <View className="flex-row gap-2">
        <View className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-accent" : "bg-muted"}`} />
        <View className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-accent" : "bg-muted"}`} />
      </View>

      <ScreenHeader
        eyebrow={step === 1 ? "Personal & Service Details" : "Your Garage"}
        title={step === 1 ? "Let's get you set up" : "Add your vehicle(s)"}
        description={
          step === 1
            ? "We bring showroom-level detailing right to your driveway. Where should we come?"
            : "Tell us about your cars so we can tailor the right packages and sizing."
        }
      />

      {error ? (
        <View className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
          <Text className="text-sm font-medium text-destructive">{error}</Text>
        </View>
      ) : null}

      {step === 1 ? (
        <View className="gap-5">
          {/* Contact Details Card */}
          <Card className="border border-border">
            <CardContent className="gap-3.5 p-4">
              <Input
                label="Full Name"
                placeholder="John Doe"
                value={name}
                onChangeText={setName}
                leftIcon={<User size={18} color={THEME.light.mutedForeground} />}
              />
              <Input
                label="Mobile Phone Number"
                placeholder="(501) 555-0123"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(t) => setPhone(formatPhoneNumber(t))}
                helperText="Used for technician arrival alerts and scheduling updates."
              />
            </CardContent>
          </Card>

          {/* Service Address Card */}
          <AddressSearch
            value={address}
            onChange={setAddress}
            label="Default Service Address"
            showNotes={false}
          />

          {/* Next Button */}
          <Button
            variant="default"
            size="lg"
            onPress={handleNext}
            className="w-full flex-row items-center justify-center gap-2"
          >
            <Text className="font-bold text-primary-foreground">Continue to Vehicles</Text>
            <ArrowRight size={18} color={THEME.light.primaryForeground} />
          </Button>
        </View>
      ) : (
        <View className="gap-5">
          {vehicles.map((vehicle, index) => (
            <VehicleLookup
              key={index}
              title={`Vehicle ${index + 1}`}
              value={vehicle}
              onChange={(updated) => updateVehicle(index, updated)}
              onRemove={vehicles.length > 1 ? () => removeVehicle(index) : undefined}
            />
          ))}

          <Button
            variant="outline"
            onPress={addVehicle}
            className="flex-row items-center justify-center gap-2 border-dashed"
          >
            <Plus size={18} color={THEME.light.foreground} />
            <Text className="font-semibold">Add Another Vehicle</Text>
          </Button>

          {/* Navigation Buttons */}
          <View className="flex-row gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              onPress={() => setStep(1)}
              disabled={isLoading}
              className="flex-1"
            >
              <ArrowLeft size={18} color={THEME.light.foreground} />
              <Text className="font-semibold">Back</Text>
            </Button>

            <Button
              variant="default"
              size="lg"
              onPress={handleSubmit}
              disabled={isLoading}
              className="flex-2"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={THEME.light.primaryForeground} />
              ) : (
                <>
                  <Text className="font-bold text-primary-foreground">Complete Setup</Text>
                  <CheckCircle2 size={18} color={THEME.light.primaryForeground} />
                </>
              )}
            </Button>
          </View>
        </View>
      )}
    </Screen>
  );
}
