"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "sonner";
import AddTripLogForm from "@/components/admin/forms/add-trip-log-form";
import {
  ArrowUpDown,
  Calendar,
  Download,
  MoreHorizontal,
  Plus,
} from "lucide-react";

type AppointmentSummary = {
  _id: Id<"appointments">;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  customerName?: string;
};

type TripLogListRecord = {
  _id: Id<"tripLogs">;
  status: "draft" | "completed";
  source: "manual" | "appointment";
  requiredForAppointment: boolean;
  logDate: string;
  businessPurpose: string;
  finalMiles?: number;
  expenseTotalCents: number;
  appointment?: AppointmentSummary | null;
};

const BACKFILL_LOCALSTORAGE_KEY = "trip-log-backfill-last-run-date";

function tripLogStatusBadge(status: "draft" | "completed") {
  if (status === "draft") {
    return <Badge variant="secondary">Draft</Badge>;
  }
  return <Badge variant="default">Completed</Badge>;
}

export default function TripLogsClient() {
  const params = useSearchParams();
  const router = useRouter();
  const appointmentIdParam =
    (params.get("appointmentId") as Id<"appointments"> | null) || undefined;

  const listLogs = useQuery(api.tripLogs.list, {
    appointmentId: appointmentIdParam,
  }) as TripLogListRecord[] | undefined;
  const pendingRequiredCount = useQuery(api.tripLogs.getPendingRequiredCount) ?? 0;

  const markCompleted = useMutation(api.tripLogs.markCompleted);
  const reopen = useMutation(api.tripLogs.reopen);
  const exportMonthlyCsv = useAction(api.tripLogs.exportMonthlyCsv);
  const backfillCompletedAppointmentDrafts = useAction(
    api.tripLogs.backfillCompletedAppointmentDrafts,
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionRowId, setActionRowId] = useState<Id<"tripLogs"> | null>(null);
  const backfillStartedRef = useRef(false);

  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (backfillStartedRef.current) return;
    backfillStartedRef.current = true;

    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    if (window.localStorage.getItem(BACKFILL_LOCALSTORAGE_KEY) === today) {
      return;
    }

    void (async () => {
      try {
        const result = await backfillCompletedAppointmentDrafts({});
        window.localStorage.setItem(BACKFILL_LOCALSTORAGE_KEY, today);
        if (result.created > 0) {
          toast.success(`Created ${result.created} missing required trip log draft(s).`);
        }
      } catch (error) {
        console.warn("Trip log backfill failed", error);
      }
    })();
  }, [backfillCompletedAppointmentDrafts]);

  const logs = useMemo(() => listLogs || [], [listLogs]);

  const handleCompleteLog = async (tripLogId: Id<"tripLogs">) => {
    setActionRowId(tripLogId);
    try {
      await markCompleted({ tripLogId });
      toast.success("Trip log marked completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete trip log");
    } finally {
      setActionRowId(null);
    }
  };

  const handleReopenLog = async (tripLogId: Id<"tripLogs">) => {
    setActionRowId(tripLogId);
    try {
      await reopen({ tripLogId });
      toast.success("Trip log reopened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reopen trip log");
    } finally {
      setActionRowId(null);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const result = await exportMonthlyCsv({ fromDate, toDate });
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast.success(`Export generated (${result.rowCount} rows)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: ColumnDef<TripLogListRecord>[] = [
    {
      accessorKey: "logDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex min-w-[130px] items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.logDate}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => tripLogStatusBadge(row.original.status),
    },
    {
      accessorKey: "requiredForAppointment",
      header: "Required",
      cell: ({ row }) =>
        row.original.requiredForAppointment ? (
          <Badge variant="destructive">Required</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">No</span>
        ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="capitalize text-sm text-muted-foreground">{row.original.source}</span>
      ),
    },
    {
      accessorKey: "businessPurpose",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Purpose
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="block min-w-[220px] max-w-[340px] truncate text-sm">
          {row.original.businessPurpose || "-"}
        </span>
      ),
    },
    {
      accessorKey: "finalMiles",
      header: "Miles",
      cell: ({ row }) => <span>{row.original.finalMiles ?? "N/A"}</span>,
    },
    {
      accessorKey: "expenseTotalCents",
      header: "Expenses",
      cell: ({ row }) => <span>${(row.original.expenseTotalCents / 100).toFixed(2)}</span>,
    },
    {
      id: "appointment",
      header: "Appointment / Customer",
      cell: ({ row }) => {
        const appointment = row.original.appointment;
        if (!appointment) {
          return <span className="text-xs text-muted-foreground">Standalone log</span>;
        }
        return (
          <div className="min-w-[220px] text-xs">
            <p>
              {appointment.scheduledDate} {appointment.scheduledTime}
            </p>
            <p className="text-muted-foreground">
              {appointment.customerName || "Unknown customer"}
            </p>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={actionRowId === row.original._id}>
              <span className="sr-only">Open actions</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/admin/logs/${row.original._id}`}>Open</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.status === "draft" ? (
              <DropdownMenuItem onClick={() => void handleCompleteLog(row.original._id)}>
                Complete
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => void handleReopenLog(row.original._id)}>
                Reopen
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Trip Logs</h2>
          <p className="text-muted-foreground">
            Manage mileage and expense records for tax reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={pendingRequiredCount > 0 ? "destructive" : "outline"}>
            {pendingRequiredCount} pending required
          </Badge>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Log
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Export</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="from-date">From</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to-date">To</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleExportCsv} disabled={isExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={logs}
        filterColumn="businessPurpose"
        filterPlaceholder="Filter by business purpose..."
        tableMinWidthClass="min-w-[1220px]"
      />

      <AddTripLogForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        onCreated={(newTripLogId) => router.push(`/admin/logs/${newTripLogId}`)}
      />
    </div>
  );
}
