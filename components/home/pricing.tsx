"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Check, Calendar } from "lucide-react";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LandingPricingService = {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  features?: string[];
  price: number;
  duration: number;
};

type LandingPricingGroup = {
  vehicleType: {
    _id: string;
    name: string;
  };
  services: LandingPricingService[];
};

export function PricingSection() {
  const router = useRouter();
  const pricingQuery = useQuery(api.services.listLandingPagePricing) as
    | LandingPricingGroup[]
    | undefined
    | null;
  const bookingReadiness = useQuery(
    api.setupReadiness.getPublicBookingReadiness,
  );

  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!pricingQuery?.length) return;
    const hasSelected = pricingQuery.some(
      (group) => group.vehicleType._id === selectedVehicleTypeId,
    );
    if (!hasSelected) {
      setSelectedVehicleTypeId(pricingQuery[0].vehicleType._id);
    }
  }, [pricingQuery, selectedVehicleTypeId]);

  const selectedGroup =
    pricingQuery?.find(
      (group) => group.vehicleType._id === selectedVehicleTypeId,
    ) ?? pricingQuery?.[0];
  const mainServices = selectedGroup?.services ?? [];

  const handleBookNow = () => {
    if (bookingReadiness && !bookingReadiness.isReady) {
      router.push("/sign-up");
      return;
    }
    if (bookingReadiness === undefined) return;
    router.push("/book");
  };

  // Loading state
  if (pricingQuery === undefined) {
    return (
      <section
        id="pricing"
        className="py-24 bg-gradient-to-b from-background to-secondary/20"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Skeleton className="h-10 w-80 mx-auto mb-4" />
            <Skeleton className="h-5 w-64 mx-auto mb-8" />
            <Skeleton className="h-10 w-56 mx-auto" />
          </div>
          {/* Skeleton cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 max-w-6xl mx-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="rounded-xl border border-border/40 bg-background overflow-hidden">
                  <div className="h-0.5 w-full bg-border/50" />
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-5 w-36 mx-auto" />
                    <Skeleton className="h-3 w-48 mx-auto" />
                    <Skeleton className="h-8 w-20 mx-auto mt-2" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                    <div className="pt-2 border-t border-border/30 grid grid-cols-2 gap-1.5">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <Skeleton key={j} className="h-3 w-full" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (pricingQuery === null) {
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
          {/* Heading */}
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
            <p className="text-lg text-muted-foreground mb-2">
              Mobile detailing packages matched to your vehicle
            </p>
            <p className="text-sm text-muted-foreground">
              Choose a vehicle type to see the services currently offered for it.
            </p>
          </motion.div>

          {/* Vehicle Type Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl mx-auto mb-10"
          >
            <p className="text-center text-sm text-muted-foreground mb-5">
              Select your vehicle type to see accurate pricing
            </p>
            <div
              role="tablist"
              className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border/40 bg-secondary/40 p-1"
            >
              {pricingQuery.map(({ vehicleType }) => (
                <button
                  key={vehicleType._id}
                  role="tab"
                  aria-selected={selectedGroup?.vehicleType._id === vehicleType._id}
                  onClick={() => setSelectedVehicleTypeId(vehicleType._id)}
                  className={cn(
                    "min-w-24 flex-1 rounded-md px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors outline-none focus-visible:outline-none",
                    selectedGroup?.vehicleType._id === vehicleType._id
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {vehicleType.name}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Cards */}
          <div className="max-w-6xl mx-auto">
            {mainServices.length === 0 ? (
              <div className="mx-auto max-w-2xl rounded-xl border border-border/40 bg-background px-6 py-10 text-center">
                <h3 className="text-lg font-semibold">
                  Pricing is being updated
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Contact us or start booking to see the best options for your
                  vehicle.
                </p>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
                aria-label="Service pricing cards"
              >
              {mainServices.map((service, index) => {
                const usesTwoColFeatures =
                  service.features && service.features.length >= 4;

                return (
                  <motion.div
                    key={service._id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.45, delay: index * 0.1 }}
                    className="flex flex-col"
                  >
                    <div className="relative flex flex-col flex-1 rounded-xl border border-border/40 bg-background overflow-hidden transition-all duration-300 hover:border-border/70 hover:shadow-md group">
                      {/* Top accent strip */}
                      <div className="h-[3px] w-full bg-primary/70 flex-shrink-0" />

                      {/* Header */}
                      <div className="px-5 pt-5 pb-4 text-center">
                        {/* Icon + Title inline */}
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {service.icon && (
                            <span className="text-xl leading-none">
                              {service.icon}
                            </span>
                          )}
                          <h3 className="text-lg font-bold tracking-tight leading-tight">
                            {service.name}
                          </h3>
                        </div>

                        {service.description && (
                          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                            {service.description}
                          </p>
                        )}

                        {/* Price */}
                        <div className="mt-4 flex items-baseline justify-center gap-0.5">
                          <span className="text-sm font-medium text-muted-foreground">
                            $
                          </span>
                          <span className="text-3xl font-bold text-foreground tracking-tight">
                            {service.price.toFixed(0)}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            .00
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                          Approx.&nbsp;{Math.floor(service.duration / 60)}h
                          {service.duration % 60 > 0
                            ? ` ${service.duration % 60}m`
                            : ""}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="mx-5 h-px bg-border/40" />

                      {/* Features */}
                      {service.features && service.features.length > 0 && (
                        <div className="px-5 py-4 flex-1">
                          <ul
                            className={cn(
                              usesTwoColFeatures
                                ? "grid grid-cols-2 gap-x-3 gap-y-1.5"
                                : "flex flex-col gap-y-1.5",
                            )}
                          >
                            {service.features.map((feature, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors"
                              >
                                <Check
                                  className="w-3 h-3 text-primary flex-shrink-0"
                                  strokeWidth={2.5}
                                />
                                <span className="leading-tight">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Mobile book button */}
                      <div className="px-5 pb-5 pt-0 mt-auto sm:hidden">
                        <Button
                          className="w-full h-8 text-xs"
                          variant="outline"
                          disabled={bookingReadiness === undefined}
                          onClick={handleBookNow}
                        >
                          Select {service.name}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              </div>
            )}
          </div>

          {/* Desktop CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-10 sm:mt-14"
          >
            <Button
              size="lg"
              disabled={bookingReadiness === undefined}
              onClick={handleBookNow}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book Appointment
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              A deposit is required to secure your appointment.
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}
