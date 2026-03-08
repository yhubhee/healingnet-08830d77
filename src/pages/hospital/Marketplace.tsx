import { HospitalLayout } from "@/layouts/HospitalLayout";
import { Search, Star, Award } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mockDoctors = [
  { id: 1, name: "Dr. Adekunle Balogun", specialty: "Neurology", hospital: "Lagos University Teaching Hospital", experience: 18, rating: 4.9, consultation_fee: 25000, virtual_fee: 15000, available: true },
  { id: 2, name: "Dr. Chioma Eze", specialty: "Oncology", hospital: "National Hospital Abuja", experience: 22, rating: 4.8, consultation_fee: 35000, virtual_fee: 20000, available: true },
  { id: 3, name: "Dr. Yusuf Abdullahi", specialty: "Nephrology", hospital: "Aminu Kano Teaching Hospital", experience: 15, rating: 4.7, consultation_fee: 20000, virtual_fee: 12000, available: false },
];

export default function HospitalMarketplace() {
  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Doctor Marketplace</h1>
        <p className="text-muted-foreground">Find and request external specialist consultations</p>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search doctors..." className="pl-10" />
        </div>
      </div>
      <div className="space-y-4">
        {mockDoctors.map((d) => (
          <div key={d.id} className="bg-card border border-border rounded-xl p-5 flex gap-5 items-start hover:border-primary transition-colors">
            <div className="w-14 h-14 rounded-full gradient-info flex items-center justify-center font-bold text-foreground shrink-0">
              {d.name.split(" ").slice(1).map((n) => n[0]).join("")}
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold">{d.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{d.hospital}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">{d.specialty}</span>
                <span className="flex items-center gap-1"><Award className="h-3 w-3" />{d.experience} yrs</span>
                <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning" />{d.rating}</span>
              </div>
              <div className="flex gap-6 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>In-person: <strong className="text-foreground font-heading">₦{d.consultation_fee.toLocaleString()}</strong></span>
                <span>Virtual: <strong className="text-foreground font-heading">₦{d.virtual_fee.toLocaleString()}</strong></span>
              </div>
            </div>
            <Button variant={d.available ? "default" : "outline"} disabled={!d.available}>
              {d.available ? "Request" : "Unavailable"}
            </Button>
          </div>
        ))}
      </div>
    </HospitalLayout>
  );
}
