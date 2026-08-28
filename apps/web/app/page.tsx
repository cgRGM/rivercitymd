import Navbar from "@/components/home/navbar";
import HeroSection from "@/components/home/hero";
import { ServicesSection } from "@/components/home/services";
import { Footer } from "@/components/home/footer";
import { PricingSection } from "@/components/home/pricing";
import TestimonialsSection from "@/components/home/testimonials";
import BackToTop from "@/components/home/back-to-top";
import ContactSection from "@/components/home/contact";

export default async function Home() {
  return (
    <main className="min-h-screen pb-16 md:pb-4">
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <PricingSection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <BackToTop />
    </main>
  );
}
