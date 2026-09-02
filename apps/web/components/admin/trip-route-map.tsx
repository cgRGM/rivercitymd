"use client";

import { useEffect, useRef } from "react";
import Radar from "radar-sdk-js";
import "radar-sdk-js/dist/radar.css";

type RouteGeoJson = {
  type: "LineString";
  coordinates: number[][];
};

type TripRouteMapProps = {
  routeGeoJson?: RouteGeoJson | null;
  className?: string;
};

export default function TripRouteMap({ routeGeoJson, className = "" }: TripRouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!mapRef.current || !routeGeoJson || routeGeoJson.coordinates.length === 0) {
      return;
    }

    const radarKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY;
    if (!radarKey) {
      return;
    }

    Radar.initialize(radarKey);

    const [firstLng, firstLat] = routeGeoJson.coordinates[0];
    const map = Radar.ui.map({
      container: mapRef.current,
      center: [firstLng, firstLat],
      zoom: 10,
      style: "radar-default-v1",
      showZoomControls: true,
    });

    instanceRef.current = map as { remove: () => void };
    map.on("load", () => {
      map.addLine(
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: routeGeoJson.coordinates,
          },
          properties: {},
        },
        {
          paint: {
            "line-color": "#2563eb",
            "line-width": 4,
            "line-opacity": 0.85,
          },
        },
      );
      map.fitToFeatures({ padding: 48 });
    });

    return () => {
      try {
        instanceRef.current?.remove();
      } catch {
        // no-op
      }
      instanceRef.current = null;
    };
  }, [routeGeoJson]);

  if (!routeGeoJson || routeGeoJson.coordinates.length === 0) {
    return (
      <div
        className={`flex h-52 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground ${className}`}
      >
        Route preview will appear after calculating mileage.
      </div>
    );
  }

  return <div ref={mapRef} className={`h-72 w-full rounded-md border ${className}`} />;
}
