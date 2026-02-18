"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Calendar } from "lucide-react";
import AppointmentModal from "@/components/home/appointment-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";

export function PricingSection() {
  // Fetch services
  const servicesQuery = useQuery(api.services.list);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<
    "small" | "medium" | "large"
  >("medium");

  // Transform services data for display - show all active services
  const mainServices =
    servicesQuery?.filter(
      (service) =>
        service.isActive && (service.serviceType === "standard" || !service.serviceType),
    ) || [];

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
          <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div
              className="flex overflow-x-auto overflow-y-visible snap-x snap-mandatory scroll-smooth gap-4 pb-2 sm:gap-6 sm:max-w-7xl sm:mx-auto"
              aria-label="Service pricing cards"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 snap-center w-[min(85vw,320px)] sm:w-[min(380px,max(320px,44vw))] lg:w-[min(400px,max(300px,24vw))]"
                >
                  <Card className="h-full">
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
                </div>
              ))}
            </div>
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

            <p className="text-lg text-muted-foreground mb-4">
              Professional mobile detailing services for all vehicle sizes
            </p>
            <p className="text-sm text-muted-foreground">
              Professional-grade products, non-toxic and eco-friendly.
            </p>
          </motion.div>

          {/* Vehicle Size Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl mx-auto mb-12"
          >
            <p className="text-center text-muted-foreground mb-6">
              Select your vehicle type to see accurate pricing
            </p>
            <Tabs
              value={selectedSize}
              onValueChange={(value) =>
                setSelectedSize(value as "small" | "medium" | "large")
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
          </motion.div>

          {/* Services */}
          <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div
              className="flex items-stretch overflow-x-auto overflow-y-visible snap-x snap-mandatory scroll-smooth gap-6 pb-8 max-w-7xl mx-auto"
              aria-label="Service pricing cards"
            >
              {mainServices.map((service, index) => {
                const price =
                  selectedSize === "small"
                    ? service.basePriceSmall
                    : selectedSize === "medium"
                      ? service.basePriceMedium
                      : service.basePriceLarge;

                return (
                  <motion.div
                    key={service._id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex-shrink-0 snap-center w-[85vw] sm:w-[380px] lg:w-[400px] flex flex-col"
                  >
                    <Card className="relative hover:shadow-2xl transition-all duration-300 flex-1 border-border/50 bg-background/50 backdrop-blur-sm overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <CardHeader className="text-center pb-6 pt-8">
                        {service.icon && (
                          <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">
                             {service.icon}
                          </div>
                        )}
                        <CardTitle className="text-2xl font-bold tracking-tight">
                          {service.name}
                        </CardTitle>
                        <CardDescription className="text-sm mt-2 line-clamp-2 min-h-[2.5rem]">
                          {service.description}
                        </CardDescription>
                        
                        <div className="mt-6 flex items-baseline justify-center gap-1">
                          <span className="text-sm font-medium text-muted-foreground">$</span>
                          <span className="text-4xl font-extrabold text-foreground tracking-tight">
                            {price?.toFixed(0) || "N/A"}
                          </span>
                          {price ? <span className="text-sm font-medium text-muted-foreground">.00</span> : null}
                        </div>
                         <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2">
                            Approx. {Math.floor(service.duration / 60)}h{" "}
                            {service.duration % 60 > 0 ? `${service.duration % 60}m` : ""}
                          </p>
                      </CardHeader>
                      
                      <CardContent className="space-y-6">
                        <div className="w-full h-px bg-border/50" />
                        
                        {service.features && service.features.length > 0 && (
                          <ul className="space-y-3 px-2">
                            {service.features.map((feature, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-3 text-sm group/item"
                              >
                                <div className="mt-0.5 rounded-full bg-primary/10 p-1 group-hover/item:bg-primary/20 transition-colors">
                                   <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" strokeWidth={3} />
                                </div>
                                <span className="text-muted-foreground group-hover/item:text-foreground transition-colors leading-tight pt-0.5">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                      
                       {/* Mobile-only "Book" button within card for better UX on small screens */}
                       <div className="p-6 pt-0 mt-auto sm:hidden">
                         <Button 
                           className="w-full" 
                           variant="outline"
                           onClick={() => setBookingOpen(true)}
                         >
                           Select {service.name}
                         </Button>
                       </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* CTA Button - Desktop/Tablet mostly */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-12 sm:mt-16"
          >
            <Button
              size="lg"
              onClick={() => setBookingOpen(true)}
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

      <AppointmentModal open={bookingOpen} onOpenChange={setBookingOpen} />
    </>
  );
}
