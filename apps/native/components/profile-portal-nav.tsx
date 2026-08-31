import { Pressable, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { ArrowLeft, BriefcaseBusiness, FileText, UserRound } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";
import { useAppView } from "@/lib/app-view";

const portalTabs = [
  { label: "Profile", icon: UserRound, path: "/profile" },
  { label: "Invoices", icon: FileText, path: "/profile/invoices" },
  { label: "Plans", icon: BriefcaseBusiness, path: "/profile/subscriptions" },
] as const;

export function ProfilePortalNav() {
  const pathname = usePathname();
  const currentUser = useQuery(api.users.getCurrentUser);
  const { viewMode, setViewMode } = useAppView();
  const isSubpage = pathname.includes("/profile/");
  const isAdmin = currentUser?.role === "admin";

  const goToPortalTab = (path: (typeof portalTabs)[number]["path"]) => {
    if (isAdmin) setViewMode("customer");
    router.replace(path);
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSubpage ? "Back to profile" : "Back to overview"}
          onPress={() => router.replace(isSubpage ? "/profile" : "/(tabs)")}
          className="flex-row items-center gap-2 rounded-full px-1 py-1 active:bg-secondary"
        >
          <ArrowLeft size={18} color={THEME.light.foreground} />
          <Text className="text-sm font-semibold">
            {isSubpage ? "Back to Profile" : "Back to Overview"}
          </Text>
        </Pressable>

        {isAdmin && viewMode === "customer" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setViewMode("admin");
              router.replace("/(admin)");
            }}
            className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 active:bg-accent/20"
          >
            <Text className="text-xs font-bold text-accent">Admin View</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="flex-row rounded-2xl bg-secondary p-1">
        {portalTabs.map(({ label, icon: Icon, path }) => {
          const isActive = path === "/profile"
            ? pathname === "/profile" || pathname.endsWith("/profile")
            : pathname.includes(path);

          return (
            <Pressable
              key={path}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => goToPortalTab(path)}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 ${
                isActive ? "bg-card shadow-sm" : ""
              }`}
            >
              <Icon
                size={15}
                color={isActive ? THEME.light.accent : THEME.light.mutedForeground}
              />
              <Text
                className={`text-xs font-bold ${
                  isActive ? "text-accent" : "text-muted-foreground"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
