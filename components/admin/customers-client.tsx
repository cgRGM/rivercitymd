"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Mail, Phone, MapPin, AlertCircle } from "lucide-react";
import { useState } from "react";
// import { AddCustomerForm } from "@/components/forms"; // TODO: Fix form

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export default function CustomersClient({}: Props) {
  const customersQuery = useQuery(api.users.listWithStats);
  const [searchQuery, setSearchQuery] = useState("");
  // const [showAddForm, setShowAddForm] = useState(false); // TODO: Re-enable when form is fixed

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

  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    const fullName = (customer.name || "").toLowerCase();
    return (
      fullName.includes(query) ||
      (customer.email || "").toLowerCase().includes(query) ||
      (customer.phone || "").includes(query) ||
      customer.location?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "No visits yet";
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
        {/* TODO: Re-enable when AddCustomerForm is fixed */}
        {/* <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button> */}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name, email, phone, or location..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredCustomers.length} of {customers.length} customers
      </div>

      {/* Customer Grid */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery
                ? "No customers found matching your search"
                : "No customers yet"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add First Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredCustomers.map((customer, index) => (
            <Card
              key={customer._id}
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
          ))}
        </div>
      )}

      {/* TODO: Fix AddCustomerForm to match new schema */}
      {/* <AddCustomerForm open={showAddForm} onOpenChange={setShowAddForm} /> */}
    </div>
  );
}
