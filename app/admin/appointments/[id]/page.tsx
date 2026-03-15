import AppointmentDetailClient from "@/components/admin/appointment-detail-client";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminAppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  return <AppointmentDetailClient appointmentId={id as Id<"appointments">} />;
}
