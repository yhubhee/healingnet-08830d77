export type Sex = "male" | "female";

export type ParamKind = "numeric" | "titer" | "qualitative";

export type LabParameter = {
  name: string;
  unit?: string;
  range?: string;
  low?: number;
  high?: number;
  ranges?: {
    male?: { low?: number; high?: number; range?: string };
    female?: { low?: number; high?: number; range?: string };
  };
  kind?: ParamKind;
  /** For qualitative parameters: list of allowed dropdown values. */
  options?: string[];
  /** For qualitative parameters: the value that should be flagged Normal. */
  expectedNormal?: string;
  /** For any parameter: name of another parameter in the same test whose value must equal `dependsOnValue` for this param to be editable. */
  dependsOn?: string;
  dependsOnValue?: string;
  /** When gated by dependsOn and the condition is not met, force this value. */
  forcedValue?: string;
};

export type LabCategory =
  | "Hematology"
  | "Biochemistry"
  | "Lipids"
  | "Endocrine"
  | "Infectious disease"
  | "Microbiology";

export type CatalogTest = {
  id: string;
  name: string;
  category: LabCategory;
  parameters: LabParameter[];
};

export type LabBundle = {
  id: string;
  name: string;
  testIds: string[];
};

export const LAB_CATALOG: CatalogTest[] = [
  {
    id: "fbc",
    name: "Full Blood Count (FBC)",
    category: "Hematology",
    parameters: [
      {
        name: "Haemoglobin (Hb)",
        unit: "g/dL",
        ranges: {
          male: { low: 13.0, high: 17.0, range: "13.0–17.0" },
          female: { low: 12.0, high: 15.5, range: "12.0–15.5" },
        },
        range: "M 13.0–17.0 / F 12.0–15.5",
      },
      { name: "White Blood Cells (WBC)", unit: "x10⁹/L", range: "4.0–11.0", low: 4, high: 11 },
      { name: "Platelets", unit: "x10⁹/L", range: "150–400", low: 150, high: 400 },
      {
        name: "Haematocrit (PCV)",
        unit: "%",
        ranges: {
          male: { low: 40, high: 52, range: "40–52" },
          female: { low: 36, high: 46, range: "36–46" },
        },
        range: "M 40–52 / F 36–46",
      },
      { name: "MCV", unit: "fL", range: "80–100", low: 80, high: 100 },
      { name: "Neutrophils", unit: "%", range: "40–75", low: 40, high: 75 },
      { name: "Lymphocytes", unit: "%", range: "20–45", low: 20, high: 45 },
    ],
  },
  {
    id: "lft",
    name: "Liver Function Test (LFT)",
    category: "Biochemistry",
    parameters: [
      { name: "ALT (SGPT)", unit: "U/L", range: "7–56", low: 7, high: 56 },
      { name: "AST (SGOT)", unit: "U/L", range: "10–40", low: 10, high: 40 },
      { name: "ALP", unit: "U/L", range: "44–147", low: 44, high: 147 },
      { name: "Total Bilirubin", unit: "mg/dL", range: "0.1–1.2", low: 0.1, high: 1.2 },
      { name: "Direct Bilirubin", unit: "mg/dL", range: "0.0–0.3", low: 0, high: 0.3 },
      { name: "Total Protein", unit: "g/dL", range: "6.0–8.3", low: 6, high: 8.3 },
      { name: "Albumin", unit: "g/dL", range: "3.5–5.0", low: 3.5, high: 5 },
    ],
  },
  {
    id: "rft",
    name: "Renal Function Test (RFT)",
    category: "Biochemistry",
    parameters: [
      { name: "Urea", unit: "mg/dL", range: "15–40", low: 15, high: 40 },
      {
        name: "Creatinine",
        unit: "mg/dL",
        ranges: {
          male: { low: 0.7, high: 1.3, range: "0.7–1.3" },
          female: { low: 0.6, high: 1.1, range: "0.6–1.1" },
        },
        range: "M 0.7–1.3 / F 0.6–1.1",
      },
      { name: "Sodium (Na⁺)", unit: "mmol/L", range: "135–145", low: 135, high: 145 },
      { name: "Potassium (K⁺)", unit: "mmol/L", range: "3.5–5.1", low: 3.5, high: 5.1 },
      { name: "Chloride (Cl⁻)", unit: "mmol/L", range: "98–107", low: 98, high: 107 },
      { name: "Bicarbonate (HCO₃⁻)", unit: "mmol/L", range: "22–29", low: 22, high: 29 },
      { name: "eGFR", unit: "mL/min/1.73m²", range: ">90", low: 90 },
    ],
  },
  {
    id: "lipid",
    name: "Lipid Profile",
    category: "Lipids",
    parameters: [
      { name: "Total Cholesterol", unit: "mg/dL", range: "<200", high: 200 },
      { name: "HDL Cholesterol", unit: "mg/dL", range: ">40", low: 40 },
      { name: "LDL Cholesterol", unit: "mg/dL", range: "<130", high: 130 },
      { name: "Triglycerides", unit: "mg/dL", range: "<150", high: 150 },
      { name: "VLDL", unit: "mg/dL", range: "5–40", low: 5, high: 40 },
    ],
  },
  {
    id: "fbg",
    name: "Fasting Blood Glucose",
    category: "Biochemistry",
    parameters: [{ name: "Fasting Glucose", unit: "mg/dL", range: "70–100", low: 70, high: 100 }],
  },
  {
    id: "tft",
    name: "Thyroid Function Test (TFT)",
    category: "Endocrine",
    parameters: [
      { name: "TSH", unit: "mIU/L", range: "0.4–4.0", low: 0.4, high: 4.0 },
      { name: "Free T4", unit: "ng/dL", range: "0.8–1.8", low: 0.8, high: 1.8 },
      { name: "Free T3", unit: "pg/mL", range: "2.3–4.2", low: 2.3, high: 4.2 },
    ],
  },
  {
    id: "mp",
    name: "Malaria Parasite (MP)",
    category: "Infectious disease",
    parameters: [
      {
        name: "Malaria Parasite (thick film)",
        range: "Not seen",
        kind: "qualitative",
        options: ["Not seen", "Seen"],
        expectedNormal: "Not seen",
      },
      {
        name: "Parasite density",
        unit: "/µL",
        range: "0",
        low: 0,
        high: 0,
        kind: "numeric",
        dependsOn: "Malaria Parasite (thick film)",
        dependsOnValue: "Seen",
        forcedValue: "0",
      },
      {
        name: "Species identified",
        range: "None",
        kind: "qualitative",
        options: ["None", "P. falciparum", "P. vivax", "P. ovale", "P. malariae", "Mixed infection"],
        expectedNormal: "None",
      },
    ],
  },
  {
    id: "widal",
    name: "Widal Test",
    category: "Infectious disease",
    parameters: [
      { name: "S. typhi O", range: "<1:80", kind: "titer" },
      { name: "S. typhi H", range: "<1:80", kind: "titer" },
      { name: "S. paratyphi A (O)", range: "<1:80", kind: "titer" },
      { name: "S. paratyphi B (O)", range: "<1:80", kind: "titer" },
    ],
  },
];

export const LAB_BUNDLES: LabBundle[] = [
  { id: "antenatal", name: "Antenatal panel", testIds: ["fbc", "fbg", "widal", "mp"] },
  { id: "executive", name: "Executive check-up", testIds: ["fbc", "lft", "rft", "lipid", "fbg", "tft"] },
  { id: "fever", name: "Fever workup", testIds: ["fbc", "mp", "widal"] },
  { id: "metabolic", name: "Metabolic panel", testIds: ["lft", "rft", "fbg", "lipid"] },
];

export const LAB_CATEGORIES: LabCategory[] = [
  "Hematology",
  "Biochemistry",
  "Lipids",
  "Endocrine",
  "Infectious disease",
  "Microbiology",
];

export function findCatalogTest(id?: string | null): CatalogTest | undefined {
  if (!id) return undefined;
  return LAB_CATALOG.find((t) => t.id === id);
}

export function resolveRange(param: LabParameter, sex?: Sex | string | null) {
  if (param.ranges && sex) {
    const s = String(sex).toLowerCase();
    if (s === "male" && param.ranges.male) return { ...param.ranges.male };
    if (s === "female" && param.ranges.female) return { ...param.ranges.female };
  }
  return { low: param.low, high: param.high, range: param.range };
}
