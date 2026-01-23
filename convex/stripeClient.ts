import { components } from "./_generated/api";
import { StripeSubscriptions } from "@convex-dev/stripe";

// Create a shared Stripe client instance
// This uses the component's StripeSubscriptions client for customer management and checkout
export const stripeClient = new StripeSubscriptions(components.stripe, {
  // STRIPE_SECRET_KEY is optional here - it defaults to process.env.STRIPE_SECRET_KEY
});
