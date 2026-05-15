"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ✅ static import: lebih stabil (hindari ChunkLoadError)
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// =====================
// Types LOKAL (karena src/types/index.ts belum punya ShiftLog)
// =====================
type EquipmentState = "OFF" | "IDLE" | "RUNNING" | "MAINTENANCE" | "ERROR";
type CheckMethod = "SENSOR" | "MANUAL";
type QualityGrade = "A" | "B" | "C" | "D";
type LiquidType = "ETHANOL" | "CACL2" | "CALCIUM_LIGNOSULFONATE" | "MIBC";

type TaskItem = { title: string; done?: boolean; note?: string };

type OperatorShift = {
  operatorId: string;
  fullName: string;
  shiftStartAt: string;
  shiftEndAt: string;
  tasks: TaskItem[];
  notes: string;
};

type LiquidStockCheck = {
  liquidType: LiquidType;
  stockId: string;
  supplierBatchId: string;

  volumeStartShiftLiters: number; // total awal = awal shift
  volumeBeforeLiters: number;     // sebelum pengecekan (pada saat check)
  volumeAfterLiters: number;      // setelah koreksi / hasil sensor

  lastRefillLiters?: number;
  lastRefillAt?: string;

  checkMethod: CheckMethod;
  checkedAt: string;
  checkedByOperatorId?: string | null;

  qualityGrade: QualityGrade; // A/B/C/D (per batch)
};

type EquipmentSnapshot = {
  equipmentId: string;
  equipmentType: "SHREDDER" | "DENSITY_SEPARATOR";
  name: string;
  manufacturer: string;
  capacityKgPerHour: number;

  state: EquipmentState;

  runtimeHoursTotal: number;
  runtimeMinutesToday?: number;
  runtimeMinutesCycle?: number;

  lastServiceAt?: string;

  energyKwhToday: number;

  outputKgShift?: number;
  outputKgToday?: number;
  outputKgBatch?: number;

  productionCycleId?: string;
  batchId?: string;
};

type DryingReusableLog = {
  pickupLiquidId: string;
  operatorId: string;
  lastPickedAt: string;
  state: EquipmentState;
  totalLiquidTakenLiters: number;

  humidityType: "RH" | "MOISTURE_CONTENT";
  humidityValue: number;
};

type ShiftLog = {
  shiftLogId: string;
  operator: OperatorShift;
  liquids: LiquidStockCheck[];
  shredder: EquipmentSnapshot;
  densitySeparator: EquipmentSnapshot;
  dryingReusable: DryingReusableLog;
};

// =====================
// UI Helpers (Web)
// =====================
function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function StateBadge({ state }: { state: EquipmentState }) {
  const variant =
    state === "RUNNING"
      ? "default"
      : state === "ERROR"
        ? "destructive"
        : "secondary";

  return (
    <Badge
      variant={variant as any}
      className="uppercase text-[10px] tracking-wide"
    >
      {state}
    </Badge>
  );
}

const fmtNum = (n: number, digits = 0) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);

const fmtLiters = (n: number) => `${fmtNum(n, 1)} L`;
const fmtKg = (n: number) => `${fmtNum(n, 1)} kg`;
const fmtKwh = (n: number) => `${fmtNum(n, 2)} kWh`;

