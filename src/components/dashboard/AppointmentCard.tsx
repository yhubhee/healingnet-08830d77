import { Calendar, Clock, Video, MapPin, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AppointmentCardProps {
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  type: "virtual" | "in_person" | "home_visit";
  status: "pending" | "approved" | "cancelled" | "completed";
  avatarUrl?: string;
}

const statusStyles = {
  pending: "bg-warning/20 text-warning border-warning/30",
  approved: "bg-success/20 text-success border-success/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
  completed: "bg-muted text-muted-foreground border-border",
};

const typeIcons = {
  virtual: Video,
  in_person: MapPin,
  home_visit: MapPin,
};

const typeLabels = {
  virtual: "Virtual",
  in_person: "In-Person",
  home_visit: "Home Visit",
};

export function AppointmentCard({
  doctorName,
  specialty,
  date,
  time,
  type,
  status,
  avatarUrl,
}: AppointmentCardProps) {
  const TypeIcon = typeIcons[type];

  return (
    <div className="bg-card border border-border rounded-xl p-4 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {doctorName.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-medium text-foreground">{doctorName}</h4>
            <p className="text-sm text-muted-foreground">{specialty}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Reschedule</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-primary" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-primary" />
          <span>{time}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TypeIcon className="h-4 w-4 text-primary" />
          <span>{typeLabels[type]}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="outline" className={cn("capitalize", statusStyles[status])}>
          {status}
        </Badge>
        {status === "approved" && type === "virtual" && (
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Video className="h-4 w-4 mr-2" />
            Join Call
          </Button>
        )}
      </div>
    </div>
  );
}
