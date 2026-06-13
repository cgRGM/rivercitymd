import { v } from "convex/values";

export const travelFeeSettingsValidator = v.object({
  originStreet: v.string(),
  originCity: v.string(),
  originState: v.string(),
  originZip: v.string(),
  originLatitude: v.number(),
  originLongitude: v.number(),
  freeRadiusMiles: v.number(),
  midRangeMaxMiles: v.number(),
  longRangeMaxMiles: v.number(),
  midRangeFee: v.number(),
  longRangeFee: v.number(),
  perMileRateAfterLongRange: v.number(),
  midRangeBufferMinutes: v.number(),
  longRangeBufferMinutes: v.number(),
  isActive: v.boolean(),
});

export type TravelFeeSettings = {
  originStreet: string;
  originCity: string;
  originState: string;
  originZip: string;
  originLatitude: number;
  originLongitude: number;
  freeRadiusMiles: number;
  midRangeMaxMiles: number;
  longRangeMaxMiles: number;
  midRangeFee: number;
  longRangeFee: number;
  perMileRateAfterLongRange: number;
  midRangeBufferMinutes: number;
  longRangeBufferMinutes: number;
  isActive: boolean;
};

export const defaultTravelFeeSettings: TravelFeeSettings = {
  originStreet: "220 N. Tyler St",
  originCity: "Little Rock",
  originState: "AR",
  originZip: "72205",
  originLatitude: 34.752258,
  originLongitude: -92.329768,
  freeRadiusMiles: 20,
  midRangeMaxMiles: 35,
  longRangeMaxMiles: 50,
  midRangeFee: 25,
  longRangeFee: 50,
  perMileRateAfterLongRange: 2,
  midRangeBufferMinutes: 30,
  longRangeBufferMinutes: 60,
  isActive: true,
};

function cleanNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function cleanMoney(value: number | undefined, fallback: number) {
  return Math.max(0, cleanNumber(value, fallback));
}

function cleanMinutes(value: number | undefined, fallback: number) {
  return Math.max(0, Math.floor(cleanNumber(value, fallback)));
}

function cleanString(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function normalizeTravelFeeSettings(
  settings: Partial<TravelFeeSettings>,
): TravelFeeSettings {
  const freeRadiusMiles = cleanNumber(
    settings.freeRadiusMiles,
    defaultTravelFeeSettings.freeRadiusMiles,
  );
  const midRangeMaxMiles = Math.max(
    freeRadiusMiles + 1,
    cleanNumber(settings.midRangeMaxMiles, defaultTravelFeeSettings.midRangeMaxMiles),
  );
  const longRangeMaxMiles = Math.max(
    midRangeMaxMiles + 1,
    cleanNumber(settings.longRangeMaxMiles, defaultTravelFeeSettings.longRangeMaxMiles),
  );

  return {
    originStreet: cleanString(
      settings.originStreet,
      defaultTravelFeeSettings.originStreet,
    ),
    originCity: cleanString(settings.originCity, defaultTravelFeeSettings.originCity),
    originState: cleanString(
      settings.originState,
      defaultTravelFeeSettings.originState,
    ),
    originZip: cleanString(settings.originZip, defaultTravelFeeSettings.originZip),
    originLatitude: cleanNumber(
      settings.originLatitude,
      defaultTravelFeeSettings.originLatitude,
    ),
    originLongitude: cleanNumber(
      settings.originLongitude,
      defaultTravelFeeSettings.originLongitude,
    ),
    freeRadiusMiles,
    midRangeMaxMiles,
    longRangeMaxMiles,
    midRangeFee: cleanMoney(settings.midRangeFee, defaultTravelFeeSettings.midRangeFee),
    longRangeFee: cleanMoney(
      settings.longRangeFee,
      defaultTravelFeeSettings.longRangeFee,
    ),
    perMileRateAfterLongRange: cleanMoney(
      settings.perMileRateAfterLongRange,
      defaultTravelFeeSettings.perMileRateAfterLongRange,
    ),
    midRangeBufferMinutes: cleanMinutes(
      settings.midRangeBufferMinutes,
      defaultTravelFeeSettings.midRangeBufferMinutes,
    ),
    longRangeBufferMinutes: cleanMinutes(
      settings.longRangeBufferMinutes,
      defaultTravelFeeSettings.longRangeBufferMinutes,
    ),
    isActive: settings.isActive ?? defaultTravelFeeSettings.isActive,
  };
}

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateTravelFeeForMiles(
  distanceMiles: number,
  settingsInput: Partial<TravelFeeSettings> = defaultTravelFeeSettings,
) {
  const settings = normalizeTravelFeeSettings(settingsInput);
  if (!settings.isActive) return 0;
  if (distanceMiles <= settings.freeRadiusMiles) return 0;
  if (distanceMiles <= settings.midRangeMaxMiles) return settings.midRangeFee;
  if (distanceMiles <= settings.longRangeMaxMiles) return settings.longRangeFee;
  const fee =
    settings.longRangeFee +
    (distanceMiles - settings.longRangeMaxMiles) *
      settings.perMileRateAfterLongRange;
  return Math.round(fee * 100) / 100;
}

export function calculateTravelBufferMinutesForMiles(
  distanceMiles: number,
  settingsInput: Partial<TravelFeeSettings> = defaultTravelFeeSettings,
) {
  const settings = normalizeTravelFeeSettings(settingsInput);
  if (!settings.isActive) return 0;
  if (distanceMiles <= settings.freeRadiusMiles) return 0;
  if (distanceMiles <= settings.midRangeMaxMiles) {
    return settings.midRangeBufferMinutes;
  }
  return settings.longRangeBufferMinutes;
}
