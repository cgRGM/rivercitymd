import * as React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useAction } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import { CarFront, Check, ChevronDown, ChevronUp, Palette, Search, Trash2 } from "lucide-react-native";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export type VehicleClassification = {
  source: "fuelEconomy" | "vpic" | "manual" | "fallback";
  confidence: "high" | "medium" | "low";
  rawCategory?: string;
  needsAdminReview: boolean;
};

export type VehicleLookupValue = {
  year: string;
  make: string;
  model: string;
  color?: string;
  licensePlate?: string;
  size?: "small" | "medium" | "large";
  vehicleTypeId?: string;
  vehicleTypeName?: string;
  classification?: VehicleClassification;
};

export interface VehicleLookupProps {
  value: VehicleLookupValue;
  onChange: (value: VehicleLookupValue) => void;
  title?: string;
  showColor?: boolean;
  showLicensePlate?: boolean;
  onRemove?: () => void;
}

const SIZE_LABELS: Record<"small" | "medium" | "large", string> = {
  small: "Small / Motorcycle / ATV",
  medium: "Car / Standard Sedan",
  large: "SUV / Truck / Van / RV",
};

export function VehicleLookup({
  value,
  onChange,
  title,
  showColor = true,
  showLicensePlate = false,
  onRemove,
}: VehicleLookupProps) {
  const [searchQuery, setSearchQuery] = React.useState(
    value.year && value.make && value.model ? `${value.year} ${value.make} ${value.model}` : "",
  );
  const [suggestions, setSuggestions] = React.useState<
    Array<{
      year: number;
      make: string;
      model: string;
      label: string;
      source: "fuelEconomy" | "vpic";
    }>
  >([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isClassifying, setIsClassifying] = React.useState(false);
  const [showManualFields, setShowManualFields] = React.useState(
    Boolean(value.year && value.make && value.model),
  );

  const searchModels = useAction(api.vehicleTypes.searchModels);
  const classifyVehicle = useAction(api.vehicleTypes.classify);

  // Debounced auto-complete
  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchModels({ query: trimmed });
        setSuggestions(results || []);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, searchModels]);

  const handleSelectSuggestion = async (suggestion: {
    year: number;
    make: string;
    model: string;
    label: string;
  }) => {
    setSuggestions([]);
    setSearchQuery(`${suggestion.year} ${suggestion.make} ${suggestion.model}`);
    setShowManualFields(true);
    setIsClassifying(true);

    try {
      const classification = await classifyVehicle({
        year: suggestion.year,
        make: suggestion.make,
        model: suggestion.model,
      });

      onChange({
        ...value,
        year: String(suggestion.year),
        make: suggestion.make,
        model: suggestion.model,
        size: classification.legacySize,
        vehicleTypeId: classification.vehicleTypeId,
        vehicleTypeName: classification.vehicleTypeName,
        classification: {
          source: classification.source,
          confidence: classification.confidence,
          rawCategory: classification.rawCategory,
          needsAdminReview: classification.needsAdminReview,
        },
      });
    } catch {
      onChange({
        ...value,
        year: String(suggestion.year),
        make: suggestion.make,
        model: suggestion.model,
        size: "medium",
      });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleManualClassify = async (year: string, make: string, model: string) => {
    if (!/^\d{4}$/.test(year) || !make.trim() || !model.trim()) return;

    setIsClassifying(true);
    try {
      const classification = await classifyVehicle({
        year: Number(year),
        make: make.trim(),
        model: model.trim(),
      });

      onChange({
        ...value,
        year,
        make,
        model,
        size: classification.legacySize,
        vehicleTypeId: classification.vehicleTypeId,
        vehicleTypeName: classification.vehicleTypeName,
        classification: {
          source: classification.source,
          confidence: classification.confidence,
          rawCategory: classification.rawCategory,
          needsAdminReview: classification.needsAdminReview,
        },
      });
    } catch {
      onChange({
        ...value,
        year,
        make,
        model,
      });
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <Card className="overflow-hidden border border-border">
      <CardContent className="gap-4 p-4">
        {/* Card Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <CarFront size={18} color={THEME.light.accent} />
            </View>
            <Text className="text-base font-semibold">
              {title || (value.make && value.model ? `${value.year} ${value.make} ${value.model}` : "Vehicle Details")}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {value.size ? (
              <Badge variant="accent" size="sm" label={value.vehicleTypeName || SIZE_LABELS[value.size]} />
            ) : null}
            {onRemove ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRemove}
                className="h-8 w-8 items-center justify-center rounded-full bg-destructive/10 active:bg-destructive/20"
              >
                <Trash2 size={16} color={THEME.light.destructive} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Quick Search */}
        <View className="gap-1.5">
          <Input
            label="Search by Year, Make, Model"
            placeholder="e.g. 2022 Toyota RAV4"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (!text.trim()) {
                setShowManualFields(true);
              }
            }}
            leftIcon={
              isSearching ? (
                <ActivityIndicator size="small" color={THEME.light.accent} />
              ) : (
                <Search size={18} color={THEME.light.mutedForeground} />
              )
            }
          />

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 ? (
            <View className="rounded-xl border border-border bg-card p-1 shadow-lg">
              {suggestions.slice(0, 5).map((item, index) => (
                <Pressable
                  key={`${item.year}-${item.make}-${item.model}-${index}`}
                  accessibilityRole="button"
                  onPress={() => void handleSelectSuggestion(item)}
                  className="flex-row items-center justify-between rounded-lg p-3 active:bg-secondary"
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="font-semibold">
                      {item.year} {item.make} {item.model}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{item.label}</Text>
                  </View>
                  <Check size={16} color={THEME.light.accent} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Manual fields toggle */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowManualFields(!showManualFields)}
          className="flex-row items-center gap-1 self-start py-1"
        >
          <Text className="text-xs font-semibold text-accent">
            {showManualFields ? "Hide details" : "Edit vehicle details manually"}
          </Text>
          {showManualFields ? (
            <ChevronUp size={14} color={THEME.light.accent} />
          ) : (
            <ChevronDown size={14} color={THEME.light.accent} />
          )}
        </Pressable>

        {showManualFields ? (
          <View className="gap-3 border-t border-border pt-3">
            <View className="flex-row gap-3">
              <View className="w-24">
                <Input
                  label="Year"
                  placeholder="2022"
                  keyboardType="numeric"
                  maxLength={4}
                  value={value.year}
                  onChangeText={(text) => {
                    onChange({ ...value, year: text });
                    if (text.length === 4 && value.make && value.model) {
                      void handleManualClassify(text, value.make, value.model);
                    }
                  }}
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Make"
                  placeholder="Toyota"
                  value={value.make}
                  onChangeText={(text) => {
                    onChange({ ...value, make: text });
                    if (value.year && text && value.model) {
                      void handleManualClassify(value.year, text, value.model);
                    }
                  }}
                />
              </View>
            </View>

            <Input
              label="Model"
              placeholder="RAV4"
              value={value.model}
              onChangeText={(text) => {
                onChange({ ...value, model: text });
                if (value.year && value.make && text) {
                  void handleManualClassify(value.year, value.make, text);
                }
              }}
            />

            {/* Size Selector */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vehicle Size Category
              </Text>
              <View className="flex-row gap-2">
                {(["small", "medium", "large"] as const).map((s) => {
                  const isSelected = value.size === s;
                  return (
                    <Pressable
                      key={s}
                      accessibilityRole="button"
                      onPress={() => onChange({ ...value, size: s })}
                      className={`flex-1 items-center justify-center rounded-xl border p-2.5 ${
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold capitalize ${
                          isSelected ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {showColor ? (
              <Input
                label="Color (Optional)"
                placeholder="e.g. Midnight Black"
                value={value.color || ""}
                onChangeText={(text) => onChange({ ...value, color: text })}
                leftIcon={<Palette size={16} color={THEME.light.mutedForeground} />}
              />
            ) : null}

            {showLicensePlate ? (
              <Input
                label="License Plate (Optional)"
                placeholder="ABC-1234"
                autoCapitalize="characters"
                value={value.licensePlate || ""}
                onChangeText={(text) => onChange({ ...value, licensePlate: text.toUpperCase() })}
              />
            ) : null}

            {isClassifying ? (
              <View className="flex-row items-center gap-2 rounded-lg bg-accent/10 p-2.5">
                <ActivityIndicator size="small" color={THEME.light.accent} />
                <Text className="text-xs text-accent">Classifying vehicle size and specifications...</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
