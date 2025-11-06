import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import Stripe from "stripe";

// Initialize Stripe with environment variable
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY environment variable is not set. Please set it in your Convex environment.",
  );
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: params.email as string,
        };
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Only set up new users (not updates)
      if (existingUserId) {
        return;
      }

      // Get the user to check their email
      const user = await ctx.db.get(userId);
      if (!user) return;

      // Create Stripe customer for new users
      let stripeCustomerId: string | undefined;
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            convexUserId: userId,
          },
        });
        stripeCustomerId = customer.id;
      } catch (error) {
        console.error("Failed to create Stripe customer:", error);
        // Continue with user creation even if Stripe customer creation fails
      }

      // Set default role and Stripe customer ID
      const updateData: any = {
        role: "client",
        timesServiced: 0,
        totalSpent: 0,
        status: "active",
      };

      if (stripeCustomerId) {
        updateData.stripeCustomerId = stripeCustomerId;
      }

      await ctx.db.patch(userId, updateData);
    },
  },
});

// Get the current user's role
export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      type: user.role || "client",
      userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
  },
});

// Get current authenticated user's info
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      userId,
      email: user.email || null,
      name: user.name || null,
      phone: user.phone || null,
      role: user.role || "client",
    };
  },
});
