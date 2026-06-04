const FIRST_TRAVEL_FEE_MILES = 25;
const TRAVEL_FEE_BAND_MILES = 50;
const BASE_TRAVEL_FEE = 40;

export function calculateTravelFeeForMiles(distanceMiles: number) {
  if (distanceMiles < FIRST_TRAVEL_FEE_MILES) return 0;
  return (Math.floor(distanceMiles / TRAVEL_FEE_BAND_MILES) + 1) * BASE_TRAVEL_FEE;
}
