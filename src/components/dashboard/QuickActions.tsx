import {
  CalendarPlus,
  Stethoscope,
  FileSearch,
  MessageSquarePlus,
  Pill,
  TestTube,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  {
    icon: CalendarPlus,
    label: "Book Appointment",
    description: "Schedule a new visit",
    color: "text-primary",
    bgColor: "bg-primary/10 hover:bg-primary/20",
  },
  {
    icon: Stethoscope,
    label: "Symptom Checker",
    description: "Check your symptoms",
    color: "text-success",
    bgColor: "bg-success/10 hover:bg-success/20",
  },
  {
    icon: FileSearch,
    label: "View Records",
    description: "Access medical history",
    color: "text-info",
    bgColor: "bg-info/10 hover:bg-info/20",
  },
  {
    icon: Pill,
    label: "Refill Request",
    description: "Request medication refill",
    color: "text-warning",
    bgColor: "bg-warning/10 hover:bg-warning/20",
  },
  {
    icon: TestTube,
    label: "Lab Results",
    description: "Check test results",
    color: "text-destructive",
    bgColor: "bg-destructive/10 hover:bg-destructive/20",
  },
  {
    icon: MessageSquarePlus,
    label: "Message Doctor",
    description: "Send a message",
    color: "text-secondary",
    bgColor: "bg-secondary/10 hover:bg-secondary/20",
  },
];

export function QuickActions() {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-heading font-bold text-foreground mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            className={`flex flex-col items-center gap-2 h-auto py-4 px-3 ${action.bgColor} transition-all duration-200`}
          >
            <action.icon className={`h-6 w-6 ${action.color}`} />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {action.description}
              </p>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
