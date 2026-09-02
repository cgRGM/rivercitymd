import * as React from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <View className="w-full gap-1.5">
        {label ? (
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </Text>
        ) : null}
        <View
          className={cn(
            "h-12 flex-row items-center rounded-xl border border-border bg-card px-3.5",
            error && "border-destructive",
            props.editable === false && "opacity-60 bg-muted/40",
            className,
          )}
        >
          {leftIcon ? <View className="mr-2.5">{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            placeholderTextColor="#8C887B"
            className="h-full flex-1 text-base text-foreground"
            {...props}
          />
          {rightIcon ? <View className="ml-2.5">{rightIcon}</View> : null}
        </View>
        {error ? (
          <Text className="text-xs font-medium text-destructive">{error}</Text>
        ) : helperText ? (
          <Text className="text-xs text-muted-foreground">{helperText}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = "Input";
