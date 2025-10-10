import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import AppointmentsClient from "@/components/dashboard/appointments-client";

export default async function AppointmentsPage() {
  const appointmentsPreloaded = await preloadQuery(
    api.appointments.getUserAppointments,
  );

  return <AppointmentsClient appointmentsPreloaded={appointmentsPreloaded} />;
}
