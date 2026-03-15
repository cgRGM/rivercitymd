import { AppointmentReminderEmail } from "../convex/emailTemplates";

export default function AppointmentReminderPreview() {
  return (
    <AppointmentReminderEmail
      customerName="John Smith"
      businessName="River City Mobile Detailing"
      appointmentDate="March 20, 2026"
      appointmentTime="2:30 PM"
      services={["Full Interior Detail", "Exterior Wash & Wax"]}
      location="123 Main St, Harrisonburg, VA 22801"
      dashboardUrl="https://rivercitymd.com/dashboard/appointments"
    />
  );
}
