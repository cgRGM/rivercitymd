"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import TripRouteMap from "@/components/admin/trip-route-map";
import RadarAddressField, {
  type RadarLocationValue,
} from "@/components/ui/radar-address-field";
import {
  AlertTriangle,
  ArrowLeft,
  FileUp,
  MapPinned,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
} from "lucide-react";

type RouteGeoJson = {
  type: "LineString";
  coordinates: number[][];
};

type ExpenseReceipt = {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: number;
  signedUrl?: string;
  isImage: boolean;
};

type ExpenseLine = {
  _id: Id<"tripLogExpenses">;
  incurredDate: string;
  category: string;
  amountCents: number;
  merchant?: string;
  notes?: string;
  receipts: ExpenseReceipt[];
};

type AppointmentSummary = {
  _id: Id<"appointments">;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  customerName?: string;
  customerEmail?: string;
};

type TripLogRecord = {
  _id: Id<"tripLogs">;
  status: "draft" | "completed";
  source: "manual" | "appointment";
  requiredForAppointment: boolean;
  logDate: string;
  businessPurpose: string;
  start: RadarLocationValue;
  stops: RadarLocationValue[];
  radarMiles?: number;
  finalMiles?: number;
  mileageOverrideReason?: string;
  routeGeoJson?: RouteGeoJson | null;
  expenseTotalCents: number;
  expenses: ExpenseLine[];
  appointmentSummary?: AppointmentSummary | null;
};

type TripLogDetailClientProps = {
  tripLogId: Id<"tripLogs">;
};

const RECEIPT_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";
const RECEIPT_MIME_ALLOWLIST = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const RECEIPT_EXTENSION_ALLOWLIST = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

function tripLogStatusBadge(status: string | null) {
  if (status === "draft") {
    return <Badge variant="secondary">Draft</Badge>;
  }
  if (status === "completed") {
    return <Badge variant="default">Completed</Badge>;
  }
  return <Badge variant="outline">N/A</Badge>;
}

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");
  if (lastDotIndex < 0) {
    return "";
  }
  return normalized.slice(lastDotIndex);
}

function isAllowedReceiptFile(file: File): boolean {
  const normalizedType = file.type.toLowerCase().split(";")[0]?.trim() || "";
  const extension = getFileExtension(file.name);
  return (
    RECEIPT_MIME_ALLOWLIST.has(normalizedType) &&
    RECEIPT_EXTENSION_ALLOWLIST.has(extension)
  );
}

