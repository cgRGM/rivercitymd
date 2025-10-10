"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddServiceForm } from "@/components/forms";

type Props = {
  servicesPreloaded: Preloaded<typeof api.services.listWithBookingStats>;
};

export default function ServicesClient({ servicesPreloaded }: Props) {
  const services = usePreloadedQuery(servicesPreloaded);
  const [showAddForm, setShowAddForm] = useState(false);

  const getPopularityColor = (popularity: string) => {
    switch (popularity) {
      case "Very High":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "High":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "Medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Services</h2>
          <p className="text-muted-foreground">Manage your service offerings</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map((service, index) => (
          <Card
            key={service._id}
            className="animate-fade-in-up hover:shadow-lg transition-all"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{service.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {service.description}
                  </CardDescription>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {service.categoryName}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Small
                  </div>
                  <div className="font-semibold">
                    $
                    {service.basePriceSmall?.toFixed(2) ||
                      service.basePrice?.toFixed(2) ||
                      "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Medium
                  </div>
                  <div className="font-semibold">
                    $
                    {service.basePriceMedium?.toFixed(2) ||
                      service.basePrice?.toFixed(2) ||
                      "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Large
                  </div>
                  <div className="font-semibold">
                    $
                    {service.basePriceLarge?.toFixed(2) ||
                      service.basePrice?.toFixed(2) ||
                      "N/A"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="font-medium">
                    {Math.floor(service.duration / 60)}h {service.duration % 60}
                    m
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Bookings</div>
                  <div className="font-medium">
                    {service.bookings} this month
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Popularity:
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getPopularityColor(service.popularity)}`}
                >
                  {service.popularity}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddServiceForm open={showAddForm} onOpenChange={setShowAddForm} />
    </div>
  );
}
