"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import AppointmentModal from "@/components/home/appointment-modal";
import { ArrowRight, Sparkles, MapPin, Phone } from "lucide-react";

export default function HeroSection() {
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <>
      <section
        id="home"
        className="relative min-h-screen flex items-center justify-center overflow-hidden md:pt-20"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/30 to-background" />

        {/* Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mt-4 md:mt-0">
                <Sparkles className="w-4 h-4" />
                Serving Central Arkansas
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-balance">
                Premium mobile detailing at your{" "}
                <span className="text-accent">doorstep</span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                Experience professional car care that comes to you. Our expert
                team delivers showroom-quality results with convenient,
                high-quality detailing services.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="text-lg h-14 px-8 group"
                  onClick={() => setBookingOpen(true)}
                >
                  Book Your Detail
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg h-14 px-8 bg-transparent"
                  asChild
                >
                  <a href="tel:501-454-7140">
                    <Phone className="mr-2 w-5 h-5" />
                    (501) 454-7140
                  </a>
                </Button>
              </div>

              {/* Quick Info */}
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 text-accent" />
                  <span>Little Rock, AR</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Available Mon-Sat</span>
                </div>
              </div>
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative lg:h-[600px] h-[400px] animate-scale-in">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent rounded-3xl" />
              <div className="absolute inset-4 rounded-2xl overflow-hidden">
                <Image
                  src="/luxury-car-being-detailed-professionally.jpg"
                  alt="Professional car detailing"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Floating Stats Cards */}
              <div className="absolute -bottom-6 -left-6 bg-card p-6 rounded-2xl shadow-xl border border-border animate-fade-in">
                <div className="text-3xl font-bold text-accent">500+</div>
                <div className="text-sm text-muted-foreground">
                  Happy Customers
                </div>
              </div>

              <div className="absolute -top-6 -right-6 bg-card p-6 rounded-2xl shadow-xl border border-border animate-fade-in">
                <div className="text-3xl font-bold text-accent">5.0★</div>
                <div className="text-sm text-muted-foreground">
                  Average Rating
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AppointmentModal open={bookingOpen} onOpenChange={setBookingOpen} />
    </>
  );
}
