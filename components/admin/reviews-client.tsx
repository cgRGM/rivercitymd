"use client";

import { useQuery } from "convex/react";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpDown,
  MoreHorizontal,
  Star,
} from "lucide-react";

type ReviewRecord = {
  _id: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
  reviewDate: string;
  appointmentDate: string | null;
  services: Array<{ _id: string; name: string }>;
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function ReviewsClient() {
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
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Access Denied</h3>
            <p className="text-muted-foreground">You must be an admin to view reviews.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reviews = reviewsQuery as ReviewRecord[];

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const columns: ColumnDef<ReviewRecord>[] = [
    {
      accessorKey: "customerName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <p className="font-medium">{row.original.customerName}</p>
          <p className="text-xs text-muted-foreground">{row.original.customerEmail}</p>
        </div>
      ),
    },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ row }) => <StarRating rating={row.original.rating} />,
    },
    {
      id: "services",
      accessorFn: (row) => row.services.map((service) => service.name).join(", "),
      header: "Services",
      cell: ({ row }) => {
        const names = row.original.services.map((service) => service.name).join(", ");
        return <span className="min-w-[180px] text-sm">{names || "-"}</span>;
      },
    },
    {
      accessorKey: "comment",
      header: "Comment",
      cell: ({ row }) =>
        row.original.comment ? (
          <span className="block min-w-[220px] max-w-[340px] truncate text-sm">
            {row.original.comment}
          </span>
        ) : (
          <span className="text-sm italic text-muted-foreground">No comment</span>
        ),
    },
    {
      accessorKey: "reviewDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{formatDate(row.original.reviewDate)}</span>,
    },
    {
      accessorKey: "isPublic",
      header: "Visibility",
      cell: ({ row }) => (
        <Badge variant={row.original.isPublic ? "default" : "outline"}>
          {row.original.isPublic ? "Public" : "Private"}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open actions</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => void copyText(row.original._id, "Copied review ID")}
            >
              Copy review ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                row.original.customerEmail
                  ? void copyText(row.original.customerEmail, "Copied customer email")
                  : toast.error("No email available")
              }
            >
              Copy customer email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold">Reviews</h2>
        <p className="text-muted-foreground">
          View and manage all customer reviews ({reviews.length})
        </p>
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        filterColumn="customerName"
        filterPlaceholder="Search by customer..."
        tableMinWidthClass="min-w-[1120px]"
      />
    </div>
  );
}
