import { HospitalLayout } from "@/layouts/HospitalLayout";
import { Search, Star, Award } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDoctorMarketplace } from "@/hooks/useHospitalData";
import { useState } from "react";

export default function HospitalMarketplace() {
  const { data: listings = [], isLoading } = useDoctorMarketplace();
  const [search, setSearch] = useState("");

  const filtered = listings.filter((d: any) => {
    const name = `${d.doctors?.first_name || ""} ${d.doctors?.last_name || ""}`.toLowerCase();
    return name.includes(search.toLowerCase()) || (d.doctors?.specialty || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Doctor Marketplace</h1>
        <p className="text-muted-foreground">Find and request external specialist consultations</p>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search doctors..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {isLoading ? <div className="text-center p-8 text-muted-foreground">Loading marketplace...</div> : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No doctors available</div>
          ) : filtered.map((d: any) => (
            <div key={d.id} className="bg-card border border-border rounded-xl p-5 flex gap-5 items-start hover:border-primary transition-colors">
              <div className="w-14 h-14 rounded-full gradient-info flex items-center justify-center font-bold text-foreground shrink-0">
                {d.doctors?.first_name?.[0]}{d.doctors?.last_name?.[0]}
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold">Dr. {d.doctors?.first_name} {d.doctors?.last_name}</h3>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3 mt-1">
                  <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">{d.doctors?.specialty || "—"}</span>
                  <span className="flex items-center gap-1"><Award className="h-3 w-3" />{d.doctors?.years_experience || 0} yrs</span>
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning" />{d.doctors?.rating || 0}</span>
                </div>
                {d.bio_for_marketplace && <p className="text-sm text-muted-foreground mb-2">{d.bio_for_marketplace}</p>}
                <div className="flex gap-6 pt-3 border-t border-border text-xs text-muted-foreground">
                  <span>In-person: <strong className="text-foreground font-heading">₦{Number(d.external_consultation_fee || 0).toLocaleString()}</strong></span>
                  <span>Virtual: <strong className="text-foreground font-heading">₦{Number(d.external_virtual_fee || 0).toLocaleString()}</strong></span>
                </div>
              </div>
              <Button variant={d.is_available_for_external ? "default" : "outline"} disabled={!d.is_available_for_external}>
                {d.is_available_for_external ? "Request" : "Unavailable"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </HospitalLayout>
  );
}
