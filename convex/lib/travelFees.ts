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

export function calculateTravelFeeForMiles(distanceMiles: number) {
  if (distanceMiles < 25) return 0;
  if (distanceMiles <= 35) return 30;
  if (distanceMiles <= 50) return 50;
  const fee = 50 + (distanceMiles - 50) * 0.75;
  return Math.round(fee * 100) / 100;
}

export function calculateTravelBufferMinutesForMiles(distanceMiles: number) {
  if (distanceMiles < 25) return 0;
  if (distanceMiles <= 35) return 30;
  return 60;
}
