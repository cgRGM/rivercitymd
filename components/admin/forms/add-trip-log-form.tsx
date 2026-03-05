"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RadarAddressField, {
  type RadarLocationValue,
} from "@/components/ui/radar-address-field";
import TripRouteMap from "@/components/admin/trip-route-map";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type AddTripLogFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (tripLogId: string) => void;
};

type RouteResult = {
  start: RadarLocationValue;
  stops: RadarLocationValue[];
  radarMiles: number;
  finalMiles: number;
  mileageSource: "radar" | "manual_override" | "manual";
  routeGeoJson: {
    type: "LineString";
    coordinates: number[][];
  };
  routeArtifactKey: string;
  routeComputedAt: number;
};

export function AddTripLogForm({ open, onOpenChange, onCreated }: AddTripLogFormProps) {
  const createManualDraft = useMutation(api.tripLogs.createManualDraft);
  const calculateRoute = useAction(api.tripLogs.calculateRoute);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [businessPurpose, setBusinessPurpose] = useState("");
  const [start, setStart] = useState<RadarLocationValue | null>(null);
  const [stops, setStops] = useState<Array<RadarLocationValue | null>>([null]);
  const [manualMiles, setManualMiles] = useState("");
  const [manualOverrideReason, setManualOverrideReason] = useState("");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  const selectedStops = useMemo(
    () => stops.filter((stop): stop is RadarLocationValue => Boolean(stop)),
    [stops],
  );

  const resetForm = () => {
    setLogDate(new Date().toISOString().slice(0, 10));
    setBusinessPurpose("");
    setStart(null);
    setStops([null]);
    setManualMiles("");
    setManualOverrideReason("");
    setRouteResult(null);
    setIsSubmitting(false);
    setIsCalculating(false);
  };

  const handleCalculateRoute = async () => {
    if (!start || selectedStops.length === 0) {
      toast.error("Select a start and at least one destination before calculating.");
      return;
    }

    setIsCalculating(true);
    try {
      const result = (await calculateRoute({
        start,
        stops: selectedStops,
      })) as RouteResult;
      setRouteResult(result);
      if (!manualMiles) {
        setManualMiles(String(result.radarMiles));
      }
      toast.success("Route calculated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to calculate route",
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async () => {
    if (!start) {
      toast.error("Start location is required.");
      return;
    }
    if (selectedStops.length === 0) {
      toast.error("At least one destination is required.");
      return;
    }
    if (!businessPurpose.trim()) {
      toast.error("Business purpose is required.");
      return;
    }

    const parsedManualMiles = manualMiles ? Number.parseFloat(manualMiles) : undefined;
    if (
      manualMiles &&
      (!Number.isFinite(parsedManualMiles) ||
        (parsedManualMiles !== undefined && parsedManualMiles < 0))
    ) {
      toast.error("Mileage must be a valid positive number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const tripLogId = await createManualDraft({
        logDate,
        start,
        stops: selectedStops,
        businessPurpose: businessPurpose.trim(),
        mileage: {
          radarMiles: routeResult?.radarMiles,
          finalMiles: parsedManualMiles,
          mileageSource: routeResult ? "radar" : "manual",
          mileageOverrideReason: manualOverrideReason.trim() || undefined,
        },
      });

      if (routeResult) {
        await calculateRoute({
          tripLogId,
          start,
          stops: selectedStops,
        });
      }

      toast.success("Trip log created");
      onOpenChange(false);
      onCreated?.(tripLogId);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create trip log");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Trip Log</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="log-date">Date</Label>
              <Input
                id="log-date"
                type="date"
                value={logDate}
                onChange={(event) => setLogDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-miles">Final Mileage</Label>
              <Input
                id="manual-miles"
                placeholder="e.g. 24.8"
                value={manualMiles}
                onChange={(event) => setManualMiles(event.target.value)}
              />
              {routeResult && (
                <p className="text-xs text-muted-foreground">
                  Radar mileage: {routeResult.radarMiles.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-purpose">Business Purpose</Label>
            <Textarea
              id="business-purpose"
              placeholder="Describe the business purpose of this trip"
              value={businessPurpose}
              onChange={(event) => setBusinessPurpose(event.target.value)}
            />
          </div>

          <RadarAddressField
            label="Start Location"
            placeholder="Search starting address"
            value={start}
            onSelect={(value) => setStart(value)}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Destination Stops</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStops((prev) => [...prev, null])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Stop
              </Button>
            </div>
            {stops.map((stop, index) => (
              <div key={index} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Stop {index + 1}</p>
                  {stops.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setStops((prev) => prev.filter((_, stopIndex) => stopIndex !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <RadarAddressField
                  label=""
                  placeholder={`Search destination ${index + 1}`}
                  value={stop}
                  onSelect={(value) =>
                    setStops((prev) =>
                      prev.map((existing, stopIndex) =>
                        stopIndex === index ? value : existing,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mileage-reason">Override Reason (if miles adjusted)</Label>
            <Input
              id="mileage-reason"
              placeholder="Explain why final mileage differs from Radar"
              value={manualOverrideReason}
              onChange={(event) => setManualOverrideReason(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleCalculateRoute} disabled={isCalculating}>
              {isCalculating ? "Calculating..." : "Calculate Route"}
            </Button>
          </div>

          <TripRouteMap routeGeoJson={routeResult?.routeGeoJson || null} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Log"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddTripLogForm;