// =====================
// DATA STATIS (sesuai keputusan final)
// =====================
const STATIC_SHIFT_LOG: ShiftLog = {
  shiftLogId: "SHIFT-2026-05-15-A",
  operator: {
    operatorId: "OP-001",
    fullName: "Operator Demo",
    shiftStartAt: "2026-05-15T08:00:00+07:00",
    shiftEndAt: "2026-05-15T16:00:00+07:00",
    tasks: [
      { title: "Cek volume ETHANOL (manual)", done: true },
      { title: "Monitoring shredder 2 jam", done: false, note: "Menunggu bahan masuk" },
      { title: "Kalibrasi sensor CaCl2", done: true },
    ],
    notes: "Catatan global shift: kondisi stabil, RH meningkat siang hari.",
  },
  liquids: [
    {
      liquidType: "ETHANOL",
      stockId: "STOCK-ETH-01",
      supplierBatchId: "BATCH-ETH-2026-05-10",
      volumeStartShiftLiters: 220,
      volumeBeforeLiters: 215,
      volumeAfterLiters: 214,
      lastRefillLiters: 50,
      lastRefillAt: "2026-05-15T07:30:00+07:00",
      checkMethod: "MANUAL",
      checkedAt: "2026-05-15T10:05:00+07:00",
      checkedByOperatorId: "OP-001",
      qualityGrade: "A",
    },
    {
      liquidType: "CACL2",
      stockId: "STOCK-CACL2-01",
      supplierBatchId: "BATCH-CACL2-2026-05-12",
      volumeStartShiftLiters: 180,
      volumeBeforeLiters: 178,
      volumeAfterLiters: 177.5,
      checkMethod: "SENSOR",
      checkedAt: "2026-05-15T11:20:00+07:00",
      checkedByOperatorId: null,
      qualityGrade: "B",
    },
    {
      liquidType: "CALCIUM_LIGNOSULFONATE",
      stockId: "STOCK-CLS-01",
      supplierBatchId: "BATCH-CLS-2026-05-09",
      volumeStartShiftLiters: 120,
      volumeBeforeLiters: 118,
      volumeAfterLiters: 118,
      checkMethod: "MANUAL",
      checkedAt: "2026-05-15T13:05:00+07:00",
      checkedByOperatorId: "OP-001",
      qualityGrade: "D",
    },
    {
      liquidType: "MIBC",
      stockId: "STOCK-MIBC-01",
      supplierBatchId: "BATCH-MIBC-2026-05-11",
      volumeStartShiftLiters: 90,
      volumeBeforeLiters: 89,
      volumeAfterLiters: 88.8,
      checkMethod: "MANUAL",
      checkedAt: "2026-05-15T14:10:00+07:00",
      checkedByOperatorId: "OP-001",
      qualityGrade: "A",
    },
  ],
  shredder: {
    equipmentId: "EQ-SHR-01",
    equipmentType: "SHREDDER",
    name: "Shredder A",
    manufacturer: "Pabrik X",
    capacityKgPerHour: 80,
    state: "RUNNING",
    runtimeHoursTotal: 1240.5,
    runtimeMinutesToday: 180,
    energyKwhToday: 38.2,
    outputKgShift: 210,
    outputKgToday: 310,
    productionCycleId: "CYCLE-2026-05-15-01",
    lastServiceAt: "2026-05-01T09:00:00+07:00",
  },
  densitySeparator: {
    equipmentId: "EQ-DEN-01",
    equipmentType: "DENSITY_SEPARATOR",
    name: "Density Separator 1",
    manufacturer: "Pabrik Y",
    capacityKgPerHour: 60,
    state: "IDLE",
    runtimeHoursTotal: 980.2,
    runtimeMinutesCycle: 45,
    energyKwhToday: 22.5,
    outputKgBatch: 96,
    batchId: "BATCH-PLASTIC-2026-05-15-01",
    productionCycleId: "CYCLE-2026-05-15-01",
    lastServiceAt: "2026-04-21T09:00:00+07:00",
  },
  dryingReusable: {
    pickupLiquidId: "PICK-0009",
    operatorId: "OP-001",
    lastPickedAt: "2026-05-15T14:40:00+07:00",
    state: "RUNNING",
    totalLiquidTakenLiters: 18,
    humidityType: "RH",
    humidityValue: 66,
  },
};

