import * as React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { CheckCircle2, ChevronRight, RefreshCw, TriangleAlert } from "lucide-react-native";

import { Screen, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export default function BookingSuccessScreen() {
  const { token, checkout } = useLocalSearchParams<{
    token?: string;
    checkout?: string;
  }>();
  const draftContext = useQuery(
    api.bookingDrafts.getPublicContext,
    token ? { token } : "skip",
  );
  const confirmBookingCheckout = useAction(api.payments.confirmBookingCheckout);
  const [retryCount, setRetryCount] = React.useState(0);
  const [state, setState] = React.useState<
    "loading" | "pending" | "invalid" | "error"
  >(token ? "loading" : "invalid");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token || draftContext === undefined) return;

    if (!draftContext) {
      setState("invalid");
      return;
    }

    if (draftContext.convertedAppointmentId) {
      router.replace(`/appointments/${draftContext.convertedAppointmentId}`);
      return;
    }

    let isActive = true;
    setState("loading");
    setErrorMessage(null);

    void (async () => {
      try {
        const result = await confirmBookingCheckout({ resumeToken: token });
        if (!isActive) return;

        if (result.success && result.appointmentId) {
          router.replace(`/appointments/${result.appointmentId}`);
          return;
        }

        setState("pending");
      } catch (error) {
        if (!isActive) return;
        setState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not confirm the booking yet.",
        );
      }
    })();

    return () => {
      isActive = false;
    };
  }, [confirmBookingCheckout, draftContext?.convertedAppointmentId, draftContext?.status, retryCount, token]);

  if (state === "invalid") {
    return (
      <Screen>
        <ScreenHeader
          eyebrow="Booking"
          title="Booking link unavailable"
          description="This checkout link is missing or has expired."
        />
        <Card className="border border-border">
          <CardContent className="items-center gap-3 p-6">
            <TriangleAlert size={34} color={THEME.light.destructive} />
            <Text className="text-center text-sm text-muted-foreground">
              Return to your appointments or start a new booking.
            </Text>
            <Button onPress={() => router.replace("/(tabs)/appointments")}>
              <Text className="font-bold text-primary-foreground">View Appointments</Text>
            </Button>
          </CardContent>
        </Card>
      </Screen>
    );
  }

  const isClosedCheckout = checkout === "closed";

  return (
    <Screen>
      <View className="items-center gap-3 pt-8">
        {state === "loading" ? (
          <ActivityIndicator size="large" color={THEME.light.accent} />
        ) : state === "error" ? (
          <TriangleAlert size={42} color={THEME.light.destructive} />
        ) : (
          <CheckCircle2 size={46} color="#16a34a" />
        )}
        <ScreenHeader
          eyebrow="RiverCityMD"
          title={state === "loading" ? "Confirming your booking" : "Payment received"}
          description={
            state === "loading"
              ? "We are matching your Stripe payment to the appointment now."
              : state === "pending"
                ? isClosedCheckout
                  ? "Checkout was closed before we could verify the payment. You can retry confirmation or return to your appointments."
                  : "Your payment is being finalized. We will show the appointment as soon as Stripe confirms it."
                : state === "error"
                  ? errorMessage ?? "We could not confirm the booking yet."
                  : "Your appointment is saved and ready to manage."
          }
        />
      </View>

      {draftContext ? (
        <Card className="border border-border">
          <CardContent className="gap-3 p-5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Booking Summary
            </Text>
            <Text className="text-base font-bold">
              {draftContext.serviceNames.join(", ") || "Mobile detail"}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {draftContext.scheduledDate} at {draftContext.scheduledTime}
            </Text>
            <Text className="text-sm text-muted-foreground">
              Confirmation email: {draftContext.email}
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {state === "pending" || state === "error" ? (
        <Button
          variant="outline"
          size="lg"
          onPress={() => setRetryCount((count) => count + 1)}
          className="flex-row items-center justify-center gap-2"
        >
          <RefreshCw size={17} color={THEME.light.foreground} />
          <Text className="font-bold">Check Again</Text>
        </Button>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/(tabs)/appointments")}
        className="flex-row items-center justify-center gap-1 rounded-xl p-3 active:bg-secondary"
      >
        <Text className="font-semibold text-accent">Go to Appointments</Text>
        <ChevronRight size={17} color={THEME.light.accent} />
      </Pressable>
    </Screen>
  );
}
