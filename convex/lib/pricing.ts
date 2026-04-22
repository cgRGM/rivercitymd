export type ServiceType = "standard" | "addon" | "subscription";
export type VehicleSize = "small" | "medium" | "large";
export const DEFAULT_PET_FEE_AMOUNT = 50;

type ServicePricingShape = {
  basePrice?: number;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  isActive?: boolean;
  serviceType?: ServiceType;
};

type PetFeePricingShape = {
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  isActive?: boolean;
} | null;

export function normalizeServiceType(serviceType?: ServiceType): ServiceType {
  return serviceType ?? "standard";
}

export function getEffectiveServicePrice(
  service: ServicePricingShape,
  vehicleSize: VehicleSize,
): number {
  const fallback = service.basePrice ?? 0;
  if (vehicleSize === "small") {
    return service.basePriceSmall ?? service.basePriceMedium ?? fallback;
  }
  if (vehicleSize === "large") {
    return service.basePriceLarge ?? service.basePriceMedium ?? fallback;
  }
  return service.basePriceMedium ?? fallback;
}

export function hasAnyPositiveServicePrice(service: ServicePricingShape): boolean {
  return (
    (service.basePriceSmall ?? 0) > 0 ||
    (service.basePriceMedium ?? 0) > 0 ||
    (service.basePriceLarge ?? 0) > 0 ||
    (service.basePrice ?? 0) > 0
  );
}

export function isBookableStandardService(service: ServicePricingShape): boolean {
  return (
    service.isActive === true &&
    normalizeServiceType(service.serviceType) === "standard" &&
    hasAnyPositiveServicePrice(service)
  );
}

export function getEffectivePetFeePrice(
  settings: PetFeePricingShape,
  vehicleSize: VehicleSize,
): number {
  if (settings?.isActive === false) {
    return 0;
  }

  const fallback = DEFAULT_PET_FEE_AMOUNT;
  if (vehicleSize === "small") {
    return settings?.basePriceSmall ?? settings?.basePriceMedium ?? fallback;
  }
  if (vehicleSize === "large") {
    return settings?.basePriceLarge ?? settings?.basePriceMedium ?? fallback;
  }
  return settings?.basePriceMedium ?? fallback;
}
