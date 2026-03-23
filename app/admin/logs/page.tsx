import WebhookHealthClient from "@/components/admin/webhook-health-client";
import TripLogsClient from "@/components/admin/trip-logs-client";

export const dynamic = "force-dynamic";

export default function AdminLogsPage() {
  return (
    <div className="space-y-8">
      <WebhookHealthClient />
      <TripLogsClient />
    </div>
  );
}
