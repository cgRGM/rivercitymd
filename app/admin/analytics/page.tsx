import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import AnalyticsClient from "@/components/admin/analytics-client";

export default async function AnalyticsPage() {
  const analyticsPreloaded = await preloadQuery(
    api.analytics.getDashboardAnalytics,
    { months: 6 },
  );

  return <AnalyticsClient analyticsPreloaded={analyticsPreloaded} />;
}
