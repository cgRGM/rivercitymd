import { AdminDepositPaidNotificationEmail } from "../convex/emailTemplates";

export default function AdminDepositPaidPreview() {
  return (
    <AdminDepositPaidNotificationEmail
      customerName="John Smith"
      customerEmail="john@example.com"
      customerPhone="(540) 555-1234"
      appointmentDate="March 20, 2026"
      appointmentTime="2:30 PM"
      serviceNames={["Full Interior Detail", "Exterior Wash & Wax"]}
      location="123 Main St, Harrisonburg, VA 22801"
      depositAmount={50.0}
      totalPrice={249.99}
      businessName="River City Mobile Detailing"
      appointmentUrl="https://rivercitymd.com/admin/appointments/apt_abc123"
    />
  );
}
