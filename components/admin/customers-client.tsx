"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Mail, Phone, MapPin, AlertCircle, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { AddCustomerForm } from "@/components/forms";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export default function CustomersClient({}: Props) {
  const customersQuery = useQuery(api.users.listWithStats);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Handle loading state
  if (customersQuery === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Customers</h2>
            <p className="text-muted-foreground mt-1">
              Manage your customer database
            </p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="space-y-2 mb-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-44" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (customersQuery === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Customers</h2>
          <p className="text-muted-foreground mt-1">
            Manage your customer database
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load customers
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading the customer data. Please try again
              later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customers = customersQuery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredCustomers = customers.filter((customer: any) => {
    const query = searchQuery.toLowerCase();
    const fullName = (customer.name || "").toLowerCase();
    return (
      fullName.includes(query) ||
      (customer.email || "").toLowerCase().includes(query) ||
      (customer.phone || "").includes(query) ||
      customer.location?.toLowerCase().includes(query)
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Customer
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name") || "Unknown"}</div>
      ),
    },
    {
      accessorKey: "email",
      header: "Contact",
      cell: ({ row }) => (
        <div className="flex flex-col text-sm">
           <div className="flex items-center gap-1">
             <Mail className="w-3 h-3 text-muted-foreground" />
             {row.getValue("email")}
           </div>
           <div className="flex items-center gap-1">
             <Phone className="w-3 h-3 text-muted-foreground" />
             {row.original.phone}
           </div>
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="w-3 h-3 text-muted-foreground" />
          {row.getValue("location") || "-"}
        </div>
      ),
    },
    {
      accessorKey: "totalSpent",
      header: ({ column }) => {
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Total Spent
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("totalSpent"));
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: "lastVisit",
      header: ({ column }) => {
        return (
           <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
              Stats
              <ArrowUpDown className="ml-2 h-4 w-4" />
           </Button>
        )
      },
      cell: ({ row }) => {
         const customer = row.original;
         return (
            <div className="text-sm">
               <div>Bookings: {customer.totalBookings}</div>
               <div className="text-muted-foreground text-xs">Last: {formatDate(customer.lastVisit)}</div>
            </div>
         )
      }
    },
    {
       id: "actions",
       cell: ({ row }) => {
         return (
            <Button asChild variant="ghost" size="sm">
               <Link href={`/admin/customers/${row.original._id}`}>
                  View Details
               </Link>
            </Button>
         )
       }
    }
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCreatedDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.getFullYear();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Customers</h2>
          <p className="text-muted-foreground">
            Manage your customer relationships
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

       {/* Mobile Search - integrated into DataTable on Desktop */}
       <div className="md:hidden relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
       </div>

      {/* Desktop View: Data Table */}
      <div className="hidden md:block">
         <DataTable 
            columns={columns} 
            data={customers} 
            filterColumn="name" 
            filterPlaceholder="Search customers by name..."
         />
      </div>

      {/* Mobile View: Cards */}
      <div className="md:hidden grid gap-4">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                 No customers found.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          filteredCustomers.map((customer: any, index: number) => (
            <Link
              key={customer._id}
              href={`/admin/customers/${customer._id}`}
              className="block"
            >
              <Card
                className="animate-fade-in-up hover:shadow-lg transition-all cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      {customer.name || "Unknown Customer"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Customer since {formatCreatedDate(customer._creationTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-muted-foreground">
                      Total Spent
                    </div>
                    <div className="text-xl font-bold text-accent">
                      ${customer.totalSpent.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {customer.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {customer.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {customer.location || "No location"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Total Appointments
                    </div>
                    <div className="font-semibold">
                      {customer.totalBookings}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Last Visit
                    </div>
                    <div className="font-semibold">
                      {formatDate(customer.lastVisit)}
                    </div>
                  </div>
                </div>

                {customer.status === "inactive" && (
                  <div className="mt-4 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-center">
                    <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                      Inactive Customer
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            </Link>
          ))
        )}
      </div>

      <AddCustomerForm open={showAddForm} onOpenChange={setShowAddForm} />
    </div>
  );
}
