import { Pill, RefreshCw, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PrescriptionCardProps {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  doctorName: string;
  status: "active" | "completed" | "cancelled";
  refillAllowed: boolean;
}

const statusStyles = {
  active: "bg-success/20 text-success border-success/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

export function PrescriptionCard({
  drugName,
  dosage,
  frequency,
  duration,
  doctorName,
  status,
  refillAllowed,
}: PrescriptionCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 card-hover">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Pill className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-foreground truncate">{drugName}</h4>
            <Badge variant="outline" className={cn("capitalize flex-shrink-0", statusStyles[status])}>
              {status}
            </Badge>
          </div>
          <p className="text-sm text-primary font-medium mt-1">{dosage}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {frequency} for {duration}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Prescribed by {doctorName}
          </p>
          <div className="flex items-center gap-2 mt-3">
            {refillAllowed && (
              <Badge variant="secondary" className="text-xs gap-1">
                <RefreshCw className="h-3 w-3" />
                Refill Available
              </Badge>
            )}
            {status === "active" && (
              <Badge variant="secondary" className="text-xs gap-1 text-warning border-warning/30 bg-warning/10">
                <AlertCircle className="h-3 w-3" />
                Take with food
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
