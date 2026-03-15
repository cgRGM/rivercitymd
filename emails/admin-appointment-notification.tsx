import { AdminAppointmentNotificationEmailTemplate } from "../convex/emailTemplates";

export default function AdminAppointmentNotificationPreview() {
  return (
    <AdminAppointmentNotificationEmailTemplate
      actionText="New Appointment Booked"
      customerName="John Smith"
      customerEmail="john@example.com"
      customerPhone="(540) 555-1234"
      appointmentDate="March 20, 2026"
      appointmentTime="2:30 PM"
      duration={120}
      totalPrice={249.99}
      serviceNames={["Full Interior Detail", "Exterior Wash & Wax"]}
      location="123 Main St, Harrisonburg, VA 22801"
      status="pending"
      notes="Please park in the driveway"
      businessName="River City Mobile Detailing"
      adminUrl="https://rivercitymd.com/admin/appointments"
    />
  );
}
