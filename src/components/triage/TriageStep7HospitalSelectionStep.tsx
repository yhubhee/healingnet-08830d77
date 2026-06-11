import { ArrowLeft, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rankHospitals } from "@/lib/triage/proximity";
import { toast } from "sonner";

interface RankedHospital {
  id: string;
  name: string;
  city?: string;
  distanceKm?: number;
  hasSpecialty: boolean;
}

interface Props {
  doctorId: string;
  doctorName: string;
  coords: { lat: number; lng: number } | null;
  onSelectHospital: (hospitalId: string) => void;
  onBack: () => void;
  onTryAnotherDoctor?: () => void;
  onTryTelemedicine?: () => void;
}

export function TriageStep7HospitalSelectionStep({
  doctorId,
  doctorName,
  coords,
  onSelectHospital,
  onBack,
  onTryAnotherDoctor,
  onTryTelemedicine,
}: Props) {
  const [hospitals, setHospitals] = useState<RankedHospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  useEffect(() => {
    loadHospitalsForDoctor();
  }, [doctorId, coords]);

  async function loadHospitalsForDoctor() {
    setLoadingHospitals(true);
    setFallbackMessage(null);
    try {
      // Get all hospitals where this doctor works
      const { data: hospitalDocs, error: hdError } = await supabase
        .from("hospital_doctors")
        .select("hospital_id")
        .eq("doctor_id", doctorId)
        .eq("is_active", true);

      if (hdError) throw hdError;

      const hospitalIds = hospitalDocs?.map((hd: any) => hd.hospital_id) || [];

      if (hospitalIds.length === 0) {
        setFallbackMessage("This doctor has no hospital affiliations.");
        setHospitals([]);
        return;
      }

      // Get hospital details
      const { data: hospitalData, error: hError } = await supabase
        .from("hospitals")
        .select("id, name, city, lat, lng")
        .in("id", hospitalIds)
        .eq("is_active", true);

      if (hError) throw hError;

      // Rank hospitals by proximity
      const specSet = new Set(hospitalIds);
      const ranked = rankHospitals(coords, hospitalData || [], specSet);

      // Check if any hospitals are nearby
      const nearby = ranked.filter((h) => h.distanceKm != null && h.distanceKm <= 50);
      if (nearby.length === 0) {
        setFallbackMessage(
          `Dr. ${doctorName} has no in-person availability within 50 km. You can try another doctor, choose online consultation, or view hospitals nationwide.`,
        );
      }

      setHospitals(ranked);
    } catch (error: any) {
      toast.error(error.message || "Failed to load hospitals");
    } finally {
      setLoadingHospitals(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Step 7 of 8 — Select hospital</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Choose where you'd like to meet Dr. {doctorName}.
      </p>

      {fallbackMessage && (
        <div className="text-xs bg-warning/10 text-warning border border-warning/30 rounded-lg p-2 mb-4">
          {fallbackMessage}
        </div>
      )}

      {loadingHospitals ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding hospitals…
        </div>
      ) : hospitals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hospitals available for this doctor.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {hospitals.slice(0, 8).map((h) => (
            <button
              key={h.id}
              onClick={() => onSelectHospital(h.id)}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-3 justify-between">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {h.name}
                    {h.hasSpecialty && <CheckCircle2 className="w-3 h-3 text-success" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.city || "—"}
                    {h.distanceKm != null && ` • ${h.distanceKm.toFixed(1)} km away`}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Fallback options */}
      {fallbackMessage && hospitals.length === 0 && (
        <div className="space-y-2 mb-4">
          {onTryAnotherDoctor && (
            <button
              onClick={onTryAnotherDoctor}
              className="w-full text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Try another doctor
            </button>
          )}
          {onTryTelemedicine && (
            <button
              onClick={onTryTelemedicine}
              className="w-full text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Switch to online consultation
            </button>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    </div>
  );
}
