"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getEffectiveServicePricingForVehicle,
  type VehicleSize,
} from "@/convex/lib/pricing";

interface ServiceCardProps {
  service: {
    _id: string;
    name: string;
    description: string;
    basePriceSmall?: number;
    basePriceMedium?: number;
    basePriceLarge?: number;
    basePrice?: number;
    duration?: number;
    serviceType?: "standard" | "addon" | "subscription";
    vehiclePrices?: Array<{
      vehicleTypeId?: string;
      price: number;
      duration?: number;
      isAvailable: boolean;
      vehicleType?: {
        legacySize?: VehicleSize;
      } | null;
    }>;
  };
  vehicleSize: VehicleSize;
  vehicleTypeId?: string | null;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}

export function ServiceCard({
  service,
  vehicleSize,
  vehicleTypeId,
  isSelected,
  onSelect,
}: ServiceCardProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const pricing = getEffectiveServicePricingForVehicle(service, {
    vehicleSize,
    vehicleTypeId,
  });
  const isSubscription = service.serviceType === "subscription";

  return (
    <div
      onClick={() => onSelect(!isSelected)}
      className={cn(
        "group relative flex h-full min-h-[13rem] cursor-pointer overflow-hidden rounded-xl border-2 bg-card text-card-foreground transition-all duration-200 hover:shadow-md",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-muted hover:border-primary/50"
      )}
    >
      <div className={cn(
        "w-1.5 transition-colors duration-200",
        isSelected ? "bg-primary" : "bg-transparent"
      )} />
      
      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1">
          <div className="flex min-h-10 items-start gap-2">
            <h4 className={cn("line-clamp-2 text-base font-semibold leading-tight", isSelected ? "text-primary" : "")}>
              {service.name}
            </h4>
            {isSubscription && (
              <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                Monthly
              </Badge>
            )}
          </div>
          <div className={cn("mt-2", isDescriptionExpanded ? "min-h-[5.75rem]" : "h-[5.75rem]")}>
            <p className={cn(
              "text-sm text-muted-foreground leading-relaxed",
              !isDescriptionExpanded && "line-clamp-3"
            )}>
              {service.description}
            </p>
            <div className="mt-1 h-5">
              {service.description && service.description.length > 120 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDescriptionExpanded(!isDescriptionExpanded);
                  }}
                  className="text-xs font-medium text-primary hover:underline focus:outline-none"
                >
                  {isDescriptionExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex items-end justify-between border-t border-border/50 pt-3">
           <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
             {isSubscription ? "Per Month" : "Total"}
           </div>
           <div className="flex items-baseline gap-1">
             <span className="font-bold text-lg text-primary">
               ${pricing.price.toFixed(2)}
             </span>
             {isSubscription && <span className="text-[10px] text-muted-foreground">/mo</span>}
           </div>
        </div>
      </div>

      {/* Selection Indicator */}
      <div className="p-4 flex items-center justify-center border-l border-border/50 bg-muted/10 group-hover:bg-muted/20 transition-colors">
        <div className={cn(
          "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
          isSelected 
            ? "border-primary bg-primary text-primary-foreground" 
            : "border-muted-foreground/30 bg-background group-hover:border-primary/50"
        )}>
           {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
        </div>
      </div>
    </div>
  );
}
