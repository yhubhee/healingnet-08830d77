import { ArrowRight, ArrowLeft, Loader2, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  rating?: number;
  years_experience?: number;
  bio?: string;
  profile_image_url?: string;
}

interface Props {
  specialty: string;
  onSelectDoctor: (doctorId: string, doctor: Doctor) => void;
  onBack: () => void;
  loading?: boolean;
}

export function TriageStep5DoctorSelectionStep({ specialty, onSelectDoctor, onBack, loading = false }: Props) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  useEffect(() => {
    loadDoctors();
  }, [specialty]);

  async function loadDoctors() {
    setLoadingDoctors(true);
    try {
      // Try to fetch doctors for the recommended specialty
      const { data: specialists, error: specError } = await supabase
        .from("doctors")
        .select("id, first_name, last_name, specialty, rating, years_experience, bio, profile_image_url")
        .ilike("specialty", `%${specialty}%`)
        .order("rating", { ascending: false })
        .limit(50);

      if (specError) throw specError;

      if (specialists && specialists.length > 0) {
        setDoctors(specialists);
      } else {
        // No specialists found - show all doctors instead
        const { data: allDoctors, error: allError } = await supabase
          .from("doctors")
          .select("id, first_name, last_name, specialty, rating, years_experience, bio, profile_image_url")
          .order("rating", { ascending: false })
          .limit(50);

        if (allError) throw allError;
        setDoctors(allDoctors || []);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load doctors");
    } finally {
      setLoadingDoctors(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Step 5 of 8 — Select your doctor</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Choose a doctor from our available medical professionals.
      </p>

      {loadingDoctors ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading doctors…
        </div>
      ) : doctors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No doctors available.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {doctors.map((doctor) => (
            <button
              key={doctor.id}
              onClick={() => onSelectDoctor(doctor.id, doctor)}
              disabled={loading}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    Dr. {doctor.first_name} {doctor.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {doctor.specialty}
                    {doctor.years_experience && ` • ${doctor.years_experience} years experience`}
                  </div>
                  {doctor.bio && <p className="text-xs text-muted-foreground mt-1">{doctor.bio}</p>}
                </div>
                {doctor.rating && (
                  <div className="flex items-center gap-0.5 ml-2 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{doctor.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </button>
          ))}
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
