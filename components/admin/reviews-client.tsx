"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function ReviewsClient({}: Props) {
  const reviewsQuery = useQuery(api.reviews.listForAdmin);

  if (reviewsQuery === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Reviews</h2>
          <p className="text-muted-foreground">Manage customer reviews</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (reviewsQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Reviews</h2>
          <p className="text-muted-foreground">Manage customer reviews</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You must be an admin to view reviews.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews = reviewsQuery as any[];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold">Reviews</h2>
        <p className="text-muted-foreground">
          View and manage all customer reviews ({reviews.length})
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
          <CardDescription>
            Customer feedback and ratings for your services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No reviews yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {reviews.map((review: any) => (
                  <TableRow key={review._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{review.customerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {review.customerEmail}
                        </div>
                        {review.appointmentDate && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Appointment: {formatDate(review.appointmentDate)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StarRating rating={review.rating} />
                    </TableCell>
                    <TableCell className="max-w-md">
                      {review.comment ? (
                        <p className="text-sm">{review.comment}</p>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">
                          No comment
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(review.reviewDate)}</TableCell>
                    <TableCell>
                      <Badge variant={review.isPublic ? "default" : "outline"}>
                        {review.isPublic ? "Public" : "Private"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

