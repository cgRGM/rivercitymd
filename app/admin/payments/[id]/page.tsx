import PaymentDetailClient from "@/components/admin/payment-detail-client";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminPaymentDetailPage({ params }: Props) {
  const { id } = await params;
  return <PaymentDetailClient invoiceId={id as Id<"invoices">} />;
}
