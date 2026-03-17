"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { AddCustomerForm, EditCustomerForm } from "@/components/forms";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpDown,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
} from "lucide-react";

type CustomerRecord = {
  _id: Id<"users">;
  _creationTime: number;
  name?: string;
  email?: string;
  phone?: string;
  address?: { street: string; city: string; state: string; zip: string };
  notes?: string;
  status?: "active" | "inactive";
  totalSpent?: number;
  totalBookings?: number;
  lastVisit?: string | null;
  location?: string;
};

export default function CustomersClient() {
  const router = useRouter();
  const customersQuery = useQuery(api.users.listWithStats) as
    | CustomerRecord[]
    | null
    | undefined;
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const backfillStripeCustomers = useMutation(api.users.backfillMissingStripeCustomers);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCreatedYear = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.getFullYear();
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const columns: ColumnDef<CustomerRecord>[] = [
    {
      accessorKey: "name",
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
          <p className="font-medium">{row.original.name || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">
            Customer since {formatCreatedYear(row.original._creationTime)}
          </p>
        </div>
      ),
    },
    {
      id: "contact",
      accessorFn: (row) => `${row.email || ""} ${row.phone || ""}`,
      header: "Contact",
      cell: ({ row }) => (
        <div className="min-w-[220px] space-y-1 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {row.original.email || "No email"}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {row.original.phone || "No phone"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <div className="flex min-w-[180px] items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{row.original.location || "No location"}</span>
        </div>
      ),
    },
    {
      accessorKey: "totalSpent",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total Spent
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const amount = row.original.totalSpent || 0;
        return (
          <span className="font-medium">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(amount)}
          </span>
        );
      },
    },
    {
      id: "stats",
      accessorFn: (row) => row.totalBookings ?? 0,
      header: "Stats",
      cell: ({ row }) => (
        <div className="min-w-[160px] text-sm">
          <p>Bookings: {row.original.totalBookings || 0}</p>
          <p className="text-xs text-muted-foreground">
            Last: {formatDate(row.original.lastVisit)}
          </p>
        </div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="sr-only">Open actions</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/admin/customers/${row.original._id}`}>View Details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setEditingCustomer(row.original);
              }}
            >
              Edit Customer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                row.original.email
                  ? void copyToClipboard(row.original.email, "Copied customer email")
                  : toast.error("No email available")
              }
            >
              Copy Email
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                row.original.phone
                  ? void copyToClipboard(row.original.phone, "Copied customer phone")
                  : toast.error("No phone available")
              }
            >
              Copy Phone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (customersQuery === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Customers</h2>
            <p className="mt-1 text-muted-foreground">Manage your customer database</p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <Card>
          <CardContent className="py-10">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (customersQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Customers</h2>
          <p className="mt-1 text-muted-foreground">Manage your customer database</p>
        </div>

        <Card className="py-12 text-center">
          <CardContent>
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Unable to load customers</h3>
            <p className="mb-6 text-muted-foreground">
              There was an error loading customer data. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Customers</h2>
          <p className="text-muted-foreground">Manage your customer relationships</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setIsSyncing(true);
              try {
                const result = await backfillStripeCustomers({});
                toast.success(`Synced ${result.scheduled} customer${result.scheduled !== 1 ? "s" : ""} to Stripe`);
              } catch (err) {
                toast.error("Failed to sync Stripe customers");
              } finally {
                setIsSyncing(false);
              }
            }}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync Stripe
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={customersQuery}
        filterColumn="name"
        filterPlaceholder="Search customers by name..."
        tableMinWidthClass="min-w-[1080px]"
        onRowClick={(row) => router.push(`/admin/customers/${row._id}`)}
      />

      <AddCustomerForm open={showAddForm} onOpenChange={setShowAddForm} />

      {editingCustomer && (
        <EditCustomerForm
          open={!!editingCustomer}
          onOpenChange={(open) => !open && setEditingCustomer(null)}
          customer={editingCustomer}
        />
      )}
    </div>
  );
}
