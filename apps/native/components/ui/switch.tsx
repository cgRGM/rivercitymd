import * as React from "react";
import { Switch as RNSwitch, View, type SwitchProps as RNSwitchProps } from "react-native";
import { THEME } from "@/lib/theme";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export interface SwitchProps extends RNSwitchProps {
  label?: string;
  description?: string;
  containerClassName?: string;
}

export function Switch({
  label,
  description,
  containerClassName,
  value,
  onValueChange,
  ...props
}: SwitchProps) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-between gap-4 rounded-xl border border-border bg-card p-4",
        containerClassName,
      )}
    >
      <View className="flex-1 gap-0.5">
        {label ? <Text className="font-semibold">{label}</Text> : null}
        {description ? (
          <Text className="text-xs leading-4 text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: THEME.light.border,
          true: THEME.light.accent,
        }}
        thumbColor={THEME.light.background}
        ios_backgroundColor={THEME.light.border}
        {...props}
      />
    </View>
  );
}
