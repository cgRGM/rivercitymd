import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import CustomersClient from "@/components/admin/customers-client";

export default async function CustomersPage() {
  const customersPreloaded = await preloadQuery(api.users.listWithStats);

  return <CustomersClient customersPreloaded={customersPreloaded} />;
}
