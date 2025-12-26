import CustomerDetailClient from "@/components/admin/customer-detail-client";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  return <CustomerDetailClient customerId={id as Id<"users">} />;
}

