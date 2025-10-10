import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import ProfileClient from "@/components/dashboard/profile-client";

export default async function ProfilePage() {
  const userPreloaded = await preloadQuery(api.users.getCurrentUser);

  return <ProfileClient userPreloaded={userPreloaded} />;
}
