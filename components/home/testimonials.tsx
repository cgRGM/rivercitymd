"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { motion } from "motion/react";

const testimonials = [
  {
    name: "Robert T.",
    location: "Little Rock, AR",
    rating: 5,
    text: "I was really impressed with River City Mobile Detail. They paid great attention to detail and brought my truck back to life. The convenience of them coming to my house was a huge plus. Highly recommend!",
    image: "/professional-man-smiling.png",
  },
  {
    name: "Jenny S.",
    location: "Chenal, AR",
    rating: 5,
    text: "I've used River City Mobile Detail several times, and they never disappoint. Their team is professional, efficient, and my car always looks fantastic afterward. Living in Chenal, I appreciate the convenience of their mobile service.",
    image: "/professional-woman-smiling.png",
  },
  {
    name: "Michael P.",
    location: "Conway, AR",
    rating: 5,
    text: "Outstanding service! They transformed my SUV from looking worn out to showroom quality. The paint correction service was worth every penny. Will definitely be using them regularly.",
    image: "/smiling-bearded-man.png",
  },
];

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-balance">
            Trusted by hundreds of satisfied customers
          </h2>
          <p className="text-lg text-muted-foreground">
            Don&apos;t just take our word for it—see what our customers have to
            say about their experience.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <Card className="hover:shadow-xl transition-all duration-300 h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Image
                      src={testimonial.image || "/placeholder.svg"}
                      alt={testimonial.name}
                      width={64}
                      height={64}
                      className="rounded-full object-cover"
                    />
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.location}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-accent text-accent"
                      />
                    ))}
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-accent mb-2">500+</div>
            <div className="text-sm text-muted-foreground">Happy Customers</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-accent mb-2">4.9★</div>
            <div className="text-sm text-muted-foreground">Average Rating</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-accent mb-2">5+</div>
            <div className="text-sm text-muted-foreground">
              Years Experience
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-accent mb-2">100%</div>
            <div className="text-sm text-muted-foreground">
              Satisfaction Rate
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
