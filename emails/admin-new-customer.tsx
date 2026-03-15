import { AdminNewCustomerNotificationEmail } from "../convex/emailTemplates";

export default function AdminNewCustomerPreview() {
  return (
    <AdminNewCustomerNotificationEmail
      userName="Jane Doe"
      userEmail="jane@example.com"
      userPhone="(540) 555-1234"
      userAddress="456 Oak Ave, Harrisonburg, VA 22802"
      vehicleCount={2}
      signupDate="March 15, 2026"
      businessName="River City Mobile Detailing"
      adminUrl="https://rivercitymd.com/admin/customers"
    />
  );
}
