import "@/global.css";

import { env } from "@rivercitymd/env/native";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexReactClient, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PortalHost } from "@rn-primitives/portal";
import { useColorScheme } from "nativewind";
import * as React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { api } from "@rivercitymd/backend/convex/_generated/api";
import { NAV_THEME, THEME } from "@/lib/theme";
import { BrandMark } from "@/components/brand-mark";
import { Text } from "@/components/ui/text";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL, {
  unsavedChangesWarning: false,
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const resolvedColorScheme = colorScheme ?? "light";

  return (
    <ClerkProvider
      publishableKey={env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider value={NAV_THEME[resolvedColorScheme]}>
          <StatusBar style={resolvedColorScheme === "dark" ? "light" : "dark"} />
          <GestureHandlerRootView style={styles.root}>
            <Routes />
            <PortalHost />
          </GestureHandlerRootView>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function Routes() {
  const { isSignedIn, isLoaded } = useAuth();

  React.useEffect(() => {
    if (isLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return (
      <Stack>
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-up" options={{ headerShown: false }} />
      </Stack>
    );
  }

  return <AuthenticatedRoutes />;
}

function AuthenticatedRoutes() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const userRole = useQuery(api.auth.getUserRole);

  if (currentUser === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3">
        <BrandMark />
        <ActivityIndicator size="small" color={THEME.light.accent} />
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Loading RiverCityMD...
        </Text>
      </View>
    );
  }

  const isAdmin = currentUser?.role === "admin" || userRole?.type === "admin";
  const needsOnboarding =
    !isAdmin && (!currentUser?.address?.street || !currentUser?.phone);

  if (isAdmin) {
    return (
      <Stack>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="book" options={{ headerShown: false, presentation: "modal" }} />
      </Stack>
    );
  }

  if (needsOnboarding) {
    return (
      <Stack>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book" options={{ headerShown: false, presentation: "modal" }} />
      </Stack>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="book" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
    </Stack>
  );
}
