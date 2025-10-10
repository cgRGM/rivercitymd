import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import ServicesClient from "@/components/admin/services-client";

export default async function ServicesPage() {
  const servicesPreloaded = await preloadQuery(
    api.services.listWithBookingStats,
  );

  return <ServicesClient servicesPreloaded={servicesPreloaded} />;
}
