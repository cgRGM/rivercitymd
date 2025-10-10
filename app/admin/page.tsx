import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import DashboardClient from "@/components/admin/dashboard-client";

export default async function AdminPage() {
  const statsPreloaded = await preloadQuery(api.analytics.getMonthlyStats);
  const appointmentsPreloaded = await preloadQuery(
    api.appointments.getUpcoming,
  );

  return (
    <DashboardClient
      statsPreloaded={statsPreloaded}
      appointmentsPreloaded={appointmentsPreloaded}
    />
  );
}
