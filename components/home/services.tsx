"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, Droplets, Car, Zap, Shield, Clock } from "lucide-react";
import { motion } from "motion/react";

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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              /* Added scroll-triggered staggered animation for service cards */
              <motion.div
                key={index}
                initial={{ opacity: 0, translateY: 30 }}
                whileInView={{ opacity: 1, translateY: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {service.features.map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
