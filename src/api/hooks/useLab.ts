import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as LabApi from "@/api/lab";
import type {
  CreateLabOrderInput,
  IssueLabReportInput,
  LabOrder,
  SaveParameterInput,
} from "@/api/types";

/**
 * Shared cache keys so invalidation behaviour is defined once instead of
 * being re-invented in each page.
 */
export const labKeys = {
  all: ["lab"] as const,
  orders: () => [...labKeys.all, "orders"] as const,
  byDoctor: (id?: string | null) => [...labKeys.orders(), "doctor", id] as const,
  byPatient: (id?: string | null) => [...labKeys.orders(), "patient", id] as const,
  byHospital: (id?: string | null) => [...labKeys.orders(), "hospital", id] as const,
  visible: () => [...labKeys.orders(), "visible"] as const,
  order: (id?: string | null) => [...labKeys.orders(), "detail", id] as const,
};

export function useDoctorLabOrders(doctorId?: string | null) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: labKeys.byDoctor(doctorId),
    queryFn: () => LabApi.listOrdersForDoctor(doctorId!),
  });
}

export function usePatientLabOrders(patientId?: string | null) {
  return useQuery({
    enabled: !!patientId,
    queryKey: labKeys.byPatient(patientId),
    queryFn: () => LabApi.listOrdersForPatient(patientId!),
  });
}

export function useHospitalLabOrders(hospitalId?: string | null) {
  return useQuery({
    enabled: !!hospitalId,
    queryKey: labKeys.byHospital(hospitalId),
    queryFn: () => LabApi.listOrdersForHospital(hospitalId!),
  });
}

/** Every lab order the signed-in user is allowed to see. */
export function useVisibleLabOrders() {
  return useQuery({
    queryKey: labKeys.visible(),
    queryFn: () => LabApi.listOrders_visible(),
  });
}

export function useLabOrder(orderId?: string | null) {
  return useQuery({
    enabled: !!orderId,
    queryKey: labKeys.order(orderId),
    queryFn: () => LabApi.getOrder(orderId!),
  });
}

function useInvalidateLab() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: labKeys.all });
    // legacy keys still used by dashboards not yet migrated
    qc.invalidateQueries({ queryKey: ["lab-results"] });
    qc.invalidateQueries({ queryKey: ["patient-lab-results"] });
    qc.invalidateQueries({ queryKey: ["doctor", "patient-detail"] });
  };
}

export function useCreateLabOrder() {
  const invalidate = useInvalidateLab();
  return useMutation<LabOrder, Error, CreateLabOrderInput>({
    mutationFn: (input) => LabApi.createOrder(input),
    onSuccess: invalidate,
  });
}

export function useCancelLabOrder() {
  const invalidate = useInvalidateLab();
  return useMutation<void, Error, string>({
    mutationFn: (orderId) => LabApi.cancelOrder(orderId),
    onSuccess: invalidate,
  });
}

export function useSaveTestResults() {
  const invalidate = useInvalidateLab();
  return useMutation<void, Error, { orderTestId: string; parameters: SaveParameterInput[] }>({
    mutationFn: ({ orderTestId, parameters }) => LabApi.saveTestResults(orderTestId, parameters),
    onSuccess: invalidate,
  });
}

export function useIssueLabReport() {
  const qc = useQueryClient();
  return useMutation<void, Error, IssueLabReportInput>({
    mutationFn: (input) => LabApi.issueLabReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-letters"] }),
  });
}
