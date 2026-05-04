import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useDoctorId } from "@/hooks/useHospitalData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function DoctorLabOrders() {
  const { data: docId } = useDoctorId();
  const { data: orders = [] } = useQuery({
    enabled: !!docId,
    queryKey: ["doctor-lab", docId],
    queryFn: async () => {
      const { data } = await supabase.from("lab_results").select("*, patients(first_name, last_name), lab_result_tests(*)").eq("ordered_by", docId!).order("created_at", { ascending: false });
      return data || [];
    },
  });
  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Lab Orders</h1>
      <div className="space-y-3">
        {orders.map((o: any) => (
          <div key={o.id} className="bg-card border border-border rounded-xl p-4">
            <h4 className="font-heading font-bold">{o.patients?.first_name} {o.patients?.last_name}</h4>
            <p className="text-sm text-muted-foreground">{o.lab_result_tests?.map((t: any) => t.test_name).join(", ")} • {o.status}</p>
          </div>
        ))}
      </div>
    </DoctorLayout>
  );
}
