"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getCycle } from "@/lib/firestore";
import type { Cycle } from "@/types";
import {
  revenue,
  recovery,
  STAGES_META,
  RESIN_COLORS,
  PRICE_REF,
} from "@/types";
import { fmtRp } from "@/lib/utils";
import { GradeBadge } from "@/components/grade-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    setLoading(true);
    getCycle(user.uid, id)
      .then(setCycle)
      .finally(() => setLoading(false));
  }, [user, id]);

  const rev = useMemo(() => (cycle ? revenue(cycle) : 0), [cycle]);
  const operatorName = useMemo(
    () => user?.displayName ?? user?.email ?? "Operator",
    [user],
  );

  const handleExportPdf = async () => {
    if (!cycle) return;

    setExporting(true);
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const autoTable =
        (autoTableMod as any).default ||
        (autoTableMod as any).autoTable ||
        null;

      const doc = new jsPDF({ unit: "pt", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const marginX = 40;
      let y = 44;

      const safe = (v: any) =>
        v === null || v === undefined || v === "" ? "-" : String(v);

      const hLine = (yy: number) => {
        doc.setDrawColor(220);
        doc.line(marginX, yy, pageW - marginX, yy);
      };

      const sectionTitle = (title: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(title, marginX, y);
        y += 10;
        hLine(y);
        y += 16;
      };

      const kv = (label: string, value: string) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(label, marginX, y);
        doc.setFont("helvetica", "bold");
        doc.text(value, pageW - marginX, y, { align: "right" });
        y += 16;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Detail Siklus", marginX, y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Cycle ID: ${safe(cycle.id)}`, pageW - marginX, y, {
        align: "right",
      });
      y += 18;

      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(`Diekspor: ${new Date().toLocaleString("id-ID")}`, marginX, y);
      doc.setTextColor(0);
      y += 18;

      hLine(y);
      y += 18;

      sectionTitle("Informasi Batch");
      kv("Cycle ID", safe(cycle.id));
      kv("Waktu", safe(cycle.ts));
      kv("Sumber", safe(cycle.supplier));
      kv("Operator", safe(operatorName));
      kv("Catatan", safe(cycle.notes || "Tidak ada catatan"));

      y += 8;

      sectionTitle("Ringkasan Proses");
      kv("Berat Input", `${safe(cycle.inputKg)} kg`);
      kv("Berat Output", `${safe(cycle.outputKg)} kg`);
      kv("Recovery Rate", `${recovery(cycle)}%`);
      kv("Total Durasi", `${safe(cycle.duration)} menit`);
      kv("Est. Pendapatan", fmtRp(rev));

      y += 8;

      if (cycle.stages?.length > 0) {
        sectionTitle("Log Per Tahap Separasi");

        const head = [
          [
            "Tahap",
            "Medium",
            "Densitas",
            "Durasi (mnt)",
            "Apung (kg)",
            "Tenggelam (kg)",
          ],
        ];

        const body = cycle.stages.map((s, i) => [
          safe(STAGES_META[i]?.label ?? `Tahap ${i + 1}`),
          safe(STAGES_META[i]?.medium ?? "-"),
          safe(STAGES_META[i]?.density ?? "-"),
          safe(s.dur),
          safe(s.floatKg),
          safe(s.sinkKg),
        ]);

        const options = {
          startY: y,
          head,
          body,
          theme: "grid",
          styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
          headStyles: { fillColor: [30, 41, 59], textColor: 255 },
          columnStyles: {
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
          },
          margin: { left: marginX, right: marginX },
        };

        if (typeof autoTable === "function") {
          autoTable(doc, options);
        } else {
          (doc as any).autoTable(options);
        }

        y = ((doc as any).lastAutoTable?.finalY ?? y) + 18;
      }

      sectionTitle("Output Resin dan Estimasi Nilai");

      const resinHead = [
        ["Jenis Resin", "Berat (kg)", "Grade", "Harga Ref./kg", "Est. Nilai"],
      ];
      const resinBody = cycle.resins.map((r) => {
        const price = PRICE_REF[r.type] || 0;
        const est = (r.kg || 0) * price;
        return [
          safe(r.type),
          safe(r.kg),
          safe(r.grade),
          fmtRp(price),
          fmtRp(est),
        ];
      });

      const resinOptions = {
        startY: y,
        head: resinHead,
        body: resinBody,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        columnStyles: {
          1: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
        },
        margin: { left: marginX, right: marginX },
      };

      if (typeof autoTable === "function") {
        autoTable(doc, resinOptions);
      } else {
        (doc as any).autoTable(resinOptions);
      }

      y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Total Estimasi Pendapatan", marginX, y);
      doc.text(fmtRp(rev), pageW - marginX, y, { align: "right" });
      y += 16;

      // Footer kecil
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        "ResinSep — Cycle Report",
        marginX,
        doc.internal.pageSize.getHeight() - 24,
      );
      doc.setTextColor(0);

      const filename = `cycle-${safe(cycle.id)}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("Gagal ekspor PDF:", err);
      alert("Gagal mengekspor PDF. Coba lagi.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Memuat detail siklus...
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Siklus tidak ditemukan</p>
        <Button variant="outline" onClick={() => router.back()}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>

        <h1 className="text-xl font-bold text-foreground">Detail Siklus</h1>

        <span className="font-mono text-xs text-primary bg-accent px-3 py-1 rounded-md">
          {cycle.id}
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

      <div className="grid grid-cols-2 gap-3.5 mb-3.5">
        <Card>
          <CardHeader>
            <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Informasi Batch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Cycle ID" value={cycle.id} mono />
            <InfoRow label="Waktu" value={cycle.ts} />
            <InfoRow label="Sumber" value={cycle.supplier} />
            <InfoRow label="Operator" value={operatorName} />
            <InfoRow
              label="Catatan"
              value={cycle.notes || "Tidak ada catatan"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ringkasan Proses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Berat Input" value={`${cycle.inputKg} kg`} />
            <InfoRow label="Berat Output" value={`${cycle.outputKg} kg`} />
            <InfoRow label="Recovery Rate" value={`${recovery(cycle)}%`} />
            <InfoRow label="Total Durasi" value={`${cycle.duration} menit`} />
            <InfoRow label="Est. Pendapatan" value={fmtRp(rev)} />
          </CardContent>
        </Card>
      </div>

      {cycle.stages?.length > 0 && (
        <Card className="mb-3.5 overflow-hidden">
          <CardHeader className="border-b border-border py-3.5">
            <CardTitle>Log Per Tahap Separasi</CardTitle>
          </CardHeader>

          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Tahap",
                  "Medium",
                  "Densitas",
                  "Durasi",
                  "Fraksi Apung (kg)",
                  "Fraksi Tenggelam (kg)",
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {cycle.stages.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold text-sm text-primary">
                    {STAGES_META[i]?.label}
                  </TableCell>
                  <TableCell className="text-sm">
                    {STAGES_META[i]?.medium}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {STAGES_META[i]?.density}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {s.dur} mnt
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {s.floatKg} kg
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {s.sinkKg} kg
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border py-3.5">
          <CardTitle>Output Resin dan Estimasi Nilai</CardTitle>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Jenis Resin",
                "Berat (kg)",
                "Grade",
                "Harga Ref./kg",
                "Est. Nilai",
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {cycle.resins.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      background: (RESIN_COLORS[r.type] || "#ccc") + "22",
                      color: RESIN_COLORS[r.type] || "#666",
                    }}
                  >
                    {r.type}
                  </span>
                </TableCell>

                <TableCell className="font-mono text-sm">{r.kg} kg</TableCell>
                <TableCell>
                  <GradeBadge grade={r.grade} />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {fmtRp(PRICE_REF[r.type] || 0)}
                </TableCell>
                <TableCell className="font-mono text-sm text-primary font-semibold">
                  {fmtRp(r.kg * (PRICE_REF[r.type] || 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-bold text-sm">
                Total Estimasi Pendapatan
              </TableCell>
              <TableCell className="font-mono text-sm font-bold text-primary">
                {fmtRp(rev)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
    </div>
  );
}
