export type ResinGrade = "A" | "B" | "C";

export interface Resin {
  type: string;
  kg: number;
  grade: ResinGrade;
}

export interface Stage {
  dur: number;
  floatKg: number;
  sinkKg: number;
}

export interface Cycle {
  id: string;
  firestoreId?: string;
  ts: string;
  supplier: string;
  inputKg: number;
  outputKg: number;
  duration: number;
  notes: string;
  resins: Resin[];
  stages: Stage[];
  userId: string;
  createdAt?: number;
  isDraft?: boolean;
}

export const RESIN_COLORS: Record<string, string> = {
  PET: "#1E7A4A",
  PP: "#34A85A",
  HDPE: "#5DB87A",
  LDPE: "#8DCFA0",
  PS: "#E09B2D",
  PVC: "#D94F4F",
  ABS: "#9B6EBF",
};

export const PRICE_REF: Record<string, number> = {
  PET: 13500,
  PP: 9000,
  HDPE: 8500,
  LDPE: 6000,
  PS: 5500,
  PVC: 3000,
  ABS: 7000,
};

export const SUPPLIERS = [
  "TPS3R Keputih",
  "TPS3R Jambangan",
  "Bank Sampah RW 05",
  "Bank Sampah Merdeka",
  "Supplier Mandiri Rungkut",
  "TPS3R Wonokromo",
];

export const RESIN_TYPES = ["PET", "PP", "HDPE", "LDPE", "PS", "PVC", "ABS"];

export const STAGES_META = [
  {
    label: "Tahap 1",
    medium: "Air (H2O)",
    density: "1.00 g/cm3",
    float: "PP, HDPE, LDPE",
    sink: "PET, PVC, ABS",
  },
  {
    label: "Tahap 2",
    medium: "Etanol 31% v/v",
    density: "0.95 g/cm3",
    float: "PP, LDPE",
    sink: "HDPE",
  },
  {
    label: "Tahap 3",
    medium: "Etanol 48-51% v/v",
    density: "0.91-0.92 g/cm3",
    float: "PP",
    sink: "LDPE",
  },
  {
    label: "Tahap 4",
    medium: "CaCl2 30% w/v",
    density: "1.12 g/cm3",
    float: "ABS",
    sink: "PET, PVC",
  },
  {
    label: "Tahap 5",
    medium: "Flotasi (Lignosulfonat)",
    density: "-",
    float: "PET",
    sink: "PVC",
  },
];

export const recovery = (c: Cycle) =>
  ((c.outputKg / c.inputKg) * 100).toFixed(1);

export const revenue = (c: Cycle) =>
  c.resins.reduce((s, r) => s + r.kg * (PRICE_REF[r.type] || 0), 0);

export const gradeStyle = (g: ResinGrade) =>
  g === "A"
    ? { bg: "#D4F0E0", color: "#1A6B3A" }
    : g === "B"
    ? { bg: "#FFF0D4", color: "#9A6000" }
    : { bg: "#FCE4E4", color: "#B33A3A" };
