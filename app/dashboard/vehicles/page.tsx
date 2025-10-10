import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import VehiclesClient from "@/components/dashboard/vehicles-client";

export default async function VehiclesPage() {
  const vehiclesPreloaded = await preloadQuery(api.vehicles.getMyVehicles);

  return <VehiclesClient vehiclesPreloaded={vehiclesPreloaded} />;
}
