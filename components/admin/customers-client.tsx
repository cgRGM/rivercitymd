"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Mail, Phone, MapPin } from "lucide-react";
import { useState } from "react";
// import { AddCustomerForm } from "@/components/forms"; // TODO: Fix form

type Props = {
  customersPreloaded: Preloaded<typeof api.users.listWithStats>;
};

export default function CustomersClient({ customersPreloaded }: Props) {
  const customers = usePreloadedQuery(customersPreloaded);
  const [searchQuery, setSearchQuery] = useState("");
  // const [showAddForm, setShowAddForm] = useState(false); // TODO: Re-enable when form is fixed

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
