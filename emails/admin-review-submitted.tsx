import { AdminReviewSubmittedNotificationEmail } from "../convex/emailTemplates";

export default function AdminReviewSubmittedPreview() {
  return (
    <AdminReviewSubmittedNotificationEmail
      customerName="John Smith"
      customerEmail="john@example.com"
      rating={5}
      stars="⭐⭐⭐⭐⭐"
      comment="Excellent service! My car looks brand new. Will definitely book again."
      isPublic={true}
      appointmentDate="March 15, 2026"
      serviceNames={["Full Interior Detail", "Exterior Wash & Wax"]}
      businessName="River City Mobile Detailing"
      adminUrl="https://rivercitymd.com/admin/reviews"
    />
  );
}
