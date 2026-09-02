import * as React from "react";
import { Modal as RNModal, Pressable, View, type ModalProps as RNModalProps } from "react-native";
import { X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface ModalProps extends RNModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  contentClassName?: string;
}

export function Modal({
  visible,
  onClose,
  title,
  description,
  children,
  contentClassName,
  ...props
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      onRequestClose={onClose}
      transparent
      animationType="slide"
      statusBarTranslucent
      {...props}
    >
      <View className="flex-1 justify-end bg-black/60">
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="flex-1"
        />
        <View
          className={cn(
            "max-h-[90%] rounded-t-3xl border-t border-border bg-card px-5 pt-4 pb-8 shadow-2xl",
            contentClassName,
          )}
        >
          {/* Handle bar */}
          <View className="mb-3 items-center">
            <View className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </View>

          {title || description ? (
            <View className="mb-4 flex-row items-start justify-between gap-4">
              <View className="flex-1 gap-1">
                {title ? <Text className="text-xl font-bold">{title}</Text> : null}
                {description ? (
                  <Text className="text-sm text-muted-foreground">{description}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-secondary active:bg-secondary/70"
              >
                <X size={18} color={THEME.light.foreground} />
              </Pressable>
            </View>
          ) : null}

          {children}
        </View>
      </View>
    </RNModal>
  );
}
