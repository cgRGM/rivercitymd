export type ServiceType = "standard" | "addon" | "subscription";
export type VehicleSize = "small" | "medium" | "large";
export const DEFAULT_PET_FEE_AMOUNT = 50;

export type ServiceVehiclePriceShape = {
  vehicleTypeId?: string;
  price: number;
  duration?: number;
  isAvailable: boolean;
  vehicleType?: {
    legacySize?: VehicleSize;
  } | null;
};

type ServicePricingShape = {
  basePrice?: number;
  basePriceSmall?: number;
  basePriceMedium?: number;
  basePriceLarge?: number;
  duration?: number;
  isActive?: boolean;
  serviceType?: ServiceType;
  vehiclePrices?: ServiceVehiclePriceShape[];
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

export function getEffectiveServicePricingForVehicle(
  service: ServicePricingShape,
  vehicle: {
    vehicleSize: VehicleSize;
    vehicleTypeId?: string | null;
  },
): {
  price: number;
  duration: number;
  isAvailable: boolean;
} {
  const fallbackDuration = Math.max(0, service.duration ?? 0);
  const rows = service.vehiclePrices ?? [];

  if (rows.length > 0) {
    const exactRow = vehicle.vehicleTypeId
      ? rows.find((row) => row.vehicleTypeId === vehicle.vehicleTypeId)
      : undefined;
    const legacyRow = !vehicle.vehicleTypeId
      ? rows.find(
          (row) => row.vehicleType?.legacySize === vehicle.vehicleSize,
        )
      : undefined;
    const row = exactRow ?? legacyRow;

    if (!row) {
      return { price: 0, duration: fallbackDuration, isAvailable: false };
    }

    const price = Number.isFinite(row.price) ? row.price : 0;
    const duration = Math.max(0, row.duration ?? fallbackDuration);
    return {
      price,
      duration,
      isAvailable: row.isAvailable && price > 0 && duration > 0,
    };
  }

  const price = getEffectiveServicePrice(service, vehicle.vehicleSize);
  return {
    price,
    duration: fallbackDuration,
    isAvailable: service.isActive !== false && price > 0,
  };
}

export function isServiceAvailableForVehicle(
  service: ServicePricingShape,
  vehicle: {
    vehicleSize: VehicleSize;
    vehicleTypeId?: string | null;
  },
): boolean {
  return (
    service.isActive === true &&
    getEffectiveServicePricingForVehicle(service, vehicle).isAvailable
  );
}

export function hasAnyPositiveServicePrice(service: ServicePricingShape): boolean {
  return (
    (service.basePriceSmall ?? 0) > 0 ||
    (service.basePriceMedium ?? 0) > 0 ||
    (service.basePriceLarge ?? 0) > 0 ||
    (service.basePrice ?? 0) > 0
  );
}

export function hasAnyAvailableVehicleTypePrice(
  vehiclePrices?: ServiceVehiclePriceShape[],
): boolean {
  return (
    vehiclePrices?.some(
      (price) =>
        price.isAvailable &&
        Number.isFinite(price.price) &&
        price.price > 0 &&
        (price.duration ?? 0) > 0,
    ) ?? false
  );
}

export function isBookableStandardService(service: ServicePricingShape): boolean {
  const hasVehicleTypeRows = (service.vehiclePrices?.length ?? 0) > 0;
  return (
    service.isActive === true &&
    normalizeServiceType(service.serviceType) === "standard" &&
    (hasVehicleTypeRows
      ? hasAnyAvailableVehicleTypePrice(service.vehiclePrices)
      : hasAnyPositiveServicePrice(service))
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