export default function PerformancePage() {
  const [exporting, setExporting] = useState(false);
  const data = STATIC_SHIFT_LOG;

  const totals = useMemo(() => {
    const totalStart = data.liquids.reduce((a, x) => a + x.volumeStartShiftLiters, 0);
    const totalBefore = data.liquids.reduce((a, x) => a + x.volumeBeforeLiters, 0);
    const totalAfter = data.liquids.reduce((a, x) => a + x.volumeAfterLiters, 0);
    const totalRefill = data.liquids.reduce((a, x) => a + (x.lastRefillLiters ?? 0), 0);

    const energyTodayTotal = (data.shredder.energyKwhToday ?? 0) + (data.densitySeparator.energyKwhToday ?? 0);

    const outShift =
      (data.shredder.outputKgShift ?? 0) + (data.densitySeparator.outputKgShift ?? 0);

    const outToday =
      (data.shredder.outputKgToday ?? 0) + (data.densitySeparator.outputKgToday ?? 0);

    const outBatch =
      (data.shredder.outputKgBatch ?? 0) + (data.densitySeparator.outputKgBatch ?? 0);

    return {
      totalStart,
      totalBefore,
      totalAfter,
      totalRefill,
      energyTodayTotal,
      outShift,
      outToday,
      outBatch,
    };
  }, [data]);

  const handleExportPdf = async () => {
    setExporting(true);

    try {
      // ✅ Landscape A4 agar tabel cairan tidak overflow
      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const M = { left: 40, right: 40, top: 56, bottom: 42 };

      const nowStr = new Date().toLocaleString("id-ID");

      const safe = (v: any) =>
        v === null || v === undefined || v === "" ? "-" : String(v);

      const fmtLit = (n: number) => `${fmtNum(n, 1)} L`;
      const fmtK = (n: number) => `${fmtNum(n, 1)} kg`;
      const fmtE = (n: number) => `${fmtNum(n, 2)} kWh`;

      // ---------- Header/Footer (untuk halaman 2 & 3) ----------
      const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Analisis Performa (Shift Log)", M.left, 28);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(90);
        doc.text(`ShiftLog: ${safe(data.shiftLogId)}`, M.left, 42);
        doc.text(`Diekspor: ${nowStr}`, pageW - M.right, 42, { align: "right" });
        doc.setTextColor(0);
      };

      const drawFooter = () => {
        const p = doc.getCurrentPageInfo().pageNumber;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text("ResinSep — Shift Performance Report", M.left, pageH - 18);
        doc.text(`Hal. ${p}/3`, pageW - M.right, pageH - 18, { align: "right" });
        doc.setTextColor(0);
      };

      // ---------- Helpers layout ----------
      const hLine = (y: number) => {
        doc.setDrawColor(220);
        doc.line(M.left, y, pageW - M.right, y);
      };

      const box = (x: number, y: number, w: number, h: number, title: string, lines: string[]) => {
        doc.setDrawColor(226);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, w, h, 10, 10, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(title, x + 12, y + 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60);
        const maxW = w - 24;
        let yy = y + 34;
        for (const l of lines) {
          const wrapped = doc.splitTextToSize(l, maxW);
          doc.text(wrapped, x + 12, yy);
          yy += wrapped.length * 11;
          if (yy > y + h - 10) break;
        }
        doc.setTextColor(0);
      };

      // =========================================================
      // PAGE 1/3 — COVER + RINGKASAN
      // =========================================================
      // Cover tidak pakai header standar (biar clean)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Laporan Performa Shift", M.left, 80);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(80);
      doc.text("Ringkasan Operasional, Cairan, dan Kondisi Alat", M.left, 104);
      doc.setTextColor(0);

      hLine(120);

      // Meta kanan
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`ShiftLog ID: ${safe(data.shiftLogId)}`, pageW - M.right, 86, { align: "right" });
      doc.text(`Diekspor: ${nowStr}`, pageW - M.right, 106, { align: "right" });
      doc.setTextColor(0);

      // KPI cards (2 kolom x 2 baris)
      const gap = 16;
      const colW = (pageW - M.left - M.right - gap) / 2;
      const cardH = 140;
      let y = 150;

      box(
        M.left,
        y,
        colW,
        cardH,
        "Operator & Shift",
        [
          `Operator ID: ${safe(data.operator.operatorId)}`,
          `Nama: ${safe(data.operator.fullName)}`,
          `Mulai: ${safe(data.operator.shiftStartAt)}`,
          `Selesai: ${safe(data.operator.shiftEndAt)}`,
        ]
      );

      box(
        M.left + colW + gap,
        y,
        colW,
        cardH,
        "Ringkasan Cairan",
        [
          `Total Awal Shift: ${fmtLit(totals.totalStart)}`,
          `Total Sebelum Cek: ${fmtLit(totals.totalBefore)}`,
          `Total Setelah Cek: ${fmtLit(totals.totalAfter)}`,
          `Total Refill: ${fmtLit(totals.totalRefill)}`,
        ]
      );

      y += cardH + gap;

      box(
        M.left,
        y,
        colW,
        cardH,
        "Kinerja Alat (Hari Ini)",
        [
          `Energy Today (Total): ${fmtE(totals.energyTodayTotal)}`,
          `Output Shift (Total): ${totals.outShift ? fmtK(totals.outShift) : "-"}`,
          `Output Today (Total): ${totals.outToday ? fmtK(totals.outToday) : "-"}`,
          `Output Batch (Total): ${totals.outBatch ? fmtK(totals.outBatch) : "-"}`,
        ]
      );

      const humidityText =
        data.dryingReusable.humidityType === "RH"
          ? `${safe(data.dryingReusable.humidityValue)}% RH`
          : `${safe(data.dryingReusable.humidityValue)}% (Moisture)`;

      box(
        M.left + colW + gap,
        y,
        colW,
        cardH,
        "Pengeringan & Reusable",
        [
          `Pickup ID: ${safe(data.dryingReusable.pickupLiquidId)}`,
          `Operator ID: ${safe(data.dryingReusable.operatorId)}`,
          `Terakhir Diambil: ${safe(data.dryingReusable.lastPickedAt)}`,
          `State: ${safe(data.dryingReusable.state)}`,
          `Cairan Diambil: ${fmtLit(data.dryingReusable.totalLiquidTakenLiters)}`,
          `Kelembapan: ${humidityText}`,
        ]
      );

      // Catatan global ringkas di bawah
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Catatan Global:", M.left, pageH - 70);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60);
      const notesWrapped = doc.splitTextToSize(safe(data.operator.notes), pageW - M.left - M.right);
      doc.text(notesWrapped, M.left, pageH - 54);
      doc.setTextColor(0);

      // Footer cover
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text("ResinSep — Shift Performance Report", M.left, pageH - 18);
      doc.text("Hal. 1/3", pageW - M.right, pageH - 18, { align: "right" });
      doc.setTextColor(0);

      // =========================================================
      // PAGE 2/3 — TABEL CAIRAN (FULL)
      // =========================================================
      doc.addPage();
      drawHeader();

      let y2 = M.top;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Detail Cairan (Per Batch Supplier)", M.left, y2);
      y2 += 10;
      hLine(y2);
      y2 += 14;

      autoTable(doc, {
        startY: y2,
        margin: M,
        theme: "grid",
        head: [[
          "Cairan",
          "Stock",
          "Batch Supplier",
          "Awal Shift (L)",
          "Before (L)",
          "After (L)",
          "Refill (L)",
          "Metode",
          "Waktu Cek",
          "Checked By",
          "Grade",
        ]],
        body: data.liquids.map((l) => [
          safe(l.liquidType),
          safe(l.stockId),
          safe(l.supplierBatchId),
          fmtNum(l.volumeStartShiftLiters, 1),
          fmtNum(l.volumeBeforeLiters, 1),
          fmtNum(l.volumeAfterLiters, 1),
          l.lastRefillLiters !== undefined ? fmtNum(l.lastRefillLiters, 1) : "-",
          safe(l.checkMethod),
          safe(l.checkedAt),
          safe(l.checkedByOperatorId ?? "-"),
          safe(l.qualityGrade),
        ]),
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 4,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        // kunci anti-overflow: fixed widths
        columnStyles: {
          0: { cellWidth: 62 },
          1: { cellWidth: 78 },
          2: { cellWidth: 170 }, // batch panjang -> wrap
          3: { cellWidth: 55, halign: "right" },
          4: { cellWidth: 55, halign: "right" },
          5: { cellWidth: 55, halign: "right" },
          6: { cellWidth: 55, halign: "right" },
          7: { cellWidth: 58 },
          8: { cellWidth: 125 }, // timestamp -> wrap
          9: { cellWidth: 70 },
          10: { cellWidth: 50, halign: "center" },
        },
        didDrawPage: () => {
          drawHeader();
          drawFooter();
        },
      });

      // footer page 2 (jaga kalau autoTable tidak memanggil didDrawPage saat kecil)
      drawFooter();

      // =========================================================
      // PAGE 3/3 — TASKS + EQUIPMENT + DRYING
      // =========================================================
      doc.addPage();
      drawHeader();

      let y3 = M.top;

      // --- Tasks ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Task Hari Ini", M.left, y3);
      y3 += 10;
      hLine(y3);
      y3 += 14;

      autoTable(doc, {
        startY: y3,
        margin: M,
        theme: "grid",
        head: [["No", "Task", "Status", "Catatan"]],
        body: data.operator.tasks.map((t, i) => [
          String(i + 1),
          safe(t.title),
          t.done ? "Selesai" : "Belum",
          safe(t.note ?? "-"),
        ]),
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 5,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 30, halign: "right" },
          1: { cellWidth: 340 },
          2: { cellWidth: 80 },
          3: { cellWidth: 240 },
        },
        didDrawPage: () => {
          drawHeader();
          drawFooter();
        },
      });

      y3 = ((doc as any).lastAutoTable?.finalY ?? y3) + 16;

      // --- Equipment Shredder & Density (dua tabel key-value) ---
      const equipToBody = (e: EquipmentSnapshot) => {
        return [
          ["Equipment ID", safe(e.equipmentId)],
          ["Nama", safe(e.name)],
          ["Pabrik", safe(e.manufacturer)],
          ["Kapasitas", `${safe(e.capacityKgPerHour)} kg/jam`],
          ["State", safe(e.state)],
          ["Hour Meter (Total)", `${fmtNum(e.runtimeHoursTotal, 1)} jam`],
          ["Runtime Today", e.runtimeMinutesToday !== undefined ? `${e.runtimeMinutesToday} menit` : "-"],
          ["Runtime Cycle", e.runtimeMinutesCycle !== undefined ? `${e.runtimeMinutesCycle} menit` : "-"],
          ["Energy Today", fmtE(e.energyKwhToday)],
          ["Output Shift", e.outputKgShift !== undefined ? fmtK(e.outputKgShift) : "-"],
          ["Output Today", e.outputKgToday !== undefined ? fmtK(e.outputKgToday) : "-"],
          ["Output Batch", e.outputKgBatch !== undefined ? fmtK(e.outputKgBatch) : "-"],
          ["Batch ID", safe(e.batchId ?? "-")],
          ["Production Cycle ID", safe(e.productionCycleId ?? "-")],
          ["Terakhir Servis", safe(e.lastServiceAt ?? "-")],
        ];
      };

      autoTable(doc, {
        startY: y3,
        margin: M,
        theme: "grid",
        head: [["Shredder", "Nilai"]],
        body: equipToBody(data.shredder),
        styles: { font: "helvetica", fontSize: 9, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 200 },
          1: { cellWidth: pageW - M.left - M.right - 200 },
        },
        didDrawPage: () => {
          drawHeader();
          drawFooter();
        },
      });

      y3 = ((doc as any).lastAutoTable?.finalY ?? y3) + 12;

      autoTable(doc, {
        startY: y3,
        margin: M,
        theme: "grid",
        head: [["Density Separator", "Nilai"]],
        body: equipToBody(data.densitySeparator),
        styles: { font: "helvetica", fontSize: 9, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 200 },
          1: { cellWidth: pageW - M.left - M.right - 200 },
        },
        didDrawPage: () => {
          drawHeader();
          drawFooter();
        },
      });

      y3 = ((doc as any).lastAutoTable?.finalY ?? y3) + 12;

      // --- Drying & Reusable ---
      autoTable(doc, {
        startY: y3,
        margin: M,
        theme: "grid",
        head: [["Pengeringan & Reusable Cairan", "Nilai"]],
        body: [
          ["Pickup Liquid ID", safe(data.dryingReusable.pickupLiquidId)],
          ["Operator ID", safe(data.dryingReusable.operatorId)],
          ["Terakhir Diambil", safe(data.dryingReusable.lastPickedAt)],
          ["State", safe(data.dryingReusable.state)],
          ["Total Cairan Diambil", fmtLit(data.dryingReusable.totalLiquidTakenLiters)],
          ["Kondisi Kelembapan", humidityText],
        ],
        styles: { font: "helvetica", fontSize: 9, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 200 },
          1: { cellWidth: pageW - M.left - M.right - 200 },
        },
        didDrawPage: () => {
          drawHeader();
          drawFooter();
        },
      });

      drawFooter();

      // ✅ Save
      doc.save(`shift-${safe(data.shiftLogId)}.pdf`);
    } catch (err) {
      console.error("Gagal ekspor PDF:", err);
      alert("Gagal mengekspor PDF. Coba lagi.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Header Web */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-xl font-bold text-foreground">
          Analisis Performa (Shift)
        </h1>

        <span className="font-mono text-xs text-primary bg-accent px-3 py-1 rounded-md">
          {data.shiftLogId}
        </span>

        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Mengekspor...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                Export PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Operator + Ringkasan Cairan */}
      <div className="grid grid-cols-2 gap-3.5 mb-3.5">
        <Card>
          <CardHeader>
            <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Informasi Operator (Shift)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Operator ID" value={data.operator.operatorId} mono />
            <InfoRow label="Nama Lengkap" value={data.operator.fullName} />
            <InfoRow label="Mulai Shift" value={data.operator.shiftStartAt} mono />
            <InfoRow label="Selesai Shift" value={data.operator.shiftEndAt} mono />
            <InfoRow label="Catatan Global" value={data.operator.notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ringkasan Cairan (Liter)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Total Awal Shift" value={fmtLiters(totals.totalStart)} />
            <InfoRow label="Total Sebelum Cek" value={fmtLiters(totals.totalBefore)} />
            <InfoRow label="Total Setelah Cek" value={fmtLiters(totals.totalAfter)} />
            <InfoRow label="Total Refill" value={fmtLiters(totals.totalRefill)} />
          </CardContent>
        </Card>
      </div>

      {/* Tasks */}
      <Card className="mb-3.5 overflow-hidden">
        <CardHeader className="border-b border-border py-3.5">
          <CardTitle>Task Hari Ini (List)</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              {["No", "Task", "Status", "Catatan"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.operator.tasks.map((t, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{i + 1}</TableCell>
                <TableCell className="text-sm">{t.title}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant={(t.done ? "default" : "secondary") as any}>
                    {t.done ? "Selesai" : "Belum"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.note ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Liquids */}
      <Card className="mb-3.5 overflow-hidden">
        <CardHeader className="border-b border-border py-3.5">
          <CardTitle>Informasi Cairan (Per Batch Supplier)</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Cairan",
                "Stock ID",
                "Supplier Batch",
                "Awal Shift",
                "Before",
                "After",
                "Refill",
                "Metode",
                "Waktu Cek",
                "Checked By",
                "Grade",
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.liquids.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="font-semibold text-sm text-primary">
                  {l.liquidType}
                </TableCell>
                <TableCell className="font-mono text-[11px]">{l.stockId}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">
                  {l.supplierBatchId}
                </TableCell>
                <TableCell className="font-mono text-sm">{fmtLiters(l.volumeStartShiftLiters)}</TableCell>
                <TableCell className="font-mono text-sm">{fmtLiters(l.volumeBeforeLiters)}</TableCell>
                <TableCell className="font-mono text-sm">{fmtLiters(l.volumeAfterLiters)}</TableCell>
                <TableCell className="font-mono text-sm">
                  {l.lastRefillLiters !== undefined ? fmtLiters(l.lastRefillLiters) : "-"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      (l.checkMethod === "SENSOR" ? "secondary" : "outline") as any
                    }
                  >
                    {l.checkMethod}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[11px]">{l.checkedAt}</TableCell>
                <TableCell className="font-mono text-[11px]">
                  {l.checkedByOperatorId ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {l.qualityGrade}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Equipment */}
      <div className="grid grid-cols-2 gap-3.5 mb-3.5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Shredder</CardTitle>
            <StateBadge state={data.shredder.state} />
          </CardHeader>
          <CardContent>
            <InfoRow label="Equipment ID" value={data.shredder.equipmentId} mono />
            <InfoRow label="Nama" value={data.shredder.name} />
            <InfoRow label="Pabrik" value={data.shredder.manufacturer} />
            <InfoRow label="Kapasitas" value={`${data.shredder.capacityKgPerHour} kg/jam`} />
            <InfoRow label="Hour Meter (Total)" value={`${fmtNum(data.shredder.runtimeHoursTotal, 1)} jam`} />
            <InfoRow
              label="Runtime Today"
              value={data.shredder.runtimeMinutesToday !== undefined ? `${data.shredder.runtimeMinutesToday} menit` : "-"}
            />
            <InfoRow label="Energy Today" value={fmtKwh(data.shredder.energyKwhToday)} />
            <InfoRow label="Output Shift" value={data.shredder.outputKgShift !== undefined ? fmtKg(data.shredder.outputKgShift) : "-"} />
            <InfoRow label="Output Today" value={data.shredder.outputKgToday !== undefined ? fmtKg(data.shredder.outputKgToday) : "-"} />
            <InfoRow label="Production Cycle ID" value={data.shredder.productionCycleId ?? "-"} mono />
            <InfoRow label="Terakhir Servis" value={data.shredder.lastServiceAt ?? "-"} mono />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Density Separator</CardTitle>
            <StateBadge state={data.densitySeparator.state} />
          </CardHeader>
          <CardContent>
            <InfoRow label="Equipment ID" value={data.densitySeparator.equipmentId} mono />
            <InfoRow label="Nama" value={data.densitySeparator.name} />
            <InfoRow label="Pabrik" value={data.densitySeparator.manufacturer} />
            <InfoRow label="Kapasitas" value={`${data.densitySeparator.capacityKgPerHour} kg/jam`} />
            <InfoRow label="Hour Meter (Total)" value={`${fmtNum(data.densitySeparator.runtimeHoursTotal, 1)} jam`} />
            <InfoRow
              label="Runtime Cycle"
              value={data.densitySeparator.runtimeMinutesCycle !== undefined ? `${data.densitySeparator.runtimeMinutesCycle} menit` : "-"}
            />
            <InfoRow label="Energy Today" value={fmtKwh(data.densitySeparator.energyKwhToday)} />
            <InfoRow label="Output Batch" value={data.densitySeparator.outputKgBatch !== undefined ? fmtKg(data.densitySeparator.outputKgBatch) : "-"} />
            <InfoRow label="Batch ID" value={data.densitySeparator.batchId ?? "-"} mono />
            <InfoRow label="Production Cycle ID" value={data.densitySeparator.productionCycleId ?? "-"} mono />
            <InfoRow label="Terakhir Servis" value={data.densitySeparator.lastServiceAt ?? "-"} mono />
          </CardContent>
        </Card>
      </div>

      {/* Drying & Reusable */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border py-3.5 flex flex-row items-center justify-between">
          <CardTitle>Pengeringan & Reusable Cairan</CardTitle>
          <StateBadge state={data.dryingReusable.state} />
        </CardHeader>
        <CardContent>
          <InfoRow label="Pickup Liquid ID" value={data.dryingReusable.pickupLiquidId} mono />
          <InfoRow label="Operator ID" value={data.dryingReusable.operatorId} mono />
          <InfoRow label="Terakhir Diambil" value={data.dryingReusable.lastPickedAt} mono />
          <InfoRow label="Total Cairan Diambil" value={fmtLiters(data.dryingReusable.totalLiquidTakenLiters)} />
          <InfoRow
            label="Kondisi Kelembapan"
            value={
              data.dryingReusable.humidityType === "RH"
                ? `${data.dryingReusable.humidityValue}% RH`
                : `${data.dryingReusable.humidityValue}% (Moisture)`
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}