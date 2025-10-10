"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Plus } from "lucide-react";
import AppointmentModal from "@/components/home/appointment-modal";
import { useCart } from "@/components/cart-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "motion/react";

const mainServices = [
  {
    name: "Quick Clean",
    icon: "🚿",
    price: { small: 129.99, medium: 109.99, large: 119.99 },
    duration: "1.5 HR",
    description: "Perfect for regular maintenance",
    features: [
      "Interior Vacuum",
      "Interior Wipe Down",
      "Exterior Wash & Dry",
      "Glass Clean",
      "Wheels Wash & Dress",
      "Quick Wax",
    ],
  },
  {
    name: "Interior Detail",
    icon: "🚗",
    price: { small: 174.99, medium: 124.99, large: 149.99 },
    duration: "2 HR",
    description: "Deep interior cleaning",
    features: [
      "Deep Vacuum",
      "Interior Detail",
      "Carpet Cleaning",
      "Glass Clean",
      "Interior Wipe Down",
      "Door Jambs Clean",
    ],
  },
  {
    name: "Wash, Clay, Seal",
    icon: "⭐",
    price: { small: 174.99, medium: 124.99, large: 149.99 },
    duration: "1.5-2 HR",
    description: "Premium exterior treatment",
    features: [
      "Detailed Hand Wash",
      "Bug Splatter Clean",
      "Wheels Wash & Dress",
      "Clay Bar Service",
      "Micro Contaminants Removed",
      "4-6 Month Ceramic Coating",
    ],
    popular: true,
  },
  {
    name: "Full Detail",
    icon: "👑",
    price: { small: 249.99, medium: 199.99, large: 224.99 },
    duration: "2.5-3 HR",
    description: "Complete transformation",
    features: [
      "Exterior Wash",
      "Hand Wash & Dry",
      "Wheels Wash & Dress",
      "Interior Detailing",
      "Deep Vacuum",
      "Quick Wax",
    ],
  },
];

const addOns = [
  {
    name: "1-Step Paint Correction",
    price: { min: 300, max: 500 },
    icon: "✨",
    description: "Single stage paint enhancement",
    features: [
      "Paint Enhancement / Buff",
      "Isopropyl Alcohol Wipe Down",
      "Removes 60-80% Scratches & Swirls",
    ],
  },
  {
    name: "Wax",
    price: 125,
    icon: "🛡️",
    description: "Premium protection layer",
    features: [
      "UV-Ray Protection",
      "Pollutant Protection",
      "Contaminant Protection",
      "Hydrophobic Layer",
    ],
  },
  {
    name: "Trim Coating",
    price: 75,
    icon: "🎨",
    description: "Protect exterior trim",
    features: [
      "UV-Ray Protection",
      "Scratch & Swirl Resistance",
      "Hydrophobic Properties",
      "Chemical/Stain Resistant",
    ],
  },
  {
    name: "Headlight Restoration",
    price: 75,
    icon: "💡",
    description: "Restore clarity and visibility",
    features: [
      "Dramatically Improves Visibility",
      "Restores Clarity to Foggy Lenses",
      "Boosts Resale Value",
    ],
  },
];

export function PricingSection() {
  const [selectedSize, setSelectedSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [bookingOpen, setBookingOpen] = useState(false);
  const { addToCart } = useCart();

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
            <p className="text-lg text-muted-foreground mb-8">
              Professional-grade products, non-toxic and eco-friendly. Pricing
              based on average vehicle condition.
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
                  className="text-xs sm:text-sm py-2 sm:py-3 data-[state=active]:bg-background"
                >
                  Small / Compact
                </TabsTrigger>
                <TabsTrigger
                  value="medium"
                  className="text-xs sm:text-sm py-2 sm:py-3 data-[state=active]:bg-background"
                >
                  Mid-Size SUV
                </TabsTrigger>
                <TabsTrigger
                  value="large"
                  className="text-xs sm:text-sm py-2 sm:py-3 data-[state=active]:bg-background"
                >
                  Truck / Large
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

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
              {mainServices.map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card
                    className={`relative hover:shadow-xl transition-all h-full ${
                      service.popular
                        ? "border-accent shadow-lg ring-2 ring-accent/20"
                        : ""
                    }`}
                  >
                    {service.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-accent-foreground text-xs font-medium rounded-full">
                        Most Popular
                      </div>
                    )}
                    <CardHeader className="text-center pb-4">
                      <div className="text-4xl mb-2">{service.icon}</div>
                      <CardTitle className="text-xl">{service.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {service.description}
                      </CardDescription>
                      <div className="mt-4">
                        <span className="text-3xl font-bold">
                          ${service.price[selectedSize]}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {service.duration}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {service.features.map((feature, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full"
                        variant={service.popular ? "default" : "outline"}
                        onClick={() =>
                          addToCart({
                            name: service.name,
                            price: service.price[selectedSize],
                            type: "service",
                          })
                        }
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add to Cart
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
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
              <h3 className="text-2xl font-bold text-center mb-4">Add-Ons</h3>
              <p className="text-center text-muted-foreground mb-8">
                Enhance your service with premium add-ons
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {addOns.map((addon, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow h-full">
                    <CardHeader className="text-center pb-4">
                      <div className="text-3xl mb-2">{addon.icon}</div>
                      <CardTitle className="text-lg">{addon.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {addon.description}
                      </CardDescription>
                      <div className="mt-3">
                        {typeof addon.price === "number" ? (
                          <span className="text-2xl font-bold">
                            ${addon.price}
                          </span>
                        ) : (
                          <span className="text-2xl font-bold">
                            ${addon.price.min}-${addon.price.max}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {addon.features.map((feature, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full bg-transparent"
                        variant="outline"
                        onClick={() =>
                          addToCart({
                            name: addon.name,
                            price:
                              typeof addon.price === "number"
                                ? addon.price
                                : addon.price.min,
                            type: "addon",
                          })
                        }
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add to Cart
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <AppointmentModal open={bookingOpen} onOpenChange={setBookingOpen} />
    </>
  );
}
