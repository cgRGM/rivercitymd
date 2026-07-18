"use client";

import { useEffect, useMemo, useState } from "react";
import type { Path, PathValue, UseFormReturn } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import { Edit, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type VehiclePriceFormRow = {
  vehicleTypeId?: string;
  vehicleTypeName?: string;
  price: number;
  duration: number;
  isAvailable: boolean;
};

type FormWithVehiclePrices = {
  vehiclePrices: VehiclePriceFormRow[];
};

type VehicleTypeOption = {
  _id: string;
  name: string;
};

interface VehiclePricingEditorProps<TForm extends FormWithVehiclePrices> {
  form: UseFormReturn<TForm>;
  defaultDuration: number;
}

const emptyDraft = (duration: number): VehiclePriceFormRow => ({
  price: 0,
  duration,
  isAvailable: true,
});

export function VehiclePricingEditor<TForm extends FormWithVehiclePrices>({
  form,
  defaultDuration,
}: VehiclePricingEditorProps<TForm>) {
  const vehicleTypes = useQuery(api.vehicleTypes.list, {}) as
    | VehicleTypeOption[]
    | undefined;
  const ensureDefaults = useMutation(api.vehicleTypes.ensureDefaults);
  const createVehicleType = useMutation(api.vehicleTypes.create);
  const fieldName = "vehiclePrices" as Path<TForm>;
  const rows = form.watch(fieldName) as VehiclePriceFormRow[];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [draft, setDraft] = useState<VehiclePriceFormRow>(
    emptyDraft(defaultDuration),
  );
  const [newTypeName, setNewTypeName] = useState("");

  useEffect(() => {
    void ensureDefaults().catch(() => {
      toast.error("Failed to initialize vehicle types");
    });
  }, [ensureDefaults]);

  const selectedVehicleTypeIds = useMemo(
    () =>
      new Set(
        rows
          .map((row, index) =>
            index === editingIndex ? undefined : row.vehicleTypeId,
          )
          .filter(Boolean),
      ),
    [editingIndex, rows],
  );

  const sortedRows = useMemo(() => {
    const orderById = new Map(vehicleTypes?.map((type, index) => [type._id, index]));
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const orderA = orderById.get(a.row.vehicleTypeId ?? "") ?? 999;
        const orderB = orderById.get(b.row.vehicleTypeId ?? "") ?? 999;
        return orderA - orderB;
      });
  }, [rows, vehicleTypes]);

  const setRows = (nextRows: VehiclePriceFormRow[]) => {
    form.setValue(fieldName, nextRows as PathValue<TForm, Path<TForm>>, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const openNew = () => {
    setEditingIndex(null);
    setDraft(emptyDraft(defaultDuration));
    setNewTypeName("");
    setIsPriceDialogOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setDraft(rows[index] ?? emptyDraft(defaultDuration));
    setNewTypeName("");
    setIsPriceDialogOpen(true);
  };

  const closeDialog = () => {
    setEditingIndex(null);
    setDraft(emptyDraft(defaultDuration));
    setNewTypeName("");
    setIsPriceDialogOpen(false);
  };

  const saveDraft = async () => {
    let nextDraft = { ...draft };
    if (!nextDraft.vehicleTypeId) {
      const name = newTypeName.trim() || nextDraft.vehicleTypeName?.trim();
      if (!name) {
        toast.error("Choose a vehicle type.");
        return;
      }
      try {
        const vehicleTypeId = await createVehicleType({ name });
        nextDraft = { ...nextDraft, vehicleTypeId, vehicleTypeName: undefined };
      } catch {
        toast.error("Failed to add vehicle type");
        return;
      }
    }

    if (
      nextDraft.vehicleTypeId &&
      rows.some(
        (row, index) =>
          index !== editingIndex && row.vehicleTypeId === nextDraft.vehicleTypeId,
      )
    ) {
      toast.error("That vehicle type already has a price.");
      return;
    }
    if (nextDraft.price <= 0 || nextDraft.duration <= 0) {
      toast.error("Price and minutes must be greater than zero.");
      return;
    }

    const nextRows =
      editingIndex === null
        ? [...rows, nextDraft]
        : rows.map((row, index) => (index === editingIndex ? nextDraft : row));
    setRows(nextRows);
    closeDialog();
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Vehicle pricing</h3>
          <p className="text-xs text-muted-foreground">
            Add only the vehicle types this product can service.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Add price
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No vehicle prices yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sortedRows.map(({ row, index }) => {
            const vehicleTypeName =
              vehicleTypes?.find((type) => type._id === row.vehicleTypeId)?.name ??
              row.vehicleTypeName ??
              "Vehicle";
            return (
              <div
                key={`${row.vehicleTypeId ?? row.vehicleTypeName}-${index}`}
                className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm"
              >
                <span className="font-medium">{vehicleTypeName}</span>
                <Badge variant={row.isAvailable ? "secondary" : "outline"}>
                  ${row.price.toFixed(0)} / {row.duration}m
                </Badge>
                {!row.isAvailable ? (
                  <Badge variant="outline">Hidden</Badge>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => openEdit(index)}
                  aria-label={`Edit ${vehicleTypeName} price`}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove ${vehicleTypeName} price`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isPriceDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex === null ? "Add vehicle price" : "Edit vehicle price"}
            </DialogTitle>
            <DialogDescription>
              Set the price, calendar minutes, and availability for one vehicle type.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Vehicle type</Label>
              <Select
                value={draft.vehicleTypeId ?? "new"}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    vehicleTypeId: value === "new" ? undefined : value,
                    vehicleTypeName: undefined,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes?.map((vehicleType) => (
                    <SelectItem
                      key={vehicleType._id}
                      value={vehicleType._id}
                      disabled={selectedVehicleTypeIds.has(vehicleType._id)}
                    >
                      {vehicleType.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">Add new type...</SelectItem>
                </SelectContent>
              </Select>
              {!draft.vehicleTypeId ? (
                <Input
                  value={newTypeName || draft.vehicleTypeName || ""}
                  onChange={(event) => {
                    setNewTypeName(event.target.value);
                    setDraft((current) => ({
                      ...current,
                      vehicleTypeName: event.target.value,
                    }));
                  }}
                  placeholder="e.g. Freightliner"
                />
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.price || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      price: parseFloat(event.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Minutes</Label>
                <Input
                  type="number"
                  step="5"
                  value={draft.duration || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      duration: parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3">
              <span>
                <span className="block text-sm font-medium">Available</span>
                <span className="block text-xs text-muted-foreground">
                  Customers can book this vehicle type.
                </span>
              </span>
              <Switch
                checked={draft.isAvailable}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, isAvailable: checked }))
                }
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={saveDraft}>
                Save price
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
