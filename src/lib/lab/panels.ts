export type LabPanelParameter = {
  test_name: string;
  unit?: string;
  reference_range?: string;
  range_low?: number;
  range_high?: number;
  category_name?: string;
};

export type LabPanel = {
  key: string;
  label: string;
  parameters: LabPanelParameter[];
};

export const LAB_PANELS: LabPanel[] = [
  {
    key: "fbc",
    label: "Full Blood Count (FBC)",
    parameters: [
      { test_name: "Haemoglobin (Hb)", unit: "g/dL", reference_range: "13.0–17.0", range_low: 13, range_high: 17, category_name: "Haematology" },
      { test_name: "White Blood Cells (WBC)", unit: "x10⁹/L", reference_range: "4.0–11.0", range_low: 4, range_high: 11, category_name: "Haematology" },
      { test_name: "Platelets", unit: "x10⁹/L", reference_range: "150–400", range_low: 150, range_high: 400, category_name: "Haematology" },
      { test_name: "Haematocrit (PCV)", unit: "%", reference_range: "40–52", range_low: 40, range_high: 52, category_name: "Haematology" },
      { test_name: "MCV", unit: "fL", reference_range: "80–100", range_low: 80, range_high: 100, category_name: "Haematology" },
      { test_name: "Neutrophils", unit: "%", reference_range: "40–75", range_low: 40, range_high: 75, category_name: "Haematology" },
      { test_name: "Lymphocytes", unit: "%", reference_range: "20–45", range_low: 20, range_high: 45, category_name: "Haematology" },
    ],
  },
  {
    key: "lft",
    label: "Liver Function Test (LFT)",
    parameters: [
      { test_name: "ALT (SGPT)", unit: "U/L", reference_range: "7–56", range_low: 7, range_high: 56, category_name: "Chemistry" },
      { test_name: "AST (SGOT)", unit: "U/L", reference_range: "10–40", range_low: 10, range_high: 40, category_name: "Chemistry" },
      { test_name: "ALP", unit: "U/L", reference_range: "44–147", range_low: 44, range_high: 147, category_name: "Chemistry" },
      { test_name: "Total Bilirubin", unit: "mg/dL", reference_range: "0.1–1.2", range_low: 0.1, range_high: 1.2, category_name: "Chemistry" },
      { test_name: "Direct Bilirubin", unit: "mg/dL", reference_range: "0.0–0.3", range_low: 0, range_high: 0.3, category_name: "Chemistry" },
      { test_name: "Total Protein", unit: "g/dL", reference_range: "6.0–8.3", range_low: 6, range_high: 8.3, category_name: "Chemistry" },
      { test_name: "Albumin", unit: "g/dL", reference_range: "3.5–5.0", range_low: 3.5, range_high: 5, category_name: "Chemistry" },
    ],
  },
  {
    key: "rft",
    label: "Renal Function Test (RFT)",
    parameters: [
      { test_name: "Urea", unit: "mg/dL", reference_range: "15–40", range_low: 15, range_high: 40, category_name: "Chemistry" },
      { test_name: "Creatinine", unit: "mg/dL", reference_range: "0.6–1.3", range_low: 0.6, range_high: 1.3, category_name: "Chemistry" },
      { test_name: "Sodium (Na⁺)", unit: "mmol/L", reference_range: "135–145", range_low: 135, range_high: 145, category_name: "Electrolytes" },
      { test_name: "Potassium (K⁺)", unit: "mmol/L", reference_range: "3.5–5.1", range_low: 3.5, range_high: 5.1, category_name: "Electrolytes" },
      { test_name: "Chloride (Cl⁻)", unit: "mmol/L", reference_range: "98–107", range_low: 98, range_high: 107, category_name: "Electrolytes" },
      { test_name: "Bicarbonate (HCO₃⁻)", unit: "mmol/L", reference_range: "22–29", range_low: 22, range_high: 29, category_name: "Electrolytes" },
      { test_name: "eGFR", unit: "mL/min/1.73m²", reference_range: ">90", range_low: 90, category_name: "Chemistry" },
    ],
  },
  {
    key: "lipid",
    label: "Lipid Profile",
    parameters: [
      { test_name: "Total Cholesterol", unit: "mg/dL", reference_range: "<200", range_high: 200, category_name: "Chemistry" },
      { test_name: "HDL Cholesterol", unit: "mg/dL", reference_range: ">40", range_low: 40, category_name: "Chemistry" },
      { test_name: "LDL Cholesterol", unit: "mg/dL", reference_range: "<130", range_high: 130, category_name: "Chemistry" },
      { test_name: "Triglycerides", unit: "mg/dL", reference_range: "<150", range_high: 150, category_name: "Chemistry" },
      { test_name: "VLDL", unit: "mg/dL", reference_range: "5–40", range_low: 5, range_high: 40, category_name: "Chemistry" },
    ],
  },
];

export type FlagLevel = "normal" | "low" | "high" | "unknown";

export function computeFlag(
  resultValue: string | number | null | undefined,
  low?: number,
  high?: number,
): FlagLevel {
  if (resultValue === null || resultValue === undefined || resultValue === "") return "unknown";
  const n = typeof resultValue === "number" ? resultValue : parseFloat(String(resultValue));
  if (isNaN(n)) return "unknown";
  if (low === undefined && high === undefined) return "unknown";
  if (low !== undefined && n < low) return "low";
  if (high !== undefined && n > high) return "high";
  return "normal";
}
