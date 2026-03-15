import { CustomerReviewRequestEmailTemplate } from "../convex/emailTemplates";

export default function CustomerReviewRequestPreview() {
  return (
    <CustomerReviewRequestEmailTemplate
      customerName="John Smith"
      appointmentDate="March 15, 2026"
      serviceNames={["Full Interior Detail", "Exterior Wash & Wax"]}
      businessName="River City Mobile Detailing"
      reviewUrl="https://rivercitymd.com/dashboard/reviews"
    />
  );
}
