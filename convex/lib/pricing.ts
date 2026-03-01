export type ServiceType = "standard" | "addon" | "subscription";
export type VehicleSize = "small" | "medium" | "large";

type ServicePricingShape = {
  basePrice?: number;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  isActive?: boolean;
  serviceType?: ServiceType;
};

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
