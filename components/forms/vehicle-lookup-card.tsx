"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { Camera, Check, Loader2, Search, Upload, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type VehicleSize = "small" | "medium" | "large";

export type VehicleClassification = {
  source: "fuelEconomy" | "vpic" | "manual" | "fallback";
  confidence: "high" | "medium" | "low";
  rawCategory?: string;
  needsAdminReview: boolean;
};

export type BeforePhoto = {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: number;
};

export type VehicleLookupValue = {
  year: string;
  make: string;
  model: string;
  color?: string;
  licensePlate?: string;
  size?: VehicleSize;
  vehicleTypeId?: string;
  vehicleTypeName?: string;
  classification?: VehicleClassification;
  hasPet?: boolean;
  beforePhotos?: BeforePhoto[];
};

type Suggestion = {
  year: number;
  make: string;
  model: string;
  label: string;
  source: "fuelEconomy" | "vpic";
};

type VehicleLookupCardProps = {
  value: VehicleLookupValue;
  onChange: (value: VehicleLookupValue) => void;
  title?: string;
  showColor?: boolean;
  showLicensePlate?: boolean;
  showPetToggle?: boolean;
  showBeforePhotos?: boolean;
  onRemove?: () => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
};

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const ALLOWED_PHOTO_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

function parseVehicleQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ");
  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
  const withoutYear = normalized.replace(yearMatch?.[0] ?? "", "").trim();
  const [make = "", ...modelParts] = withoutYear.split(" ");
  return {
    year: yearMatch?.[0] ?? "",
    make,
    model: modelParts.join(" "),
  };
}

function isValidYear(year: string) {
  return /^\d{4}$/.test(year);
}

function getFileExtension(fileName: string) {
  const normalized = fileName.toLowerCase().trim();
  const lastDotIndex = normalized.lastIndexOf(".");
  return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : "";
}

function getUploadContentType(file: File) {
  if (file.type) return file.type;
  const extension = getFileExtension(file.name);
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".heic") return "image/heic";
  if (extension === ".heif") return "image/heif";
  return "application/octet-stream";
}

function isAllowedPhoto(file: File) {
  const extension = getFileExtension(file.name);
  return (
    file.size <= MAX_PHOTO_SIZE_BYTES &&
    (ALLOWED_PHOTO_TYPES.has(file.type) ||
      (file.type === "" && ALLOWED_PHOTO_EXTENSIONS.has(extension)))
  );
}

