import { CustomerAppointmentStatusEmailTemplate } from "../convex/emailTemplates";

export default function CustomerAppointmentStatusPreview() {
  return (
    <CustomerAppointmentStatusEmailTemplate
      customerName="John Smith"
      statusLabel="Confirmed"
      summaryLine="Your appointment has been confirmed."
      appointmentDate="March 20, 2026"
      appointmentTime="2:30 PM"
      serviceNames={["Full Interior Detail", "Exterior Wash & Wax"]}
      location="123 Main St, Harrisonburg, VA 22801"
      businessName="River City Mobile Detailing"
      dashboardUrl="https://rivercitymd.com/dashboard/appointments"
    />
  );
}
