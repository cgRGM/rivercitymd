import { AdminMileageLogRequiredNotificationEmailTemplate } from "../convex/emailTemplates";

export default function AdminMileageLogPreview() {
  return (
    <AdminMileageLogRequiredNotificationEmailTemplate
      logId="log_abc123"
      logDate="March 15, 2026"
      businessPurpose="Customer appointment - detailing service"
      destinationLabel="123 Main St, Harrisonburg, VA 22801"
      appointmentInfo="March 15, 2026 2:30 PM"
      customerInfo="John Smith (john@example.com)"
      businessName="River City Mobile Detailing"
      adminUrl="https://rivercitymd.com/admin/logs"
    />
  );
}
