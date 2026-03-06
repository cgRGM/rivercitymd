"use client";

import {
  Check,
  Sparkles,
  Droplets,
  Car,
  Zap,
  Shield,
  Clock,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const services = [
  {
    icon: Zap,
    title: "Quick Clean",
    description:
      "Full exterior wash, interior vacuum, and quick wax for a fast refresh.",
    features: [
      "Exterior wash & dry",
      "Interior vacuum",
      "Window cleaning",
      "Quick wax spray",
    ],
  },
  {
    icon: Car,
    title: "Full Detail",
    description:
      "Complete interior and exterior deep clean for showroom quality.",
    features: [
      "Deep interior cleaning",
      "Exterior wash & wax",
      "Engine bay cleaning",
      "Tire shine",
    ],
  },
  {
    icon: Sparkles,
    title: "Paint Correction",
    description:
      "Remove scratches, swirls, and oxidation to restore original gloss.",
    features: [
      "Scratch removal",
      "Swirl correction",
      "Paint restoration",
      "Protective coating",
    ],
  },
  {
    icon: Droplets,
    title: "Ceramic Coating",
    description: "Long-lasting protection with hydrophobic properties.",
    features: [
      "UV protection",
      "Scratch resistance",
      "Hydrophobic layer",
      "2-year warranty",
    ],
  },
  {
    icon: Shield,
    title: "Interior Detail",
    description: "Deep clean and protect all interior surfaces.",
    features: [
      "Leather conditioning",
      "Carpet shampooing",
      "Dashboard treatment",
      "Odor removal",
    ],
  },
  {
    icon: Clock,
    title: "Subscription Plans",
    description: "Regular maintenance with exclusive discounts.",
    features: [
      "Weekly: 25% off",
      "Bi-weekly: 20% off",
      "Monthly: 10% off",
      "Priority booking",
    ],
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-balance">
            Professional services for every need
          </h2>
          <p className="text-lg text-muted-foreground">
            From quick refreshes to complete transformations, we offer
            comprehensive detailing solutions tailored to your vehicle.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {services.map((service, index) => {
            const Icon = service.icon;
            const usesTwoColFeatures = service.features.length >= 4;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
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
                      <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <h3 className="text-lg font-bold tracking-tight leading-tight">
                        {service.title}
                      </h3>
                    </div>

                    <p className="text-xs text-muted-foreground leading-snug">
                      {service.description}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="mx-5 h-px bg-border/40" />

                  {/* Features */}
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
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
