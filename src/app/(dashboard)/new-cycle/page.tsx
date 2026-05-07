"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { addCycle, getCycles, genCycleId } from "@/lib/firestore";
import {
  SUPPLIERS,
  RESIN_TYPES,
  STAGES_META,
  PRICE_REF,
  type ResinGrade,
  type Stage,
} from "@/types";
import { fmtRp } from "@/lib/utils";
import { TopBar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Derived resin type from stage data
interface DerivedResin {
  type: string;
  kg: number;
  grade: ResinGrade;
  source: string; // human-readable source description
}

// Derive output resins automatically from stage data:
// Tahap 2 sink → HDPE
// Tahap 3 float → PP
// Tahap 3 sink  → LDPE
// Tahap 4 float → (PS/ABS tidak dimonetisasi, diabaikan)
// Tahap 5 float → PET
// Tahap 5 sink  → PVC
function deriveResins(stages: Stage[]): Omit<DerivedResin, "grade">[] {
  const [, s2, s3, , s5] = stages;
  const results: Omit<DerivedResin, "grade">[] = [];

  if (s2.sinkKg > 0) results.push({ type: "HDPE", kg: s2.sinkKg, source: "Tahap 2 – tenggelam" });
  if (s3.floatKg > 0) results.push({ type: "PP", kg: s3.floatKg, source: "Tahap 3 – apung" });
  if (s3.sinkKg > 0) results.push({ type: "LDPE", kg: s3.sinkKg, source: "Tahap 3 – tenggelam" });
  if (s5.floatKg > 0) results.push({ type: "PET", kg: s5.floatKg, source: "Tahap 5 – apung" });
  if (s5.sinkKg > 0) results.push({ type: "PVC", kg: s5.sinkKg, source: "Tahap 5 – tenggelam" });

  return results;
}

const STEP_LABELS = ["Input dan Sumber", "Monitor Proses", "Output dan Grading"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-7">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const done = current > step;
        const active = current === step;
        return (
          <div key={label} className="flex items-center" style={{ flex: i < STEP_LABELS.length - 1 ? 1 : "auto" }}>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-border text-muted-foreground"
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : step}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 transition-colors ${
                  done ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const GRADE_STYLES: Record<ResinGrade, { bg: string; color: string }> = {
  A: { bg: "#D4F0E0", color: "#1A6B3A" },
  B: { bg: "#FFF0D4", color: "#9A6000" },
  C: { bg: "#FCE4E4", color: "#B33A3A" },
};

export default function NewCyclePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [supplier, setSupplier] = useState("");
  const [inputKg, setInputKg] = useState("");
  const [selectedResins, setSelectedResins] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [cycleId] = useState(() => {
    const d = new Date();
    const key = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `RSP-${key}-001`;
  });

  const [stageData, setStageData] = useState<Stage[]>(
    STAGES_META.map(() => ({ dur: 0, floatKg: 0, sinkKg: 0 }))
  );

  // Grade per derived resin type (keyed by type string)
  const [resinGrades, setResinGrades] = useState<Record<string, ResinGrade>>({});

  const [saving, setSaving] = useState(false);

  const toggleResin = (r: string) =>
    setSelectedResins((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );

  const updateStage = (i: number, key: keyof Stage, val: string) => {
    setStageData((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: parseFloat(val) || 0 };
      return next;
    });
  };

  const derivedResins = useMemo(() => deriveResins(stageData), [stageData]);

  const outputResins: DerivedResin[] = derivedResins.map((r) => ({
    ...r,
    grade: resinGrades[r.type] ?? "A",
  }));

  const totalOutput = outputResins.reduce((s, r) => s + r.kg, 0);

  const monetisedKg = outputResins.reduce(
    (s, r) => s + (PRICE_REF[r.type] ? r.kg : 0),
    0
  );
  const monetisedPct = totalOutput > 0 ? ((monetisedKg / totalOutput) * 100).toFixed(1) : "0.0";

  const estRev = outputResins.reduce(
    (s, r) => s + r.kg * (PRICE_REF[r.type] || 0),
    0
  );

  const handleSave = async () => {
    if (!user) return;
    if (outputResins.length === 0) {
      toast.error("Belum ada output resin yang terdeteksi. Isi data tahap terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      const existingCycles = await getCycles(user.uid);
      const id = genCycleId(existingCycles.map((c) => c.id));
      const duration = stageData.reduce((s, d) => s + d.dur, 0);
      const outputKg = totalOutput;
      const ts = new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      await addCycle(user.uid, {
        id,
        ts,
        supplier,
        inputKg: parseFloat(inputKg),
        outputKg,
        duration,
        notes,
        resins: outputResins.map((r) => ({
          type: r.type,
          kg: r.kg,
          grade: r.grade,
        })),
        stages: stageData,
      });

      toast.success("Siklus berhasil disimpan");
      router.push("/cycles");
    } catch {
      toast.error("Gagal menyimpan siklus");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <TopBar title="Siklus Baru" sub="Log batch separasi resin baru" />
      <StepIndicator current={step} />

      {step === 1 && (
        <div className="grid grid-cols-[1fr_280px] gap-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1.5">CYCLE ID (otomatis)</p>
                <span className="inline-block font-mono text-sm font-semibold text-primary bg-accent px-3 py-1.5 rounded-md">
                  {cycleId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Sumber / Supplier *</Label>
                  <Select value={supplier} onValueChange={setSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih sumber..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIERS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Berat Input (kg) *</Label>
                  <Input
                    type="number"
                    value={inputKg}
                    onChange={(e) => setInputKg(e.target.value)}
                    placeholder="contoh: 150"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Jenis Plastik Diketahui (opsional)</Label>
                <div className="flex flex-wrap gap-2">
                  {[...RESIN_TYPES, "Campuran"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleResin(r)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedResins.includes(r)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:bg-accent"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Catatan (opsional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kondisi khusus, anomali, dsb..."
                  rows={3}
                />
              </div>

              <Button
                onClick={() => {
                  if (!supplier || !inputKg) {
                    toast.error("Lengkapi sumber dan berat input");
                    return;
                  }
                  setStep(2);
                }}
              >
                Mulai Siklus
              </Button>
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle>Yang Akan Direkam</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                ["Cycle ID", cycleId, true],
                ["Sumber", supplier || "-", false],
                ["Berat Input", inputKg ? inputKg + " kg" : "-", false],
                ["Operator", user?.displayName ?? user?.email ?? "Operator", false],
              ].map(([k, v, mono]) => (
                <div
                  key={String(k)}
                  className="flex justify-between py-2 border-b border-border last:border-0 text-sm"
                >
                  <span className="text-muted-foreground">{String(k)}</span>
                  <span className={mono ? "font-mono text-[10px] text-foreground font-medium" : "font-medium"}>
                    {String(v)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
            {STAGES_META.map((s, i) => (
              <Card
                key={i}
                className="min-w-[190px] flex-1 border-t-2"
                style={{ borderTopColor: "var(--primary)" }}
              >
                <CardContent className="pt-4 pb-4">
                  <p className="text-[10px] font-bold text-primary mb-0.5">{s.label}</p>
                  <p className="text-sm font-semibold mb-0.5">{s.medium}</p>
                  <p className="text-[10px] text-muted-foreground mb-2">rho = {s.density}</p>
                  <div className="text-[10px] mb-3">
                    <p className="text-primary mb-0.5">Apung: {s.float}</p>
                    <p className="text-destructive">Tenggelam: {s.sink}</p>
                  </div>
                  {(
                    [
                      ["Durasi (mnt)", "dur"],
                      ["Fraksi Apung (kg)", "floatKg"],
                      ["Fraksi Tenggelam (kg)", "sinkKg"],
                    ] as [string, keyof Stage][]
                  ).map(([lbl, key]) => (
                    <div key={key} className="mb-2">
                      <p className="text-[9px] text-muted-foreground mb-1">{lbl}</p>
                      <Input
                        type="number"
                        value={stageData[i][key] || ""}
                        onChange={(e) => updateStage(i, key, e.target.value)}
                        placeholder="0"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <Button onClick={() => setStep(3)}>Selesaikan Proses - Input Output</Button>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-[1fr_260px] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Output Resin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {outputResins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Tidak ada output terdeteksi. Kembali ke Tahap 2 dan isi berat fraksi apung/tenggelam.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_100px_120px_140px] gap-3 px-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Jenis Resin</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Berat (kg)</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Grade</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sumber Tahap</p>
                  </div>

                  {outputResins.map((r, i) => {
                    const grade = r.grade;
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_100px_120px_140px] gap-3 items-center py-2.5 px-3 rounded-lg bg-accent/50 border border-border"
                      >
                        {/* Resin type badge */}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{r.type}</span>
                        </div>

                        {/* Weight - read-only from stage data */}
                        <p className="font-mono text-sm font-bold text-foreground">{r.kg} kg</p>

                        {/* Grade selector */}
                        <div className="flex gap-1">
                          {(["A", "B", "C"] as ResinGrade[]).map((g) => {
                            const s = GRADE_STYLES[g];
                            const active = grade === g;
                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() =>
                                  setResinGrades((prev) => ({ ...prev, [r.type]: g }))
                                }
                                className="h-8 w-8 rounded-md text-xs font-bold border transition-all"
                                style={
                                  active
                                    ? { background: s.bg, color: s.color, borderColor: s.color }
                                    : {}
                                }
                              >
                                {g}
                              </button>
                            );
                          })}
                        </div>

                        {/* Source label */}
                        <p className="text-[10px] text-muted-foreground">{r.source}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Summary */}
              <div className="mt-3 p-4 bg-accent rounded-lg grid grid-cols-3 gap-4">
                {[
                  ["Total Output", `${totalOutput} kg`],
                  ["% Dimonetisasi", `${monetisedPct}%`],
                  ["Est. Pendapatan", fmtRp(estRev)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">{k}</p>
                    <p className="font-mono font-bold text-primary text-sm">{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground -mt-1">
                * Harga akan disesuaikan dengan harga pasaran yang dapat diupdate.
              </p>

              <div className="pt-2">
                <Button onClick={handleSave} disabled={saving || outputResins.length === 0}>
                  {saving ? "Menyimpan..." : "Simpan dan Buat Laporan"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle>Panduan Grade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                {
                  g: "A",
                  desc: "Bersih, kontaminasi minimal, siap jual ke pabrik premium",
                  bg: "#D4F0E0",
                  color: "#1A6B3A",
                },
                {
                  g: "B",
                  desc: "Kontaminasi ringan, dapat dijual ke agregator",
                  bg: "#FFF0D4",
                  color: "#9A6000",
                },
                {
                  g: "C",
                  desc: "Campuran atau terdegradasi, nilai jual rendah, perlu sortir ulang",
                  bg: "#FCE4E4",
                  color: "#B33A3A",
                },
              ].map(({ g, desc, bg, color }) => (
                <div key={g} className="rounded-lg p-3" style={{ background: bg }}>
                  <p className="font-bold text-xs mb-0.5" style={{ color }}>
                    Grade {g}
                  </p>
                  <p className="text-[11px]" style={{ color, opacity: 0.8 }}>
                    {desc}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