export default function TripLogDetailClient({ tripLogId }: TripLogDetailClientProps) {
  const tripLog = useQuery(api.tripLogs.getById, { tripLogId }) as
    | TripLogRecord
    | null
    | undefined;

  const markCompleted = useMutation(api.tripLogs.markCompleted);
  const reopen = useMutation(api.tripLogs.reopen);
  const updateDraft = useMutation(api.tripLogs.updateDraft);
  const upsertExpenseLine = useMutation(api.tripLogs.upsertExpenseLine);
  const deleteExpenseLine = useMutation(api.tripLogs.deleteExpenseLine);
  const createReceiptUploadUrl = useMutation(api.tripLogs.createReceiptUploadUrl);
  const attachReceipt = useMutation(api.tripLogs.attachReceipt);
  const removeReceipt = useMutation(api.tripLogs.removeReceipt);
  const calculateRoute = useAction(api.tripLogs.calculateRoute);

  const [routePreview, setRoutePreview] = useState<RouteGeoJson | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseMerchant, setExpenseMerchant] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null);

  const [previewImage, setPreviewImage] = useState<{ url: string; fileName: string } | null>(
    null,
  );

  const [editLogDate, setEditLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editBusinessPurpose, setEditBusinessPurpose] = useState("");
  const [editStart, setEditStart] = useState<RadarLocationValue | null>(null);
  const [editStops, setEditStops] = useState<Array<RadarLocationValue | null>>([null]);
  const [editFinalMiles, setEditFinalMiles] = useState("");
  const [editOverrideReason, setEditOverrideReason] = useState("");
  const initializedLogIdRef = useRef<Id<"tripLogs"> | null>(null);

  useEffect(() => {
    if (!tripLog) return;
    if (initializedLogIdRef.current === tripLog._id) return;
    initializedLogIdRef.current = tripLog._id;
    setEditLogDate(tripLog.logDate || new Date().toISOString().slice(0, 10));
    setEditBusinessPurpose(tripLog.businessPurpose || "");
    setEditStart(tripLog.start || null);
    setEditStops(tripLog.stops?.length ? tripLog.stops : [null]);
    setEditFinalMiles(tripLog.finalMiles !== undefined ? String(tripLog.finalMiles) : "");
    setEditOverrideReason(tripLog.mileageOverrideReason || "");
    setRoutePreview(null);
    setExpenseDate(tripLog.logDate || new Date().toISOString().slice(0, 10));
  }, [tripLog]);

  const selectedStopsForEdit = useMemo(
    () => editStops.filter((stop): stop is RadarLocationValue => Boolean(stop)),
    [editStops],
  );

  const uploadReceiptForExpense = async (
    expenseId: Id<"tripLogExpenses">,
    file: File,
    showSuccessToast = true,
  ) => {
    if (!tripLog) return;

    if (!isAllowedReceiptFile(file)) {
      throw new Error("Only JPG, PNG, WEBP, and GIF image receipts are allowed.");
    }

    const upload = await createReceiptUploadUrl({
      tripLogId: tripLog._id,
      expenseId,
      fileName: file.name,
      contentType: file.type,
    });

    const uploadResponse = await fetch(upload.url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(errorText || "Upload failed");
    }

    await attachReceipt({
      expenseId,
      key: upload.key,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });

    if (showSuccessToast) {
      toast.success("Receipt uploaded");
    }
  };

  const handleCompleteLog = async () => {
    if (!tripLog) return;
    try {
      await markCompleted({ tripLogId: tripLog._id });
      toast.success("Trip log marked completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete trip log");
    }
  };

  const handleReopenLog = async () => {
    if (!tripLog) return;
    try {
      await reopen({ tripLogId: tripLog._id });
      toast.success("Trip log reopened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reopen trip log");
    }
  };

  const handleAddExpense = async () => {
    if (!tripLog) return;
    const parsedAmount = Number.parseFloat(expenseAmount);
    if (!expenseCategory.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter category and a valid amount.");
      return;
    }

    if (expenseReceiptFile && !isAllowedReceiptFile(expenseReceiptFile)) {
      toast.error("Only JPG, PNG, WEBP, and GIF image receipts are allowed.");
      return;
    }

    try {
      const expenseId = await upsertExpenseLine({
        tripLogId: tripLog._id,
        incurredDate: expenseDate,
        category: expenseCategory.trim(),
        amountCents: Math.round(parsedAmount * 100),
        merchant: expenseMerchant.trim() || undefined,
        notes: expenseNotes.trim() || undefined,
      });

      if (expenseReceiptFile) {
        await uploadReceiptForExpense(expenseId, expenseReceiptFile, false);
      }

      toast.success(expenseReceiptFile ? "Expense and receipt added" : "Expense added");
      setExpenseCategory("");
      setExpenseAmount("");
      setExpenseMerchant("");
      setExpenseNotes("");
      setExpenseReceiptFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add expense");
    }
  };

  const handleDeleteExpense = async (expenseId: Id<"tripLogExpenses">) => {
    try {
      await deleteExpenseLine({ expenseId });
      toast.success("Expense removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove expense");
    }
  };

  const handleReceiptUpload = async (expenseId: Id<"tripLogExpenses">, file: File) => {
    if (!isAllowedReceiptFile(file)) {
      toast.error("Only JPG, PNG, WEBP, and GIF image receipts are allowed.");
      return;
    }

    try {
      await uploadReceiptForExpense(expenseId, file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload receipt");
    }
  };

  const handleRemoveReceipt = async (expenseId: Id<"tripLogExpenses">, key: string) => {
    try {
      await removeReceipt({ expenseId, key });
      toast.success("Receipt removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove receipt");
    }
  };

  const handleRecalculateRoute = async () => {
    if (!tripLog) return;
    if (!editStart || selectedStopsForEdit.length === 0) {
      toast.error("Set a start and at least one destination before calculating route.");
      return;
    }
    setIsRouteLoading(true);
    try {
      const result = await calculateRoute({
        tripLogId: tripLog._id,
        start: editStart,
        stops: selectedStopsForEdit,
      });
      setRoutePreview(result.routeGeoJson);
      setEditStart(result.start);
      setEditStops(result.stops.length ? result.stops : [null]);
      if (!editFinalMiles) {
        setEditFinalMiles(String(result.finalMiles));
      }
      toast.success("Route updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to recalculate route");
    } finally {
      setIsRouteLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!tripLog || tripLog.status !== "draft") return;
    if (!editStart || selectedStopsForEdit.length === 0) {
      toast.error("Start and destination are required.");
      return;
    }
    if (!editBusinessPurpose.trim()) {
      toast.error("Business purpose is required.");
      return;
    }

    const parsedMiles = editFinalMiles ? Number.parseFloat(editFinalMiles) : undefined;
    if (
      editFinalMiles &&
      (!Number.isFinite(parsedMiles) || (parsedMiles !== undefined && parsedMiles < 0))
    ) {
      toast.error("Final mileage must be a valid positive number.");
      return;
    }

    setIsSavingDetails(true);
    try {
      await updateDraft({
        tripLogId: tripLog._id,
        logDate: editLogDate,
        businessPurpose: editBusinessPurpose.trim(),
        start: editStart,
        stops: selectedStopsForEdit,
        mileage: {
          radarMiles: tripLog.radarMiles,
          finalMiles: parsedMiles,
          mileageSource: tripLog.radarMiles !== undefined ? "radar" : "manual",
          mileageOverrideReason: editOverrideReason.trim() || undefined,
        },
      });
      toast.success("Trip log details updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update trip log");
    } finally {
      setIsSavingDetails(false);
    }
  };

  if (tripLog === undefined) {
    return <div className="py-8 text-sm text-muted-foreground">Loading trip log...</div>;
  }

  if (!tripLog) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/logs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Logs
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Trip log not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-4 z-10 rounded-lg border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/admin/logs"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Logs
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {tripLogStatusBadge(tripLog.status)}
            {tripLog.requiredForAppointment && (
              <Badge variant="outline">Required for appointment</Badge>
            )}
            <Badge variant="outline">{tripLog.source}</Badge>
            {tripLog.status === "draft" ? (
              <Button onClick={handleCompleteLog}>
                <MapPinned className="mr-2 h-4 w-4" />
                Mark Completed
              </Button>
            ) : (
              <Button variant="outline" onClick={handleReopenLog}>
                Reopen
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 py-4">
          <p className="text-sm">
            <span className="font-medium">Date:</span> {tripLog.logDate}
          </p>
          <p className="text-sm">
            <span className="font-medium">Purpose:</span> {tripLog.businessPurpose || "Not set"}
          </p>
          <p className="text-sm">
            <span className="font-medium">Mileage:</span> {tripLog.finalMiles ?? "N/A"}
            {tripLog.radarMiles !== undefined && ` (Radar ${tripLog.radarMiles})`}
          </p>
          {tripLog.mileageOverrideReason && (
            <p className="text-sm">
              <span className="font-medium">Override reason:</span> {tripLog.mileageOverrideReason}
            </p>
          )}
          {tripLog.appointmentSummary && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Appointment {tripLog.appointmentSummary.scheduledDate}{" "}
                {tripLog.appointmentSummary.scheduledTime}
                {tripLog.appointmentSummary.customerName
                  ? ` • ${tripLog.appointmentSummary.customerName}`
                  : ""}
              </p>
              <Link
                href={`/admin/appointments?appointmentId=${tripLog.appointmentSummary._id}`}
                className="inline-flex text-xs underline underline-offset-2 hover:text-foreground"
              >
                Open appointment in schedule
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editLogDate}
                  onChange={(event) => setEditLogDate(event.target.value)}
                  disabled={tripLog.status !== "draft"}
                />
              </div>
              <div className="space-y-1">
                <Label>Final Miles</Label>
                <Input
                  value={editFinalMiles}
                  onChange={(event) => setEditFinalMiles(event.target.value)}
                  placeholder="0.0"
                  disabled={tripLog.status !== "draft"}
                />
                {tripLog.radarMiles !== undefined && (
                  <p className="text-xs text-muted-foreground">Radar miles: {tripLog.radarMiles}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Business Purpose</Label>
              <Textarea
                value={editBusinessPurpose}
                onChange={(event) => setEditBusinessPurpose(event.target.value)}
                placeholder="Describe business purpose"
                disabled={tripLog.status !== "draft"}
              />
            </div>

            <div className="space-y-1">
              <Label>Mileage Override Reason</Label>
              <Input
                value={editOverrideReason}
                onChange={(event) => setEditOverrideReason(event.target.value)}
                placeholder="Required when final miles differ from Radar"
                disabled={tripLog.status !== "draft"}
              />
            </div>

            <RadarAddressField
              label="Start Location"
              placeholder="Search starting address"
              value={editStart}
              onSelect={setEditStart}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Destination Stops</Label>
                {tripLog.status === "draft" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditStops((prev) => [...prev, null])}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Stop
                  </Button>
                )}
              </div>

              {editStops.map((stop, index) => (
                <div key={index} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Stop {index + 1}</p>
                    {tripLog.status === "draft" && editStops.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditStops((prev) => prev.filter((_, stopIndex) => stopIndex !== index))
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
                      setEditStops((prev) =>
                        prev.map((existing, stopIndex) =>
                          stopIndex === index ? value : existing,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRecalculateRoute}
                disabled={isRouteLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {isRouteLoading ? "Updating..." : "Calculate Route"}
              </Button>
              {tripLog.status === "draft" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveDetails}
                  disabled={isSavingDetails}
                >
                  {isSavingDetails ? "Saving..." : "Save Details"}
                </Button>
              )}
            </div>

            <TripRouteMap routeGeoJson={routePreview || tripLog.routeGeoJson || null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Add expense line items and upload receipt images for tax documentation.
            </p>

            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Amount ($)</Label>
              <Input
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Input
                value={expenseCategory}
                onChange={(event) => setExpenseCategory(event.target.value)}
                placeholder="Fuel, supplies, tolls..."
              />
            </div>
            <div className="space-y-1">
              <Label>Merchant</Label>
              <Input
                value={expenseMerchant}
                onChange={(event) => setExpenseMerchant(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={expenseNotes}
                onChange={(event) => setExpenseNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-expense-receipt">Receipt Image (Optional)</Label>
              <Input
                id="new-expense-receipt"
                type="file"
                accept={RECEIPT_ACCEPT}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  if (nextFile && !isAllowedReceiptFile(nextFile)) {
                    toast.error("Only JPG, PNG, WEBP, and GIF image receipts are allowed.");
                    event.currentTarget.value = "";
                    setExpenseReceiptFile(null);
                    return;
                  }
                  setExpenseReceiptFile(nextFile);
                }}
              />
              {expenseReceiptFile && (
                <p className="text-xs text-muted-foreground">Selected: {expenseReceiptFile.name}</p>
              )}
            </div>
            <Button type="button" size="sm" onClick={handleAddExpense}>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>

            <div className="space-y-3 border-t pt-3">
              {(tripLog.expenses || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses yet.</p>
              ) : (
                tripLog.expenses.map((expense) => (
                  <div key={expense._id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {expense.category} • ${(expense.amountCents / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {expense.incurredDate}
                          {expense.merchant ? ` • ${expense.merchant}` : ""}
                        </p>
                        {expense.notes && (
                          <p className="text-xs text-muted-foreground">{expense.notes}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExpense(expense._id)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="mt-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`receipt-${expense._id}`}
                          className="inline-flex cursor-pointer items-center rounded-md border px-2 py-1 text-xs"
                        >
                          <FileUp className="mr-1 h-3 w-3" />
                          Upload image
                        </Label>
                        <Input
                          id={`receipt-${expense._id}`}
                          type="file"
                          className="hidden"
                          accept={RECEIPT_ACCEPT}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            handleReceiptUpload(expense._id, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>

                      {expense.receipts?.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {expense.receipts.map((receipt) => (
                            <div key={receipt.key} className="overflow-hidden rounded-md border">
                              {receipt.isImage && receipt.signedUrl ? (
                                <button
                                  type="button"
                                  className="w-full text-left"
                                  onClick={() =>
                                    setPreviewImage({
                                      url: receipt.signedUrl!,
                                      fileName: receipt.fileName,
                                    })
                                  }
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={receipt.signedUrl}
                                    alt={receipt.fileName}
                                    className="h-32 w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <div className="flex min-h-32 items-center justify-center bg-muted px-2 text-center text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Preview unavailable (legacy file)
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                                <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
                                  <Receipt className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{receipt.fileName}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveReceipt(expense._id, receipt.key)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.fileName || "Receipt Preview"}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage.url}
              alt={previewImage.fileName}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
