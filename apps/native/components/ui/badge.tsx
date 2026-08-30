import * as React from "react";
import { View, type ViewProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

const badgeVariants = cva(
  "inline-flex flex-row items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
        outline: "border border-border text-foreground",
        accent: "bg-accent/15 text-accent border border-accent/25",
        success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
        warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        default: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const badgeTextVariants = cva("font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      destructive: "text-destructive",
      outline: "text-foreground",
      accent: "text-accent",
      success: "text-emerald-700 dark:text-emerald-400",
      warning: "text-amber-700 dark:text-amber-400",
    },
    size: {
      sm: "text-[10px]",
      default: "text-xs",
      lg: "text-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface BadgeProps
  extends ViewProps,
    VariantProps<typeof badgeVariants> {
  children?: React.ReactNode;
  label?: string;
}

export function Badge({
  className,
  variant,
  size,
  children,
  label,
  ...props
}: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {typeof children === "string" || label ? (
        <Text className={cn(badgeTextVariants({ variant, size }))}>
          {label ?? children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
