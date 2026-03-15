import InvoiceDetailClient from "@/components/admin/invoice-detail-client";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminInvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  return <InvoiceDetailClient invoiceId={id as Id<"invoices">} />;
}
