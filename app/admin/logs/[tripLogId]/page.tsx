import TripLogDetailClient from "@/components/admin/trip-log-detail-client";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ tripLogId: string }>;
};

export default async function AdminTripLogDetailPage({ params }: Props) {
  const { tripLogId } = await params;
  return <TripLogDetailClient tripLogId={tripLogId as Id<"tripLogs">} />;
}
