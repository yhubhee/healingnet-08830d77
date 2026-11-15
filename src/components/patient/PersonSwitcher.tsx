// "Who is this for?" in the patient header: "For: Me ▾" or "For: Tobi ▾". Same choices as
// the app: Me, each family member (first name, age, relationship) and Add family member.
import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { activePerson, useActivePatient, useKeepActivePersonValid } from "@/hooks/useFamily";
import { ageText, MAX_FAMILY, relationshipLabel } from "@/lib/family";
import { verifyState } from "@/lib/verification";
import { cn } from "@/lib/utils";
import { VerifyBadge } from "./VerifyFamily";

export function PersonSwitcher() {
  const navigate = useNavigate();
  const person = useActivePatient();
  useKeepActivePersonValid();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`For: ${person.label}. Change who this is for`}
          className={cn(
            "inline-flex h-10 max-w-[11rem] items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
            person.isMe ? "border-border hover:bg-card" : "border-primary/50 bg-primary/10 text-primary",
          )}
        >
          <Users className="h-4 w-4 shrink-0" />
          <span className="truncate">For: {person.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Who is this for?</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer justify-between" onClick={() => activePerson.set(null)}>
          <span className="font-medium">Me</span>
          {person.isMe && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        {person.family.map((m) => (
          // A locked member opens Verify instead of being switched to.
          <DropdownMenuItem key={m.patient_id} className="cursor-pointer justify-between"
            onClick={() => (verifyState(m).locked ? navigate(`/patient/settings?verify=${m.patient_id}#family`) : activePerson.set(m.patient_id))}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{m.first_name}</span>
              <span className="block text-xs text-muted-foreground">{[ageText(m.age), relationshipLabel(m.relationship)].filter(Boolean).join(" · ")}</span>
              <VerifyBadge member={m} className="text-xs" />
            </span>
            {!person.isMe && person.patientId === m.patient_id && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {person.family.length < MAX_FAMILY ? (
          <DropdownMenuItem className="cursor-pointer text-primary" onClick={() => navigate("/patient/settings?add-family=1#family")}>
            <Plus className="mr-1.5 h-4 w-4" />Add family member
          </DropdownMenuItem>
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">You can add up to {MAX_FAMILY} family members.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A line for pages and cards that act for one person, e.g. "For Tobi". Nothing is shown for Me. */
export function ForPersonNote({ className }: { className?: string }) {
  const person = useActivePatient();
  if (person.isMe) return null;
  return <p className={cn("inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary", className)}><Users className="h-3.5 w-3.5" />For {person.firstName}</p>;
}
