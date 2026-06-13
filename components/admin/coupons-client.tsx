"use client";

import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Tag,
  RefreshCw,
  Percent,
  Ticket,
} from "lucide-react";
import { normalizeStripeCouponCode } from "@/convex/lib/coupons";

interface StripeCoupon {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  max_redemptions: number | null;
  times_redeemed: number;
  valid: boolean;
}

export default function CouponsClient() {
  const listCoupons = useAction(api.payments.listStripeCoupons);
  const createCoupon = useAction(api.payments.createStripeCoupon);
  const deleteCoupon = useAction(api.payments.deleteStripeCoupon);

  const [coupons, setCoupons] = useState<StripeCoupon[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState<number | "">("");
  const [duration, setDuration] = useState<"once" | "forever">("once");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCoupons = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await listCoupons();
      setCoupons(data);
    } catch (error) {
      toast.error("Failed to load coupons");
      console.error(error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [listCoupons]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCouponCode = normalizeStripeCouponCode(couponCode);
    if (!normalizedCouponCode) {
      toast.error("Coupon code is required");
      return;
    }
    if (discountValue === "" || discountValue <= 0) {
      toast.error("Please enter a valid discount value");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCoupon({
        couponCode: normalizedCouponCode,
        discountType,
        discountValue: Number(discountValue),
        duration,
      });
      toast.success(`Coupon ${result.id} created successfully`);
      setShowCreateDialog(false);
      
      // Reset form
      setCouponCode("");
      setDiscountValue("");
      setDuration("once");
      
      fetchCoupons(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create coupon"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm(`Are you sure you want to delete coupon ${id}?`)) {
      return;
    }
    
    setDeletingId(id);
    try {
      await deleteCoupon({ couponId: id });
      toast.success("Coupon deleted successfully");
      fetchCoupons(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete coupon"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Stats calculations
  const totalCoupons = coupons?.length || 0;
  const activeCouponsCount = coupons?.filter((c) => c.valid).length || 0;
  const totalRedemptions = coupons?.reduce((sum, c) => sum + (c.times_redeemed || 0), 0) || 0;
  const normalizedCouponPreview = normalizeStripeCouponCode(couponCode);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Coupons</h2>
          <p className="text-muted-foreground">
            Manage your discount codes and promotions synced with Stripe
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void fetchCoupons(true)}
            disabled={loading || isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Coupon
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Coupons</p>
                <div className="text-3xl font-bold mt-1">{loading ? <Skeleton className="h-9 w-12" /> : totalCoupons}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
                <Ticket className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Active Coupons</p>
                <div className="text-3xl font-bold mt-1">{loading ? <Skeleton className="h-9 w-12" /> : activeCouponsCount}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                <Tag className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Redemptions</p>
                <div className="text-3xl font-bold mt-1">{loading ? <Skeleton className="h-9 w-12" /> : totalRedemptions}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                <Percent className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons List */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="overflow-hidden">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-8 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : coupons && coupons.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card
              key={coupon.id}
              className={`overflow-hidden border transition-all duration-200 hover:shadow-md ${
                !coupon.valid ? "opacity-60 bg-muted/40 border-muted" : "border-border"
              }`}
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold font-mono tracking-wide">{coupon.id}</CardTitle>
                    <Badge variant={coupon.valid ? "default" : "secondary"}>
                      {coupon.valid ? "Active" : "Archived"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {coupon.duration === "once" ? "One-time use" : "Forever"}
                  </p>
                </div>
                {coupon.valid && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => void handleDeleteCoupon(coupon.id)}
                    disabled={deletingId === coupon.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {coupon.percent_off
                      ? `${coupon.percent_off}%`
                      : formatCurrency(coupon.amount_off || 0)}
                  </span>
                  <span className="text-sm text-muted-foreground font-semibold">OFF</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3 mt-1">
                  <div>
                    <span className="text-muted-foreground">Redemptions:</span>
                    <p className="font-semibold text-foreground mt-0.5">{coupon.times_redeemed} times</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Limit:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {coupon.max_redemptions ? `${coupon.max_redemptions} max` : "Unlimited"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Ticket className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No coupons found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create a new discount code to share with your customers or apply directly to invoice balances.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Coupon
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog Modal */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Stripe Coupon</DialogTitle>
            <DialogDescription>
              Create a new coupon in Stripe that can be applied to customer invoices.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreateCoupon(e)} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="create-coupon-code">Coupon Code</Label>
              <Input
                id="create-coupon-code"
                placeholder="e.g. SUMMER20, DISCOUNT50"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="uppercase font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Spaces and symbols are saved as underscores. Customers will use{" "}
                <span className="font-mono font-medium">
                  {normalizedCouponPreview || "THIS_FORMAT"}
                </span>
                .
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-discount-type">Discount Type</Label>
                <Select
                  value={discountType}
                  onValueChange={(val) => setDiscountType(val as "percent" | "amount")}
                >
                  <SelectTrigger id="create-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage Off (%)</SelectItem>
                    <SelectItem value="amount">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-duration">Duration</Label>
                <Select
                  value={duration}
                  onValueChange={(val) => setDuration(val as "once" | "forever")}
                >
                  <SelectTrigger id="create-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time Use</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-discount-value">
                {discountType === "percent" ? "Percentage Off (%)" : "Discount Amount ($)"}
              </Label>
              <div className="relative">
                {discountType === "amount" && (
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground text-sm">
                    $
                  </div>
                )}
                <Input
                  id="create-discount-value"
                  type="number"
                  placeholder={discountType === "percent" ? "e.g. 20" : "e.g. 15.00"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value === "" ? "" : Number(e.target.value))}
                  className={discountType === "amount" ? "pl-7" : ""}
                  min={1}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Coupon"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
