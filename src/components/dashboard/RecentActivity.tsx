import {
  Calendar,
  FileText,
  Pill,
  Video,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: number;
  type: "appointment" | "record" | "prescription" | "teleconsult";
  title: string;
  description: string;
  time: string;
  status: "success" | "pending" | "info";
}

const activities: ActivityItem[] = [
  {
    id: 1,
    type: "appointment",
    title: "Appointment Confirmed",
    description: "Dr. Adebayo on Jan 5, 2026",
    time: "2 hours ago",
    status: "success",
  },
  {
    id: 2,
    type: "prescription",
    title: "New Prescription",
    description: "Amoxicillin 500mg added",
    time: "5 hours ago",
    status: "info",
  },
  {
    id: 3,
    type: "record",
    title: "Medical Record Updated",
    description: "Blood test results added",
    time: "1 day ago",
    status: "success",
  },
  {
    id: 4,
    type: "teleconsult",
    title: "Teleconsultation Completed",
    description: "30 min session with Dr. Okonkwo",
    time: "2 days ago",
    status: "success",
  },
  {
    id: 5,
    type: "appointment",
    title: "Appointment Reminder",
    description: "Follow-up due in 7 days",
    time: "3 days ago",
    status: "pending",
  },
];

const typeIcons = {
  appointment: Calendar,
  record: FileText,
  prescription: Pill,
  teleconsult: Video,
};

const statusIcons = {
  success: CheckCircle,
  pending: AlertCircle,
  info: FileText,
};

const statusColors = {
  success: "text-success",
  pending: "text-warning",
  info: "text-info",
};

export function RecentActivity() {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-heading font-bold text-foreground mb-4">
        Recent Activity
      </h3>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const TypeIcon = typeIcons[activity.type];
          const StatusIcon = statusIcons[activity.status];

          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TypeIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </h4>
                  <StatusIcon
                    className={cn("h-4 w-4 flex-shrink-0", statusColors[activity.status])}
                  />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {activity.description}
                </p>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
