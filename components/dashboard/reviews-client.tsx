"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Calendar, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Service = {
  _id: Id<"services">;
  name: string;
  description: string;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  duration: number;
  isActive: boolean;
};

type Vehicle = {
  _id: Id<"vehicles">;
  year: number;
  make: string;
  model: string;
  color?: string;
  licensePlate?: string;
};

type Appointment = {
  _id: Id<"appointments">;
  userId: Id<"users">;
  vehicleIds: Id<"vehicles">[];
  serviceIds: Id<"services">[];
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  location: {
    street: string;
    city: string;
    state: string;
    zip: string;
    notes?: string;
  };
  status:
    | "pending"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "rescheduled";
  totalPrice: number;
  notes?: string;
  services: Service[];
  vehicles: Vehicle[];
};

type Review = {
  _id: Id<"reviews">;
  userId: Id<"users">;
  appointmentId: Id<"appointments">;
  rating: number;
  comment?: string;
  isPublic: boolean;
  reviewDate: string;
  appointment: Appointment;
};

interface ReviewsClientProps {
  reviewsPreloaded: ReturnType<typeof preloadedQueryResult>;
  pendingPreloaded: ReturnType<typeof preloadedQueryResult>;
}

function StarRating({
  rating,
  onRatingChange,
  interactive = false,
}: {
  rating: number;
  onRatingChange?: (rating: number) => void;
  interactive?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onRatingChange?.(star)}
          className={`${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
          disabled={!interactive}
        >
          <Star
            className={`w-5 h-5 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsClient({
  reviewsPreloaded,
  pendingPreloaded,
}: ReviewsClientProps) {
  const reviews = preloadedQueryResult(reviewsPreloaded);
  const pendingReviews = preloadedQueryResult(pendingPreloaded);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [newRating, setNewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const submitReview = useMutation(api.reviews.submit);

  const handleSubmitReview = async () => {
    if (!selectedAppointment) return;

    try {
      await submitReview({
        appointmentId: selectedAppointment._id,
        rating: newRating,
        comment: reviewComment || undefined,
        isPublic: true,
      });

      toast.success("Review submitted successfully!");
      setIsReviewOpen(false);
      setSelectedAppointment(null);
      setNewRating(5);
      setReviewComment("");
    } catch {
      toast.error("Failed to submit review");
    }
  };

  const openReviewDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsReviewOpen(true);
  };

  const formatAppointmentData = (appointment: Appointment) => {
    const serviceNames =
      appointment.services?.map((s) => s.name).join(", ") || "Service";
    const vehicleNames =
      appointment.vehicles
        ?.map((v) => `${v.year} ${v.make} ${v.model}`)
        .join(", ") || "Vehicle";

    return {
      service: serviceNames,
      vehicle: vehicleNames,
      date: new Date(appointment.scheduledDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  };

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((acc: number, r: Review) => acc + r.rating, 0) /
          reviews.length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold">My Reviews</h2>
        <p className="text-muted-foreground">
          View and manage your service reviews
        </p>
      </div>

      {/* Pending Reviews */}
      {pendingReviews.length > 0 && (
        <Card className="animate-fade-in-up border-accent/50">
          <CardHeader>
            <CardTitle>Pending Reviews</CardTitle>
            <CardDescription>
              Share your experience with these recent services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingReviews.map((appointment: Appointment) => {
              const formatted = formatAppointmentData(appointment);
              return (
                <div
                  key={appointment._id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-accent/5"
                >
                  <div>
                    <div className="font-semibold">{formatted.service}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatted.vehicle}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      {formatted.date}
                    </div>
                  </div>
                  <Button onClick={() => openReviewDialog(appointment)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Write Review
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Review Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{reviews.length}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Total Reviews
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="animate-fade-in-up"
          style={{ animationDelay: "100ms" }}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold flex items-center justify-center gap-1">
                {averageRating}
                <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Average Rating
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="animate-fade-in-up"
          style={{ animationDelay: "150ms" }}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{pendingReviews.length}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Pending Reviews
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Reviews */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Your Reviews</CardTitle>
          <CardDescription>Reviews you&apos;ve submitted</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">
                Your reviews will appear here after completing services.
              </p>
            </div>
          ) : (
            reviews.map((review: Review) => {
              const formatted = formatAppointmentData(review.appointment);
              return (
                <div
                  key={review._id}
                  className="p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">{formatted.service}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatted.vehicle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(review.reviewDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mt-3">
                      {review.comment}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>
              Share your experience with this service
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service Details</Label>
                <div className="p-3 bg-secondary rounded-lg text-sm">
                  <div className="font-medium">
                    {formatAppointmentData(selectedAppointment).service}
                  </div>
                  <div className="text-muted-foreground">
                    {formatAppointmentData(selectedAppointment).vehicle}
                  </div>
                  <div className="text-muted-foreground">
                    {formatAppointmentData(selectedAppointment).date}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <StarRating
                  rating={newRating}
                  onRatingChange={setNewRating}
                  interactive
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-comment">Your Review</Label>
                <Textarea
                  id="review-comment"
                  placeholder="Tell us about your experience..."
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setIsReviewOpen(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSubmitReview}>
                  Submit Review
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
