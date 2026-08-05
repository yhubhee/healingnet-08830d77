import { ApiError, backend, unwrap } from "./client";
import type {
  CreateLabOrderInput,
  FlagLevel,
  IssueLabReportInput,
  LabOrder,
  LabParameter,
  LabTest,
  SaveParameterInput,
} from "./types";

/**
 * Lab domain API.
 *
 * Components never call the database directly — they call these functions
 * (usually through the hooks in ./hooks/useLab) and receive domain objects.
 */

const ORDER_SELECT =
  "*, patients(first_name, last_name, gender, date_of_birth), doctors:ordered_by(first_name, last_name), hospitals(name), lab_result_tests(*, lab_result_parameters(*))";

const ABNORMAL_FLAGS: FlagLevel[] = ["low", "high", "abnormal"];

function toParameter(row: any): LabParameter {
  const flag = (row.flag || "unknown") as FlagLevel;
  return {
    id: row.id,
    orderTestId: row.order_test_id,
    name: row.parameter_name,
    resultValue: row.result_value ?? null,
    unit: row.unit_snapshot ?? null,
    referenceRange: row.ref_range_snapshot ?? null,
    flag,
    sortOrder: row.sort_order ?? 0,
    isAbnormal: ABNORMAL_FLAGS.includes(flag),
  };
}

function toTest(row: any): LabTest {
  const parameters = (row.lab_result_parameters || [])
    .map(toParameter)
    .sort((a: LabParameter, b: LabParameter) => a.sortOrder - b.sortOrder);
  return {
    id: row.id,
    orderId: row.lab_result_id,
    name: row.test_name,
    categoryName: row.category_name ?? null,
    catalogTestId: row.catalog_test_id ?? null,
    isCustom: !!row.is_custom,
    status: (row.status === "completed" ? "completed" : "pending") as LabTest["status"],
    completedAt: row.completed_at ?? null,
    isAbnormal: !!row.is_abnormal || parameters.some((p) => p.isAbnormal),
    parameters,
  };
}

function fullName(rec: any): string | null {
  if (!rec) return null;
  const n = `${rec.first_name || ""} ${rec.last_name || ""}`.trim();
  return n || null;
}

export function toLabOrder(row: any): LabOrder {
  const tests = (row.lab_result_tests || []).map(toTest);
  return {
    id: row.id,
    labId: `LAB-${String(row.id).slice(0, 4).toUpperCase()}`,
    patientId: row.patient_id,
    hospitalId: row.hospital_id ?? null,
    doctorId: row.ordered_by ?? null,
    status: (row.status || "pending") as LabOrder["status"],
    notes: row.notes ?? null,
    createdAt: row.created_at,
    patientName: fullName(row.patients),
    patientSex: row.patients?.gender ?? null,
    doctorName: row.doctors ? `Dr. ${fullName(row.doctors)}` : null,
    hospitalName: row.hospitals?.name ?? null,
    tests,
    hasAbnormal: tests.some((t: LabTest) => t.isAbnormal),
  };
}

async function listOrders(column: string, value: string): Promise<LabOrder[]> {
  const rows = unwrap<any[]>(
    await (backend as any)
      .from("lab_results")
      .select(ORDER_SELECT)
      .eq(column, value)
      .order("created_at", { ascending: false }),
  );
  return (rows || []).map(toLabOrder);
}

export function listOrdersForDoctor(doctorId: string) {
  return listOrders("ordered_by", doctorId);
}

export function listOrdersForPatient(patientId: string) {
  return listOrders("patient_id", patientId);
}

export function listOrdersForHospital(hospitalId: string) {
  return listOrders("hospital_id", hospitalId);
}

/** All orders visible to the caller under current access rules. */
export async function listOrders_visible(): Promise<LabOrder[]> {
  const rows = unwrap<any[]>(
    await (backend as any).from("lab_results").select(ORDER_SELECT).order("created_at", { ascending: false }),
  );
  return (rows || []).map(toLabOrder);
}

