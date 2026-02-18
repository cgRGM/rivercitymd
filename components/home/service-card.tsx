"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Check, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ServiceCardProps {
  service: {
    _id: string;
    name: string;
    description: string;
    basePriceSmall?: number;
    basePriceMedium?: number;
    basePriceLarge?: number;
    serviceType?: "standard" | "addon" | "subscription";
  };
  vehicleSize: "small" | "medium" | "large";
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}

export function ServiceCard({
  service,
  vehicleSize,
  isSelected,
  onSelect,
}: ServiceCardProps) {
  const price =
    vehicleSize === "small"
      ? service.basePriceSmall
      : vehicleSize === "medium"
        ? service.basePriceMedium
        : service.basePriceLarge;

  const isPackage = service.serviceType === "standard" || !service.serviceType;
  const isSubscription = service.serviceType === "subscription";

  return (
    <div
      onClick={() => onSelect(!isSelected)}
      className={cn(
        "group relative flex cursor-pointer rounded-xl border-2 transition-all duration-200 hover:shadow-md overflow-hidden bg-card text-card-foreground",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-muted hover:border-primary/50"
      )}
    >
      <div className={cn(
        "w-1.5 transition-colors duration-200",
        isSelected ? "bg-primary" : "bg-transparent"
      )} />
      
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className={cn("font-semibold text-base leading-none", isSelected ? "text-primary" : "")}>
              {service.name}
            </h4>
            {isSubscription && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                Monthly
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mt-2">
            {service.description}
          </p>
        </div>
        
        <div className="mt-4 pt-3 border-t border-border/50 flex items-end justify-between">
           <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
             {isSubscription ? "Per Month" : "Total"}
           </div>
           <div className="flex items-baseline gap-1">
             <span className="font-bold text-lg text-primary">
               ${price?.toFixed(2)}
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
