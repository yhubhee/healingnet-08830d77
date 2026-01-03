import { Activity, Heart, Droplets, Scale } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface MetricProps {
  label: string;
  value: string;
  unit: string;
  progress: number;
  status: "normal" | "warning" | "critical";
  icon: React.ElementType;
}

const metrics: MetricProps[] = [
  {
    label: "Blood Pressure",
    value: "120/80",
    unit: "mmHg",
    progress: 75,
    status: "normal",
    icon: Activity,
  },
  {
    label: "Heart Rate",
    value: "72",
    unit: "bpm",
    progress: 70,
    status: "normal",
    icon: Heart,
  },
  {
    label: "Blood Sugar",
    value: "98",
    unit: "mg/dL",
    progress: 65,
    status: "normal",
    icon: Droplets,
  },
  {
    label: "BMI",
    value: "24.5",
    unit: "",
    progress: 80,
    status: "normal",
    icon: Scale,
  },
];

const statusColors = {
  normal: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

const progressColors = {
  normal: "[&>div]:bg-success",
  warning: "[&>div]:bg-warning",
  critical: "[&>div]:bg-destructive",
};

export function HealthMetrics() {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-heading font-bold text-foreground mb-4">
        Health Metrics
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Last updated: January 2, 2026
      </p>
      <div className="space-y-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <metric.icon className={`h-4 w-4 ${statusColors[metric.status]}`} />
                <span className="text-sm font-medium text-foreground">
                  {metric.label}
                </span>
              </div>
              <span className={`text-sm font-bold ${statusColors[metric.status]}`}>
                {metric.value} {metric.unit}
              </span>
            </div>
            <Progress
              value={metric.progress}
              className={`h-2 bg-muted ${progressColors[metric.status]}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
