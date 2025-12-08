"use client";

import { useEffect, useRef, useState } from "react";
import Radar from "radar-sdk-js";
import "radar-sdk-js/dist/radar.css";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

interface RadarAddress {
  formattedAddress?: string;
  addressLabel?: string;
  addressComponents?: {
    street?: string;
    city?: string;
    locality?: string;
    state?: string;
    region?: string;
    postalCode?: string;
  };
  latitude?: number;
  longitude?: number;
}

interface AddressInputProps {
  onAddressSelect?: (address: RadarAddress) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export default function AddressInput({
  onAddressSelect,
  placeholder = "Search for your address",
  label = "Service Address",
  className = "",
}: AddressInputProps) {
  const [selectedAddress, setSelectedAddress] = useState<RadarAddress | null>(
    null,
  );
  const autocompleteRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    // Initialize Radar with your publishable key
    const radarKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY;
    if (!radarKey) {
      console.warn(
        "Radar publishable key not found. Please add NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY to your .env.local",
      );
      return;
    }

    Radar.initialize(radarKey);

    // Create autocomplete - following the docs exactly
    autocompleteRef.current = Radar.ui.autocomplete({
      container: "radar-address-autocomplete",
      showMarkers: true,
      markerColor: "#ACBDC8",
      responsive: true,
      width: "100%",
      maxHeight: "300px",
      placeholder: placeholder,
      limit: 8,
      minCharacters: 3,
      onSelection: (address: RadarAddress) => {
        console.log("Address selected:", address);
        setSelectedAddress(address);
        onAddressSelect?.(address);
      },
      onError: (error: unknown) => {
        console.error("Radar autocomplete error:", error);
      },
    });

    // Cleanup on unmount
    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.remove();
      }
    };
  }, [placeholder, onAddressSelect]);

  const clearSelection = () => {
    setSelectedAddress(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {label && <Label>{label}</Label>}

      {/* Radar Autocomplete Input - follows docs exactly */}
      <div id="radar-address-autocomplete" className="w-full" />

      {/* Selected Address Display */}
      {selectedAddress && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Address Selected:
                </p>
                <p className="text-sm text-green-700">
                  {selectedAddress.formattedAddress ||
                    selectedAddress.addressLabel}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
