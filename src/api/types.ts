// Domain types returned by the API layer.
// These are deliberately decoupled from database row shapes so that schema
// renames never leak into components.

export type FlagLevel = "normal" | "low" | "high" | "abnormal" | "unknown";

export type LabParameter = {
  id: string;
  orderTestId: string;
  name: string;
  resultValue: string | null;
  /** Snapshot of the unit at the time results were entered. */
  unit: string | null;
  /** Snapshot of the reference range at the time results were entered. */
  referenceRange: string | null;
  flag: FlagLevel;
  sortOrder: number;
  isAbnormal: boolean;
};

export type LabTest = {
  id: string;
  orderId: string;
  name: string;
  categoryName: string | null;
  catalogTestId: string | null;
  isCustom: boolean;
  status: "pending" | "completed";
  completedAt: string | null;
  isAbnormal: boolean;
  parameters: LabParameter[];
};

export type LabOrder = {
  id: string;
  /** Human-readable lab identifier, e.g. LAB-0A2A. */
  labId: string;
  patientId: string;
  hospitalId: string | null;
  doctorId: string | null;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  createdAt: string;
  patientName: string | null;
  patientSex: string | null;
  doctorName: string | null;
  hospitalName: string | null;
  tests: LabTest[];
  /** True when any parameter across any test is flagged outside range. */
  hasAbnormal: boolean;
};

export type NewLabOrderTest = {
  name: string;
  categoryName?: string | null;
  catalogTestId?: string | null;
  isCustom?: boolean;
  sampleType?: string | null;
};

export type CreateLabOrderInput = {
  patientId: string;
  hospitalId: string;
  doctorId?: string | null;
  notes?: string | null;
  tests: NewLabOrderTest[];
};

export type SaveParameterInput = {
  name: string;
  resultValue: string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: FlagLevel;
};

export type IssueLabReportInput = {
  orderId: string;
  patientId: string;
  hospitalId: string | null;
  doctorId: string | null;
  title: string;
  body: string;
};
