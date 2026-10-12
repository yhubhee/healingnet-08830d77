import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Video, MessageCircle, Link as LinkIcon, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  consultationId?: string;
  appointmentId?: string;
  meetingLink?: string | null;
  patientPhone?: string | null;
  patientName?: string;
  scheduledFor?: string;
}

export function JoinCallButton({ consultationId, appointmentId, meetingLink, patientPhone, patientName, scheduledFor }: Props) {
  const nav = useNavigate();
  const mode = consultationId ? "consultation" : "appointment";
  const id = consultationId || appointmentId;

  // VideoConsult makes the single daily-room call and joins with { url, token }.
  function startDaily() {
    if (!id) return;
    nav(`/consult/${id}?mode=${mode}`);
  }

  function waLink() {
    const digits = (patientPhone || "").replace(/\D/g, "");
    if (!digits) { toast.error("Patient phone missing"); return; }
    const link = `${window.location.origin}/consult/${id}?mode=${mode}`;
    const text = encodeURIComponent(`Hi ${patientName || ""}, your HealingNet video consultation${scheduledFor ? ` on ${new Date(scheduledFor).toLocaleString()}` : ""} is ready. Join here: ${link}`);
    window.open(`https://wa.me/${digits}?text=${text}`, "_blank");
  }

  function copyLink() {
    const link = `${window.location.origin}/consult/${id}?mode=${mode}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  }

  return (
    <div className="inline-flex">
      <Button size="sm" onClick={startDaily} className="rounded-r-none">
        <Video className="w-4 h-4" />
        Start video
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-2"><ChevronDown className="w-4 h-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={waLink}><MessageCircle className="w-4 h-4 mr-2" />Send via WhatsApp</DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink}><LinkIcon className="w-4 h-4 mr-2" />Copy meeting link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
