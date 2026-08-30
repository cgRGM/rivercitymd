import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useAction } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import { isArkansasState } from "@rivercitymd/backend/convex/lib/address";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react-native";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export interface ServiceAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

export type AddressValue = ServiceAddress;

export interface TravelQuote {
  distanceMiles: number;
  fee: number;
  bufferMinutes: number;
}

export type TravelQuoteValue = TravelQuote;

interface AddressSearchProps {
  value: ServiceAddress;
  onChange: (address: ServiceAddress) => void;
  onQuoteCalculated?: (quote: TravelQuote | null) => void;
  onTravelQuoteChange?: (quote: TravelQuote | null) => void;
  onSelectAddress?: (address: ServiceAddress) => void;
  label?: string;
  showNotes?: boolean;
  hideTravelFeeCard?: boolean;
}

export function AddressSearch({
  value,
  onChange,
  onQuoteCalculated,
  onTravelQuoteChange,
  onSelectAddress,
  label = "Service Location",
  showNotes = true,
  hideTravelFeeCard = false,
}: AddressSearchProps) {
  const autocompleteAction = useAction(api.travelFees.autocomplete);
  const calculateTravelFee = useAction(api.travelFees.calculate);

  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isManualMode, setIsManualMode] = React.useState(false);
  const [travelQuote, setTravelQuote] = React.useState<TravelQuote | null>(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = React.useState(false);

  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSelectedAddress = Boolean(
    value.street.trim() && value.city.trim() && value.state.trim() && value.zip.trim(),
  );

  const isArkansas = React.useMemo(() => {
    return isArkansasState(value.state);
  }, [value.state]);

  // Travel Fee Calculation
  const runCalculateQuote = React.useCallback(
    async (address: ServiceAddress) => {
      if (!address.street.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
        setTravelQuote(null);
        onQuoteCalculated?.(null);
        onTravelQuoteChange?.(null);
        return;
      }

      setIsCalculatingQuote(true);
      try {
        const quote = await calculateTravelFee({
          address: {
            street: address.street.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            zip: address.zip.trim(),
            notes: address.notes?.trim() || undefined,
            latitude: address.latitude,
            longitude: address.longitude,
          },
        });
        setTravelQuote(quote);
        onQuoteCalculated?.(quote);
        onTravelQuoteChange?.(quote);
      } catch (err) {
        console.warn("Travel fee calculation failed:", err);
        setTravelQuote(null);
        onQuoteCalculated?.(null);
        onTravelQuoteChange?.(null);
      } finally {
        setIsCalculatingQuote(false);
      }
    },
    [calculateTravelFee, onQuoteCalculated, onTravelQuoteChange],
  );

  // Trigger travel quote on initial load if address is already selected
  React.useEffect(() => {
    if (hasSelectedAddress && !travelQuote && !isCalculatingQuote) {
      void runCalculateQuote(value);
    }
  }, [hasSelectedAddress, value, travelQuote, isCalculatingQuote, runCalculateQuote]);

  // Autocomplete search
  const handleQueryChange = (text: string) => {
    setQuery(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await autocompleteAction({ query: text.trim() });
        setSuggestions(results || []);
      } catch (err) {
        console.warn("Radar autocomplete action error:", err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const handleSelectSuggestion = (suggestion: any) => {
    const nextAddress: ServiceAddress = {
      street: suggestion.street || suggestion.addressLabel || "",
      city: suggestion.city || "",
      state: (suggestion.state || "AR").toUpperCase(),
      zip: suggestion.postalCode || "",
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    };

    setSuggestions([]);
    setQuery("");
    onChange(nextAddress);
    onSelectAddress?.(nextAddress);
    void runCalculateQuote(nextAddress);
  };

  const handleClearSelected = () => {
    onChange({
      street: "",
      city: "",
      state: "AR",
      zip: "",
      notes: value.notes,
    });
    setTravelQuote(null);
    onQuoteCalculated?.(null);
    setQuery("");
  };

  return (
    <View className="gap-3">
      {label ? (
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Text>
      ) : null}

      {/* Selected Address Card (Matching Web UI) */}
      {hasSelectedAddress && !isManualMode ? (
        <View className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-row items-start gap-2.5 flex-1">
              <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                <Check size={14} color="#fff" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Address Selected
                </Text>
                <Text className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  {value.street}, {value.city}, {value.state} {value.zip}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={handleClearSelected}
              className="rounded-full bg-emerald-500/20 p-1.5 active:bg-emerald-500/40"
            >
              <X size={14} color={THEME.light.foreground} />
            </Pressable>
          </View>
        </View>
      ) : (
        /* Radar Autocomplete Input */
        !isManualMode && (
          <View className="gap-2">
            <Input
              placeholder="Search for your address (e.g. 123 Main St, Little Rock)"
              value={query}
              onChangeText={handleQueryChange}
              leftIcon={<Search size={18} color={THEME.light.mutedForeground} />}
              rightIcon={
                isSearching ? (
                  <ActivityIndicator size="small" color={THEME.light.accent} />
                ) : query ? (
                  <Pressable accessibilityRole="button" onPress={() => handleQueryChange("")}>
                    <X size={16} color={THEME.light.mutedForeground} />
                  </Pressable>
                ) : undefined
              }
            />

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 ? (
              <Card className="border border-border shadow-md">
                <CardContent className="p-1">
                  {suggestions.map((item, idx) => (
                    <Pressable
                      key={idx}
                      accessibilityRole="button"
                      onPress={() => handleSelectSuggestion(item)}
                      className={`flex-row items-center gap-3 p-3 rounded-xl active:bg-secondary ${
                        idx < suggestions.length - 1 ? "border-b border-border/50" : ""
                      }`}
                    >
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-accent/10">
                        <MapPin size={15} color={THEME.light.accent} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-foreground">
                          {item.street || item.addressLabel}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {item.city ? `${item.city}, ` : ""}{item.state || "AR"} {item.postalCode || ""}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </View>
        )
      )}

      {/* Manual Input Fields when toggled */}
      {isManualMode && (
        <View className="gap-3 rounded-2xl border border-border bg-card p-4">
          <Input
            label="Street Address"
            placeholder="123 Main St"
            value={value.street}
            onChangeText={(text) => {
              const next = { ...value, street: text };
              onChange(next);
              void runCalculateQuote(next);
            }}
            leftIcon={<MapPin size={16} color={THEME.light.mutedForeground} />}
          />

          <View className="flex-row gap-2">
            <View className="flex-2">
              <Input
                label="City"
                placeholder="Little Rock"
                value={value.city}
                onChangeText={(text) => {
                  const next = { ...value, city: text };
                  onChange(next);
                  void runCalculateQuote(next);
                }}
              />
            </View>
            <View className="flex-1">
              <Input
                label="State"
                placeholder="AR"
                value={value.state}
                autoCapitalize="characters"
                maxLength={2}
                onChangeText={(text) => {
                  const next = { ...value, state: text.toUpperCase() };
                  onChange(next);
                  void runCalculateQuote(next);
                }}
              />
            </View>
            <View className="flex-1.5">
              <Input
                label="ZIP Code"
                placeholder="72201"
                keyboardType="numeric"
                maxLength={5}
                value={value.zip}
                onChangeText={(text) => {
                  const next = { ...value, zip: text };
                  onChange(next);
                  void runCalculateQuote(next);
                }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Gate / Access Notes */}
      {showNotes && (
        <Input
          placeholder="Gate code, parking instructions, or driveway notes (optional)"
          value={value.notes || ""}
          onChangeText={(text) => onChange({ ...value, notes: text })}
        />
      )}

      {/* Toggle between Radar Search and Manual Entry */}
      <View className="flex-row justify-end">
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsManualMode(!isManualMode)}
          className="py-1 px-2 active:opacity-70"
        >
          <Text className="text-xs font-semibold text-accent">
            {isManualMode ? "Use Radar Address Search" : "Enter Address Manually"}
          </Text>
        </Pressable>
      </View>

      {/* Live Travel Fee & State Warnings (Matching Web /book exactly) */}
      {!hideTravelFeeCard && hasSelectedAddress && (
        <View className="gap-2 pt-1">
          {isCalculatingQuote ? (
            <View className="flex-row items-center gap-2 rounded-xl bg-secondary/50 p-3">
              <ActivityIndicator size="small" color={THEME.light.accent} />
              <Text className="text-xs text-muted-foreground">Calculating travel distance & fee...</Text>
            </View>
          ) : isArkansas ? (
            travelQuote && travelQuote.fee > 0 ? (
              <View className="rounded-2xl border border-sky-300/40 bg-sky-500/10 p-3.5 gap-1.5">
                <View className="flex-row items-center gap-2">
                  <CheckCircle2 size={16} color="#0284c7" />
                  <Text className="font-bold text-xs text-sky-900 dark:text-sky-200">
                    {travelQuote.distanceMiles > 60
                      ? "Arkansas service area confirmed"
                      : "Travel fee applies"}
                  </Text>
                </View>
                <Text className="text-xs text-sky-950/80 dark:text-sky-100/80 leading-4">
                  We can service this Arkansas address. Travel fee:{" "}
                  <Text className="font-bold text-sky-950 dark:text-sky-100">
                    ${travelQuote.fee.toFixed(2)}
                  </Text>{" "}
                  ({travelQuote.distanceMiles.toFixed(1)} miles)
                </Text>
              </View>
            ) : (
              <View className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex-row items-center gap-2">
                <CheckCircle2 size={16} color="#16a34a" />
                <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Standard Little Rock service area (No travel fee)
                </Text>
              </View>
            )
          ) : (
            <View className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 gap-1.5">
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={16} color="#d97706" />
                <Text className="font-bold text-xs text-amber-900 dark:text-amber-200">
                  Out-of-Arkansas Coverage
                </Text>
              </View>
              <Text className="text-xs text-amber-950/80 dark:text-amber-100/80 leading-4">
                This address appears to be outside Arkansas. Estimated travel fee:{" "}
                <Text className="font-bold">
                  {travelQuote ? `$${travelQuote.fee.toFixed(2)}` : "Calculating"}
                </Text>
                . Service requires manual confirmation.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
