
import { api } from "./convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function main() {
  console.log("Fetching recent appointments...");
  const appointments = await client.query(api.appointments.listWithDetails, {});
  
  // Sort by creation time descending (assuming _creationTime is available, or use specific sort)
  // appointments from listWithDetails are already sorted by date, but maybe not creation time.
  // let's just take the last 5 from the list (which seems to be sorted by scheduledDate).
  // Actually, let's query raw to be sure.
  
  // We can't query raw easily from outside without an admin function exposing it.
  // But `listWithDetails` exposes what the admin sees.
  
  console.log(`Found ${appointments.length} appointments.`);
  
  // Check the most recent ones (or filtering for "Unknown User" in the script)
  const unknownUsers = appointments.filter(a => !a.user || !a.user.name);
  
  console.log(`Found ${unknownUsers.length} appointments with Unknown User.`);
  if (unknownUsers.length > 0) {
      console.log("Details of first 3 unknown users:");
      unknownUsers.slice(0, 3).forEach(apt => {
          console.log({
              appointmentId: apt._id,
              userId: apt.userId,
              userObject: apt.user,
              scheduledDate: apt.scheduledDate
          });
      });
  } else {
      console.log("No unknown users found in the current list.");
      // Maybe check the last few valid ones to see what they look like
      const valid = appointments.slice(0, 3);
      console.log("Sample valid appointments:");
      valid.forEach(apt => {
        console.log({
            id: apt._id,
            user: apt.user ? { name: apt.user.name, email: apt.user.email, id: apt.user._id } : "null"
        });
      });
  }
}

main().catch(console.error);
