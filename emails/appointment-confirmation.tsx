import { AppointmentConfirmationEmail } from "../convex/emailTemplates";

export default function AppointmentConfirmationPreview() {
  return (
    <AppointmentConfirmationEmail
      customerName="John Smith"
      businessName="River City Mobile Detailing"
      appointmentDate="March 20, 2026"
      appointmentTime="2:30 PM"
      services={["Full Interior Detail", "Exterior Wash & Wax"]}
      location="123 Main St, Harrisonburg, VA 22801"
      totalPrice={249.99}
      appointmentId="apt_abc123"
      dashboardUrl="https://rivercitymd.com/dashboard/appointments"
    />
  );
}
