"use client";

import { useEffect, useState } from "react";
import type { Path, PathValue, UseFormReturn } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

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

interface VehiclePricingEditorProps<TForm extends FormWithVehiclePrices> {
  form: UseFormReturn<TForm>;
  defaultDuration: number;
}

export function VehiclePricingEditor<TForm extends FormWithVehiclePrices>({
  form,
  defaultDuration,
}: VehiclePricingEditorProps<TForm>) {
  const vehicleTypes = useQuery(api.vehicleTypes.list, {});
  const ensureDefaults = useMutation(api.vehicleTypes.ensureDefaults);
  const createVehicleType = useMutation(api.vehicleTypes.create);
  const [newTypeNameByRow, setNewTypeNameByRow] = useState<Record<number, string>>({});
  const fieldName = "vehiclePrices" as Path<TForm>;

  const rows = form.watch(fieldName) as VehiclePriceFormRow[];

  useEffect(() => {
    void ensureDefaults().catch(() => {
      toast.error("Failed to initialize vehicle types");
    });
  }, [ensureDefaults]);

  useEffect(() => {
    if (!vehicleTypes || rows.length > 0) return;
    form.setValue(
      fieldName,
      vehicleTypes.map((vehicleType) => ({
        vehicleTypeId: vehicleType._id,
        price: 0,
        duration: defaultDuration,
        isAvailable: true,
      })) as PathValue<TForm, Path<TForm>>,
      { shouldValidate: true },
    );
  }, [defaultDuration, form, rows.length, vehicleTypes]);

  const updateRow = (
    index: number,
    patch: Partial<VehiclePriceFormRow>,
  ) => {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...patch };
    form.setValue(fieldName, nextRows as PathValue<TForm, Path<TForm>>, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const addRow = () => {
    form.setValue(
      fieldName,
      [
        ...rows,
        {
          price: 0,
          duration: defaultDuration,
          isAvailable: true,
        },
      ] as PathValue<TForm, Path<TForm>>,
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const removeRow = (index: number) => {
    form.setValue(
      fieldName,
      rows.filter((_, rowIndex) => rowIndex !== index) as PathValue<TForm, Path<TForm>>,
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const createTypeForRow = async (index: number) => {
    const name = newTypeNameByRow[index]?.trim();
    if (!name) return;

    try {
      const vehicleTypeId = await createVehicleType({ name });
      updateRow(index, { vehicleTypeId, vehicleTypeName: undefined });
      setNewTypeNameByRow((current) => ({ ...current, [index]: "" }));
      toast.success("Vehicle type added");
    } catch {
      toast.error("Failed to add vehicle type");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Vehicle Pricing</h3>
          <p className="text-xs text-muted-foreground">
            Set which vehicles this product applies to, plus price and calendar time.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add price
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={`${row.vehicleTypeId ?? "new"}-${index}`}
            className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(180px,1fr)_120px_120px_92px_40px]"
          >
            <div className="space-y-1">
              <Label className="text-xs">Vehicle type</Label>
              <Select
                value={row.vehicleTypeId ?? "new"}
                onValueChange={(value) =>
                  updateRow(index, {
                    vehicleTypeId: value === "new" ? undefined : value,
                    vehicleTypeName: undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes?.map((vehicleType) => (
                    <SelectItem key={vehicleType._id} value={vehicleType._id}>
                      {vehicleType.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">Add new type...</SelectItem>
                </SelectContent>
              </Select>
              {!row.vehicleTypeId && (
                <div className="flex gap-2">
                  <Input
                    value={newTypeNameByRow[index] ?? row.vehicleTypeName ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNewTypeNameByRow((current) => ({
                        ...current,
                        [index]: value,
                      }));
                      updateRow(index, { vehicleTypeName: value });
                    }}
                    placeholder="e.g. Van"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => createTypeForRow(index)}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Price</Label>
              <Input
                type="number"
                step="0.01"
                value={row.price || ""}
                onChange={(event) =>
                  updateRow(index, { price: parseFloat(event.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Minutes</Label>
              <Input
                type="number"
                step="5"
                value={row.duration || ""}
                onChange={(event) =>
                  updateRow(index, { duration: parseInt(event.target.value, 10) || 0 })
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Available</Label>
              <div className="flex h-9 items-center">
                <Switch
                  checked={row.isAvailable}
                  onCheckedChange={(checked) =>
                    updateRow(index, { isAvailable: checked })
                  }
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(index)}
                aria-label="Remove vehicle price"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
