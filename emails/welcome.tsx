import { WelcomeEmail } from "../convex/emailTemplates";

export default function WelcomePreview() {
  return (
    <WelcomeEmail
      userName="John Smith"
      businessName="River City Mobile Detailing"
      dashboardUrl="https://rivercitymd.com/dashboard"
    />
  );
}