export async function getOrder(orderId: string): Promise<LabOrder | null> {
  const row = unwrap<any>(
    await (backend as any).from("lab_results").select(ORDER_SELECT).eq("id", orderId).maybeSingle(),
  );
  return row ? toLabOrder(row) : null;
}

export async function createOrder(input: CreateLabOrderInput): Promise<LabOrder> {
  if (!input.patientId) throw new ApiError("A patient is required", 400);
  if (!input.hospitalId) throw new ApiError("A hospital is required", 400);
  if (!input.tests.length) throw new ApiError("Select at least one test", 400);

  const order = unwrap(
    await backend
      .from("lab_results")
      .insert({
        patient_id: input.patientId,
        hospital_id: input.hospitalId,
        ordered_by: input.doctorId || null,
        notes: input.notes || null,
        status: "pending",
      })
      .select()
      .single(),
  );

  const rows = input.tests.map((t) => ({
    lab_result_id: order.id,
    test_name: t.name,
    category_name: t.categoryName ?? null,
    catalog_test_id: t.catalogTestId ?? null,
    is_custom: !!t.isCustom,
    ...(t.sampleType ? { sample_type: t.sampleType } : {}),
  }));

  unwrap(await backend.from("lab_result_tests").insert(rows));

  const hydrated = await getOrder(order.id);
  if (!hydrated) throw new ApiError("Order created but could not be read back", 500);
  return hydrated;
}

export async function cancelOrder(orderId: string): Promise<void> {
  unwrap(await backend.from("lab_results").update({ status: "cancelled" }).eq("id", orderId).select("id"));
}

/**
 * Saves every parameter for a single test and marks that test completed.
 * Parameter rows are replaced wholesale so removed rows don't linger.
 */
export async function saveTestResults(
  orderTestId: string,
  parameters: SaveParameterInput[],
): Promise<void> {
  unwrap(
    await backend
      .from("lab_result_parameters" as any)
      .delete()
      .eq("order_test_id", orderTestId)
      .select("id"),
  );

  if (parameters.length > 0) {
    unwrap(
      await backend.from("lab_result_parameters" as any).insert(
        parameters.map((p, idx) => ({
          order_test_id: orderTestId,
          parameter_name: p.name,
          result_value: p.resultValue,
          unit_snapshot: p.unit,
          ref_range_snapshot: p.referenceRange,
          flag: p.flag || "unknown",
          sort_order: idx,
        })),
      ),
    );
  }

  const anyAbnormal = parameters.some((p) => ABNORMAL_FLAGS.includes(p.flag));
  const first = parameters[0];

  unwrap(
    await backend
      .from("lab_result_tests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        is_abnormal: anyAbnormal,
        // legacy mirrors kept populated for older reads
        result_value: first?.resultValue ?? null,
        unit: first?.unit ?? null,
        reference_range: first?.referenceRange ?? null,
      } as any)
      .eq("id", orderTestId)
      .select("id"),
  );
  // The database trigger recomputes the parent order status.
}

export async function updateOrderNotes(orderId: string, notes: string | null): Promise<void> {
  unwrap(await backend.from("lab_results").update({ notes }).eq("id", orderId).select("id"));
}

/** Issues the formatted report into the patient's Letters & Reports section. */
export async function issueLabReport(input: IssueLabReportInput): Promise<void> {
  unwrap(
    await backend.from("patient_letters" as any).insert({
      patient_id: input.patientId,
      hospital_id: input.hospitalId,
      doctor_id: input.doctorId,
      letter_type: "lab_report",
      title: input.title,
      body: input.body,
      status: "issued",
      issued_at: new Date().toISOString().slice(0, 10),
    }),
  );
}

/** Distinct patient ids the doctor has ordered labs for. */
export async function listPatientIdsForDoctor(doctorId: string): Promise<string[]> {
  const rows = unwrap(
    await backend.from("lab_results").select("patient_id").eq("ordered_by", doctorId),
  );
  return Array.from(new Set((rows || []).map((r: any) => r.patient_id).filter(Boolean)));
}
