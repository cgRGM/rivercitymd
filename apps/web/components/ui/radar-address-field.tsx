"use client";

import { useEffect, useId, useRef, useState } from "react";
import Radar from "radar-sdk-js";
import "radar-sdk-js/dist/radar.css";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export type RadarLocationValue = {
  addressLabel?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

type RadarAddressFieldProps = {
  label?: string;
  placeholder?: string;
  value?: RadarLocationValue | null;
  onSelect: (value: RadarLocationValue | null) => void;
  className?: string;
};

type RadarAutocompleteSelection = {
  formattedAddress?: string;
  addressLabel?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

export default function RadarAddressField({
  label = "Address",
  placeholder = "Search address",
  value,
  onSelect,
  className = "",
}: RadarAddressFieldProps) {
  const [instanceKey, setInstanceKey] = useState(0);
  const [selectedAddress, setSelectedAddress] = useState<RadarLocationValue | null>(
    value || null,
  );
  const onSelectRef = useRef(onSelect);
  const autocompleteRef = useRef<{ remove: () => void } | null>(null);
  const inputId = useId().replace(/:/g, "");
  const containerId = `radar-address-${inputId}`;

  useEffect(() => {
    setSelectedAddress(value || null);
  }, [value]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const radarKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY;
    if (!radarKey) {
      console.warn(
        "Radar publishable key not found. Set NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY.",
      );
      return;
    }

    Radar.initialize(radarKey);

    autocompleteRef.current = Radar.ui.autocomplete({
      container: containerId,
      showMarkers: false,
      responsive: true,
      width: "100%",
      maxHeight: "280px",
      placeholder,
      limit: 8,
      minCharacters: 3,
      onSelection: (selection: RadarAutocompleteSelection) => {
        const normalized: RadarLocationValue = {
          addressLabel: selection.formattedAddress || selection.addressLabel,
          street: selection.street,
          city: selection.city,
          state: selection.state,
          postalCode: selection.postalCode,
          latitude: selection.latitude,
          longitude: selection.longitude,
        };
        setSelectedAddress(normalized);
        onSelectRef.current(normalized);
      },
      onError: (error: unknown) => {
        console.error("Radar autocomplete error:", error);
      },
    });

    return () => {
      autocompleteRef.current?.remove();
    };
  }, [containerId, instanceKey, placeholder]);

  const clearSelection = () => {
    setSelectedAddress(null);
    onSelect(null);
    setInstanceKey((prev) => prev + 1);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <div id={containerId} key={instanceKey} className="w-full" />

      {selectedAddress && (
        <div className="rounded-md border border-green-200 bg-green-50 p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-green-600" />
              <div className="text-sm text-green-800">
                {selectedAddress.addressLabel ||
                  [
                    selectedAddress.street,
                    selectedAddress.city,
                    selectedAddress.state,
                    selectedAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-6 w-6 p-0 text-green-700 hover:text-green-900"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
