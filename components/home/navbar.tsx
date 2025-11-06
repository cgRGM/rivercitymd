"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  X,
  ShoppingCart,
  Home,
  Wrench,
  DollarSign,
  MessageSquare,
  Phone,
} from "lucide-react";
import { useCart } from "../cart-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import AppointmentModal from "./appointment-modal";

export default function Navbar() {
  const { cart, removeFromCart, cartTotal, clearCart, getServiceIds } =
    useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "home",
        "services",
        "pricing",
        "testimonials",
        "contact",
      ];
      const scrollPosition = window.scrollY + 200;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10 transition-transform group-hover:scale-105">
                <Image
                  src="/BoldRiverCityMobileDetailingLogo.png"
                  alt="River City Mobile Detail"
                  fill
                  className="object-contain"
                />
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#services"
                className="text-sm font-medium hover:text-accent transition-colors"
              >
                Services
              </Link>
              <Link
                href="#pricing"
                className="text-sm font-medium hover:text-accent transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="#testimonials"
                className="text-sm font-medium hover:text-accent transition-colors"
              >
                Testimonials
              </Link>
              <Link
                href="#contact"
                className="text-sm font-medium hover:text-accent transition-colors"
              >
                Contact
              </Link>
              <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {cart.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                        {cart.length}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Your Cart</SheetTitle>
                    <SheetDescription>
                      Review your selected services and add-ons
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-8 space-y-4">
                    {cart.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Your cart is empty
                      </p>
                    ) : (
                      <>
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {item.type}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold">
                                ${item.price.toFixed(2)}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromCart(item.id)}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="border-t pt-4 mt-4">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-lg font-bold">Total</p>
                            <p className="text-2xl font-bold">
                              ${cartTotal.toFixed(2)}
                            </p>
                          </div>
                          <Button
                            className="w-full"
                            size="lg"
                            onClick={() => {
                              setCartOpen(false);
                              setAppointmentOpen(true);
                            }}
                          >
                            Start Quote
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {cart.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                        {cart.length}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Your Cart</SheetTitle>
                    <SheetDescription>
                      Review your selected services and add-ons
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-8 space-y-4">
                    {cart.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Your cart is empty
                      </p>
                    ) : (
                      <>
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {item.type}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold">
                                ${item.price.toFixed(2)}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromCart(item.id)}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="border-t pt-4 mt-4">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-lg font-bold">Total</p>
                            <p className="text-2xl font-bold">
                              ${cartTotal.toFixed(2)}
                            </p>
                          </div>
                          <Button
                            className="w-full"
                            size="lg"
                            onClick={() => {
                              setCartOpen(false);
                              setAppointmentOpen(true);
                            }}
                          >
                            Start Quote
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Start</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <AppointmentModal
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
        preselectedServices={getServiceIds()}
        onSuccess={() => clearCart()}
      />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border pb-safe">
        <div className="grid grid-cols-5 h-16">
          <Link
            href="#home"
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeSection === "home" ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link
            href="#services"
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeSection === "services"
                ? "text-accent"
                : "text-muted-foreground"
            }`}
          >
            <Wrench className="w-5 h-5" />
            <span className="text-xs font-medium">Services</span>
          </Link>
          <Link
            href="#pricing"
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeSection === "pricing"
                ? "text-accent"
                : "text-muted-foreground"
            }`}
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-xs font-medium">Pricing</span>
          </Link>
          <Link
            href="#testimonials"
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeSection === "testimonials"
                ? "text-accent"
                : "text-muted-foreground"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs font-medium">Reviews</span>
          </Link>
          <Link
            href="#contact"
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeSection === "contact"
                ? "text-accent"
                : "text-muted-foreground"
            }`}
          >
            <Phone className="w-5 h-5" />
            <span className="text-xs font-medium">Contact</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
