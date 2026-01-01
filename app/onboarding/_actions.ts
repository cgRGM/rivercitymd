"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

export const completeOnboarding = async () => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Not authenticated" };
  }

  const client = await clerkClient();

  try {
    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("Error updating user metadata:", err);
    return { error: "There was an error updating the user metadata." };
  }
};