export function VehicleLookupCard({
  value,
  onChange,
  title = "Vehicle",
  showColor = true,
  showLicensePlate = false,
  showPetToggle = false,
  showBeforePhotos = false,
  onRemove,
  isExpanded,
  onToggleExpanded,
}: VehicleLookupCardProps) {
  const searchModels = useAction(api.vehicleTypes.searchModels);
  const classifyVehicle = useAction(api.vehicleTypes.classify);
  const createBeforePhotoUploadUrl = useMutation(
    api.bookingDrafts.createBeforePhotoUploadUrl,
  );

  const initialQuery = [value.year, value.make, value.model].filter(Boolean).join(" ");
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const selectedVehicle = [value.year, value.make, value.model]
      .filter(Boolean)
      .join(" ");
    if (!query && selectedVehicle) {
      setQuery(selectedVehicle);
    }
  }, [query, value.make, value.model, value.year]);

  useEffect(() => {
    const parsed = parseVehicleQuery(query);
    const canSearch =
      parsed.make &&
      query.trim().length >= 3;
    if (!canSearch) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchModels({
          query,
        });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query, searchModels]);

  const detectedLabel = useMemo(() => {
    if (isClassifying) return "Detecting vehicle type...";
    if (value.vehicleTypeName) return `Detected: ${value.vehicleTypeName}`;
    if (value.classification?.needsAdminReview) return "Needs admin review";
    return "Select a vehicle to detect pricing type";
  }, [isClassifying, value.classification?.needsAdminReview, value.vehicleTypeName]);

  const updateValue = (patch: Partial<VehicleLookupValue>) => {
    onChange({ ...value, ...patch });
  };

  const classifySelection = async (nextValue: VehicleLookupValue) => {
    onChange(nextValue);

    if (!isValidYear(nextValue.year) || !nextValue.make || !nextValue.model) {
      return;
    }

    setIsClassifying(true);
    try {
      const classification = await classifyVehicle({
        year: Number(nextValue.year),
        make: nextValue.make,
        model: nextValue.model,
      });
      onChange({
        ...nextValue,
        size: classification.legacySize,
        vehicleTypeId: classification.vehicleTypeId as Id<"vehicleTypes"> | undefined,
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
        ...nextValue,
        classification: {
          source: "fallback",
          confidence: "low",
          needsAdminReview: true,
        },
      });
    } finally {
      setIsClassifying(false);
    }
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    setIsMenuOpen(false);
    setSuggestions([]);
    setQuery(suggestion.label);
    void classifySelection({
      ...value,
      year: String(suggestion.year),
      make: suggestion.make,
      model: suggestion.model,
    });
  };

  const acceptTypedVehicle = () => {
    const typed = parseVehicleQuery(query);
    if (!isValidYear(typed.year) || !typed.make || !typed.model) return;
    setIsMenuOpen(false);
    setSuggestions([]);
    void classifySelection({
      ...value,
      year: typed.year,
      make: typed.make,
      model: typed.model,
    });
  };

  const uploadBeforePhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const existingPhotos = value.beforePhotos ?? [];
    const remainingSlots = Math.max(0, MAX_PHOTOS - existingPhotos.length);
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    if (selectedFiles.length === 0) {
      toast.error(`You can upload up to ${MAX_PHOTOS} before photos per vehicle.`);
      return;
    }

    const invalidFile = selectedFiles.find((file) => !isAllowedPhoto(file));
    if (invalidFile) {
      toast.error("Before photos must be JPG, PNG, WEBP, GIF, HEIC, or HEIF under 10MB.");
      return;
    }

    setIsUploading(true);
    try {
      const uploadedPhotos: BeforePhoto[] = [];
      for (const file of selectedFiles) {
        const contentType = getUploadContentType(file);
        const upload = await createBeforePhotoUploadUrl({
          fileName: file.name,
          contentType,
        });
        const response = await fetch(upload.url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!response.ok) {
          throw new Error((await response.text()) || "Photo upload failed");
        }
        uploadedPhotos.push({
          key: upload.key,
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
          uploadedAt: Date.now(),
        });
      }
      updateValue({
        beforePhotos: [...existingPhotos, ...uploadedPhotos],
      });
      toast.success(
        uploadedPhotos.length === 1
          ? "Before photo uploaded"
          : "Before photos uploaded",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (key: string) => {
    updateValue({
      beforePhotos: (value.beforePhotos ?? []).filter((photo) => photo.key !== key),
    });
  };

  const isAccordion = isExpanded !== undefined;
  const showContent = !isAccordion || isExpanded;

  return (
    <div className="relative rounded-md border bg-background p-4">
      <div 
        className={`flex items-start justify-between gap-3 ${isAccordion ? "cursor-pointer select-none" : ""}`}
        onClick={isAccordion ? onToggleExpanded : undefined}
      >
        <div className="flex items-center gap-3">
          {isAccordion && (
            <div className="text-muted-foreground mt-0.5">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          )}
          <div>
            <h4 className="text-sm font-medium">
              {title}
              {(value.year || value.make || value.model) ? (
                <span className="ml-2 text-foreground font-semibold">
                  {[value.year, value.make, value.model].filter(Boolean).join(" ")}
                </span>
              ) : (
                <span className="ml-2 text-muted-foreground italic">(Details pending)</span>
              )}
            </h4>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={value.vehicleTypeName ? "default" : "secondary"}>
                {isClassifying && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {detectedLabel}
              </Badge>
              {value.classification?.rawCategory && (
                <span className="text-xs text-muted-foreground">
                  {value.classification.rawCategory}
                </span>
              )}
            </div>
          </div>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove vehicle</span>
          </Button>
        )}
      </div>

      {showContent && (
        <div className="space-y-4 pt-4 mt-4 border-t border-border/40">
          <div className="relative space-y-2">
              <Label htmlFor={`${title}-vehicle`}>Vehicle</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`${title}-vehicle`}
                  className="pl-9"
                  placeholder="Search Kia Sorento or 2020 Kia Sorento"
                  value={query}
                  onBlur={() => {
                    if (!value.make || !value.model) {
                      acceptTypedVehicle();
                    }
                    setIsMenuOpen(false);
                  }}
                  onFocus={() => setIsMenuOpen(true)}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setIsMenuOpen(true);
                    updateValue({
                      year: "",
                      make: "",
                      model: "",
                      vehicleTypeId: undefined,
                      vehicleTypeName: undefined,
                      classification: undefined,
                    });
                  }}
                />
              </div>

              {isMenuOpen &&
                (suggestions.length > 0 ||
                  isSearching ||
                  (parseVehicleQuery(query).year && parseVehicleQuery(query).model)) && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-background shadow-lg">
                  {isSearching && (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching vehicles...
                    </div>
                  )}
                  {suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.source}-${suggestion.label}`}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectSuggestion(suggestion);
                      }}
                    >
                      <span>{suggestion.label}</span>
                    </button>
                  ))}
                  {parseVehicleQuery(query).year && parseVehicleQuery(query).model && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        acceptTypedVehicle();
                      }}
                    >
                      <Check className="h-4 w-4" />
                      Use &quot;{query.trim()}&quot;
                    </button>
                  )}
                </div>
              )}
          </div>

          {(showColor || showLicensePlate) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {showColor && (
                <div className="space-y-2">
                  <Label htmlFor={`${title}-color`}>Color (Optional)</Label>
                  <Input
                    id={`${title}-color`}
                    placeholder="Silver"
                    value={value.color ?? ""}
                    onChange={(event) => updateValue({ color: event.target.value })}
                  />
                </div>
              )}

              {showLicensePlate && (
                <div className="space-y-2">
                  <Label htmlFor={`${title}-plate`}>License Plate (Optional)</Label>
                  <Input
                    id={`${title}-plate`}
                    value={value.licensePlate ?? ""}
                    onChange={(event) => updateValue({ licensePlate: event.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {showPetToggle && (
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <Label htmlFor={`${title}-pet`} className="mb-0">
                Pet hair or pet travel
              </Label>
              <Switch
                id={`${title}-pet`}
                checked={value.hasPet === true}
                onCheckedChange={(checked) => updateValue({ hasPet: checked })}
              />
            </div>
          )}

          {showBeforePhotos && (
            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <Label className="mb-0">Before photos (optional)</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading || (value.beforePhotos ?? []).length >= MAX_PHOTOS}
                  asChild
                >
                  <label className="cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        void uploadBeforePhotos(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </Button>
              </div>
              {(value.beforePhotos ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(value.beforePhotos ?? []).map((photo) => (
                    <Badge key={photo.key} variant="secondary" className="gap-2">
                      <span className="max-w-[150px] truncate">{photo.fileName}</span>
                      <button
                        type="button"
                        className="rounded-full hover:text-destructive"
                        onClick={() => removePhoto(photo.key)}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove photo</span>
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
