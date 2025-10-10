import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import DashboardClient from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const upcomingAppointmentsPreloaded = await preloadQuery(
    api.appointments.getUpcoming,
  );
  const userStatsPreloaded = await preloadQuery(api.users.getCurrentUser);

  return (
    <DashboardClient
      upcomingAppointmentsPreloaded={upcomingAppointmentsPreloaded}
      userStatsPreloaded={userStatsPreloaded}
    />
  );
}
