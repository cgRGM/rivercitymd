"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Plus, ArrowRight } from "lucide-react";
import AppointmentModal from "@/components/home/appointment-modal";
import { useCart } from "@/components/cart-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";

export function PricingSection() {
  const { isAuthenticated } = useConvexAuth();

  // Fetch services and user vehicles
  const servicesQuery = useQuery(api.services.listWithCategories);
  const userVehicles = useQuery(api.vehicles.getMyVehicles);

  // Transform services data for display
  const mainServices =
    servicesQuery?.filter(
      (service) =>
        service.categoryName === "Standard" ||
        service.categoryName === "standard",
    ) || [];

  const addOns =
    servicesQuery?.filter(
      (service) =>
        service.categoryName === "Add-on" ||
        service.categoryName === "Addon" ||
        service.categoryName === "add-on" ||
        service.categoryName === "addon",
    ) || [];

  // For authenticated users, use their vehicle size; otherwise use selected size
  const [selectedSize, setSelectedSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [showVehicleStep, setShowVehicleStep] = useState(false);
  const [tempVehicleSize, setTempVehicleSize] = useState<
    "small" | "medium" | "large"
  >("medium");

  const { addToCart } = useCart();

  // Determine which size to use for pricing
  const effectiveSize =
    isAuthenticated && userVehicles && userVehicles.length > 0
      ? userVehicles[0].size || "medium" // Use first vehicle's size, fallback to medium
      : selectedSize;

  // Handle loading state
  if (servicesQuery === undefined) {
    return (
      <section
        id="pricing"
        className="py-24 bg-gradient-to-b from-background to-secondary/20"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Skeleton className="h-12 w-96 mx-auto mb-4" />
            <Skeleton className="h-6 w-80 mx-auto mb-8" />
            <Skeleton className="h-12 w-64 mx-auto" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="text-center pb-4">
                  <Skeleton className="h-8 w-8 mx-auto mb-2" />
                  <Skeleton className="h-6 w-32 mx-auto mb-2" />
                  <Skeleton className="h-4 w-48 mx-auto mb-4" />
                  <Skeleton className="h-8 w-24 mx-auto" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Handle error state
  if (servicesQuery === null) {
    return (
      <section
        id="pricing"
        className="py-24 bg-gradient-to-b from-background to-secondary/20"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-4">Unable to load services</h2>
            <p className="text-muted-foreground">Please try again later.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        id="pricing"
        className="py-24 bg-gradient-to-b from-background to-secondary/20"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-balance">
              Transparent pricing for quality service
            </h2>

            {isAuthenticated && userVehicles && userVehicles.length > 0 ? (
              // Authenticated user with vehicles
              <div className="mb-8">
                <p className="text-lg text-muted-foreground mb-4">
                  Pricing for your{" "}
                  <span className="font-semibold">
                    {userVehicles[0].year} {userVehicles[0].make}{" "}
                    {userVehicles[0].model}
                  </span>{" "}
                  ({userVehicles[0].size || "medium"} size vehicle)
                </p>
                <p className="text-sm text-muted-foreground">
                  Professional-grade products, non-toxic and eco-friendly.
                </p>
              </div>
            ) : showVehicleStep ? (
              // Multi-step flow for unauthenticated users - Step 2: Services
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowVehicleStep(false)}
                    className="text-sm"
                  >
                    ← Back to vehicle selection
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Step 2 of 2
                  </span>
                </div>
                <p className="text-lg text-muted-foreground mb-4">
                  Services for{" "}
                  <span className="font-semibold">
                    {tempVehicleSize === "small"
                      ? "Small/Compact"
                      : tempVehicleSize === "medium"
                        ? "Mid-Size SUV"
                        : "Truck/Large"}{" "}
                    vehicles
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Professional-grade products, non-toxic and eco-friendly.
                </p>
              </div>
            ) : (
              // Multi-step flow for unauthenticated users - Step 1: Vehicle selection
              <div className="mb-8">
                <p className="text-lg text-muted-foreground mb-6">
                  Select your vehicle type to see accurate pricing
                </p>
                <div className="max-w-md mx-auto">
                  <Tabs
                    value={tempVehicleSize}
                    onValueChange={(value) =>
                      setTempVehicleSize(value as "small" | "medium" | "large")
                    }
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-secondary/50">
                      <TabsTrigger
                        value="small"
                        className="text-xs sm:text-sm py-3 data-[state=active]:bg-background"
                      >
                        Small / Compact
                      </TabsTrigger>
                      <TabsTrigger
                        value="medium"
                        className="text-xs sm:text-sm py-3 data-[state=active]:bg-background"
                      >
                        Mid-Size SUV
                      </TabsTrigger>
                      <TabsTrigger
                        value="large"
                        className="text-xs sm:text-sm py-3 data-[state=active]:bg-background"
                      >
                        Truck / Large
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button
                    onClick={() => setShowVehicleStep(true)}
                    className="w-full mt-6"
                  >
                    Continue to Services
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Only show services when we have a vehicle size selected */}
          {(isAuthenticated && userVehicles && userVehicles.length > 0) ||
          showVehicleStep ? (
            <>
              {/* Main Services */}
              <div className="mb-16">
                <motion.h3
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-2xl font-bold text-center mb-8"
                >
                  Main Services
                </motion.h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                  {mainServices.map((service, index) => {
                    const price =
                      effectiveSize === "small"
                        ? service.basePriceSmall
                        : effectiveSize === "medium"
                          ? service.basePriceMedium
                          : service.basePriceLarge;

                    return (
                      <motion.div
                        key={service._id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                      >
                        <Card className="relative hover:shadow-xl transition-all h-full">
                          <CardHeader className="text-center pb-4">
                            {service.icon && (
                              <div className="text-4xl mb-2">
                                {service.icon}
                              </div>
                            )}
                            <CardTitle className="text-xl">
                              {service.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {service.description}
                            </CardDescription>
                            <div className="mt-4">
                              <span className="text-3xl font-bold">
                                ${price?.toFixed(2) || "N/A"}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">
                                {Math.floor(service.duration / 60)}h{" "}
                                {service.duration % 60}m
                              </p>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {service.features &&
                              service.features.length > 0 && (
                                <ul className="space-y-2">
                                  {service.features
                                    .slice(0, 4)
                                    .map((feature, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start gap-2 text-sm"
                                      >
                                        <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                      </li>
                                    ))}
                                  {service.features.length > 4 && (
                                    <li className="text-muted-foreground text-sm">
                                      +{service.features.length - 4} more
                                      features
                                    </li>
                                  )}
                                </ul>
                              )}
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={() =>
                                addToCart({
                                  name: service.name,
                                  price: price || 0,
                                  type: "service",
                                  serviceId: service._id,
                                })
                              }
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add to Cart
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Add-Ons */}
              <div>
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="text-2xl font-bold text-center mb-4">
                    Add-Ons
                  </h3>
                  <p className="text-center text-muted-foreground mb-8">
                    Enhance your service with premium add-ons
                  </p>
                </motion.div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                  {addOns.map((addon, index) => {
                    // For add-ons, check if it's a single price or price range
                    const isPriceRange =
                      addon.basePriceMedium && addon.basePriceMedium > 0;
                    const displayPrice = isPriceRange
                      ? `$${addon.basePriceSmall?.toFixed(2)} - $${addon.basePriceMedium?.toFixed(2)}`
                      : `$${addon.basePriceSmall?.toFixed(2) || "N/A"}`;

                    return (
                      <motion.div
                        key={addon._id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                      >
                        <Card className="hover:shadow-lg transition-shadow h-full">
                          <CardHeader className="text-center pb-4">
                            {addon.icon && (
                              <div className="text-3xl mb-2">{addon.icon}</div>
                            )}
                            <CardTitle className="text-lg">
                              {addon.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {addon.description}
                            </CardDescription>
                            <div className="mt-3">
                              <span className="text-2xl font-bold">
                                {displayPrice}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {addon.features && addon.features.length > 0 && (
                              <ul className="space-y-2">
                                {addon.features
                                  .slice(0, 3)
                                  .map((feature, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2 text-sm"
                                    >
                                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                                      <span>{feature}</span>
                                    </li>
                                  ))}
                                {addon.features.length > 3 && (
                                  <li className="text-muted-foreground text-sm">
                                    +{addon.features.length - 3} more features
                                  </li>
                                )}
                              </ul>
                            )}
                            <Button
                              className="w-full bg-transparent"
                              variant="outline"
                              onClick={() =>
                                addToCart({
                                  name: addon.name,
                                  price: addon.basePriceSmall || 0,
                                  type: "addon",
                                  serviceId: addon._id,
                                })
                              }
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add to Cart
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <AppointmentModal open={bookingOpen} onOpenChange={setBookingOpen} />
    </>
  );
}
