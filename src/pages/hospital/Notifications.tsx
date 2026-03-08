import { HospitalLayout } from "@/layouts/HospitalLayout";
import { Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mockNotifications = [
  { id: 1, type: "checkin", title: "New Patient Check-in", message: "Ngozi Adamu checked in for consultation", time: "5 min ago", read: false },
  { id: 2, type: "lab", title: "Lab Results Ready", message: "Blood panel for Amara Obi completed", time: "15 min ago", read: false },
  { id: 3, type: "pharmacy", title: "Low Stock Alert", message: "Amoxicillin 500mg below reorder level (35 remaining)", time: "1h ago", read: false },
  { id: 4, type: "billing", title: "Payment Received", message: "₦15,000 from Amara Obi - Cash", time: "2h ago", read: true },
  { id: 5, type: "consultation", title: "Consultation Request Accepted", message: "Dr. Specialist A accepted consultation for Chidi Nwosu", time: "3h ago", read: true },
  { id: 6, type: "emergency", title: "Emergency Patient", message: "Walk-in emergency: Fatima Bello - Pediatric emergency", time: "4h ago", read: true },
];

const typeIcons: Record<string, string> = { checkin: "🟢", lab: "🔬", pharmacy: "💊", billing: "💳", consultation: "📋", emergency: "🚨", system: "⚙️" };

export default function HospitalNotifications() {
  return (
    <HospitalLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Notifications</h1>
          <p className="text-muted-foreground">Hospital alerts, updates, and system notifications</p>
        </div>
        <Button variant="outline" size="sm"><CheckCircle className="h-4 w-4 mr-2" />Mark all read</Button>
      </div>
      <div className="space-y-2">
        {mockNotifications.map((n) => (
          <div key={n.id} className={cn("bg-card border rounded-xl p-5 flex gap-4 items-start transition-colors", n.read ? "border-border" : "border-primary/50 bg-primary/5")}>
            <span className="text-xl">{typeIcons[n.type] || "📌"}</span>
            <div className="flex-1">
              <h4 className="font-heading font-bold text-sm">{n.title}</h4>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
            </div>
            {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1" />}
          </div>
        ))}
      </div>
    </HospitalLayout>
  );
}
