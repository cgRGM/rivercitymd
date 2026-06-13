export function normalizeStripeCouponCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function validateCouponInput(args: {
  couponCode: string;
  discountType: "percent" | "amount";
  discountValue: number;
}) {
  const couponCode = normalizeStripeCouponCode(args.couponCode);
  if (!couponCode) {
    throw new Error("Coupon code must include at least one letter or number.");
  }
  if (!Number.isFinite(args.discountValue) || args.discountValue <= 0) {
    throw new Error("Discount value must be greater than zero.");
  }
  if (args.discountType === "percent" && args.discountValue > 100) {
    throw new Error("Percentage discounts cannot be greater than 100%.");
  }

  return {
    couponCode,
    discountValue:
      args.discountType === "amount"
        ? Math.round(args.discountValue * 100) / 100
        : args.discountValue,
  };
}
