import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import AppointmentsClient from "@/components/admin/appointments-client";

export default async function AppointmentsPage() {
  const appointmentsPreloaded = await preloadQuery(
    api.appointments.listWithDetails,
    {},
  );

  return <AppointmentsClient appointmentsPreloaded={appointmentsPreloaded} />;
}
