import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import ReviewsClient from "@/components/dashboard/reviews-client";

export default async function ReviewsPage() {
  const reviewsPreloaded = await preloadQuery(
    api.reviews.getUserReviewsWithDetails,
  );
  const pendingPreloaded = await preloadQuery(api.reviews.getPendingReviews);

  return (
    <ReviewsClient
      reviewsPreloaded={reviewsPreloaded}
      pendingPreloaded={pendingPreloaded}
    />
  );
}
