import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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

      // Set default role to "client" if not set
      if (!user.role) {
        await ctx.db.patch(userId, {
          role: "client",
          timesServiced: 0,
          totalSpent: 0,
          status: "active",
        });
      }
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
