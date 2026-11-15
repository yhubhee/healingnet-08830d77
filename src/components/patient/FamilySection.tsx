// Family in patient Settings: the list, add, edit a member's health card, and remove.
// Same rules and wording as the app (mobile/app/family/*).
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QueryState } from "@/components/common/QueryState";
import { activePerson, useActivePatient, useAddFamilyMember, useFamily, useRemoveFamilyMember } from "@/hooks/useFamily";
import { ALLOWED, pick } from "@/lib/allowed";
import { lagosToday } from "@/lib/dates";
import { dbMessage, friendlyError, profileIncompleteRoute } from "@/lib/errors";
import { verifyState } from "@/lib/verification";
import { VerifyBadge, VerifyFamilyDialog } from "./VerifyFamily";
import {
  ageText, EMPTY_FAMILY_FORM, MAX_FAMILY, needsPermission, permissionLabel, RELATIONSHIPS, relationshipLabel, removeExplanation, turning18Note,
  validateFamilyForm, type FamilyForm, type FamilyMember,
} from "@/lib/family";
import { compactPhone, isNigerianPhone } from "@/lib/patientProfile";

const SEXES = [{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENOTYPES = ["AA", "AS", "AC", "SS", "SC", "CC"];
const HEALTH_NOTE_MAX = 500;
const NOT_SURE = "not-sure";

function FieldRow({ label, error, children, htmlFor }: { label: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

// ---- Add ---------------------------------------------------------------------------------
function AddFamilyDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: (patientId: string) => void }) {
  const add = useAddFamilyMember();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FamilyForm>(EMPTY_FAMILY_FORM);
  const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setForm(EMPTY_FAMILY_FORM); setTried(false); } }, [open]);

  const today = lagosToday();
  const adult = needsPermission(form.date_of_birth, today);
  const errors = tried ? validateFamilyForm(form, today) : {};
  const set = <K extends keyof FamilyForm>(k: K, v: FamilyForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setTried(true);
    if (Object.keys(validateFamilyForm(form, today)).length) { toast.error("Check the highlighted fields."); return; }
    try {
      const id = await add.mutateAsync(form);
      toast.success(`${form.first_name.trim()} added`);
      activePerson.set(id);
      onOpenChange(false);
      // Straight to "Verify": the next step is proving the relationship ("Later" skips it).
      onAdded(id);
    } catch (e) {
      const unfinished = profileIncompleteRoute(e);
      if (unfinished) {
        // The database refuses adding family until the account holder's own profile is complete.
        toast.info(unfinished.toast);
        qc.invalidateQueries({ queryKey: ["patient-profile"] });
        navigate(unfinished.route, { replace: true });
        return;
      }
      // The database's own message, as written.
      toast.error(dbMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add family member</DialogTitle>
          <DialogDescription>You will manage their visits, prescriptions and records from your account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="First name *" htmlFor="fam-first" error={errors.first_name}>
              <Input id="fam-first" value={form.first_name} maxLength={80} onChange={(e) => set("first_name", e.target.value)} />
            </FieldRow>
            <FieldRow label="Last name *" htmlFor="fam-last" error={errors.last_name}>
              <Input id="fam-last" value={form.last_name} maxLength={80} onChange={(e) => set("last_name", e.target.value)} />
            </FieldRow>
          </div>
          <FieldRow label="Date of birth *" htmlFor="fam-dob" error={errors.date_of_birth}>
            <Input id="fam-dob" type="date" min="1900-01-01" max={today} value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          </FieldRow>
          <FieldRow label="Sex *" error={errors.gender}>
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger aria-label="Sex"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{SEXES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Relationship to you *" error={errors.relationship}>
            <Select value={form.relationship} onValueChange={(v) => set("relationship", v)}>
              <SelectTrigger aria-label="Relationship to you"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">For example, choose Child if you are their parent.</p>
          </FieldRow>
          {adult && (
            <div className={`rounded-lg border p-3 ${errors.consent ? "border-destructive" : "border-border"}`}>
              <p className="mb-2 text-xs text-muted-foreground">{form.first_name.trim() || "This person"} is 18 or older, so you need their permission.</p>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm font-medium">
                <Checkbox className="mt-0.5" checked={form.consent} onCheckedChange={(v) => set("consent", v === true)} />
                <span>{permissionLabel(form.first_name)}</span>
              </label>
              {errors.consent ? <p role="alert" className="mt-2 text-xs text-destructive">{errors.consent}</p> : null}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={add.isPending}>{add.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Add family member</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Edit the health card ------------------------------------------------------------------
interface CardForm { blood_group: string; genotype: string; allergies: string; medical_conditions: string; emergency_contact_name: string; emergency_contact_phone: string }

/** A family member's health card, edited by the guardian. Used in Settings and on the Profile page. */
export function EditHealthCardDialog({ patientId, firstName, open, onOpenChange }: {
  patientId: string | null; firstName: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const row = useQuery({
    queryKey: ["patient-profile", "member", patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", patientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<CardForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => { if (!open) { setForm(null); setTried(false); } }, [open]);
  useEffect(() => {
    const p = row.data;
    if (!open || !p || form) return;
    const s = (v: unknown) => (v == null ? "" : String(v));
    setForm({
      blood_group: s(p.blood_group), genotype: s(p.genotype), allergies: s(p.allergies), medical_conditions: s(p.medical_conditions),
      emergency_contact_name: s(p.emergency_contact_name), emergency_contact_phone: s(p.emergency_contact_phone),
    });
  }, [open, row.data, form]);

  const phoneError = form && form.emergency_contact_phone.trim() && !isNigerianPhone(form.emergency_contact_phone) ? "Enter a Nigerian number, e.g. 0803 123 4567." : undefined;
  const set = (k: keyof CardForm, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form || !patientId) return;
    setTried(true);
    if (phoneError) { toast.error("Check the highlighted fields."); return; }
    setSaving(true);
    const opt = (v: string) => v.trim() || null;
    const patch = {
      blood_group: opt(form.blood_group), genotype: opt(form.genotype),
      allergies: opt(form.allergies), medical_conditions: opt(form.medical_conditions),
      emergency_contact_name: opt(form.emergency_contact_name),
      emergency_contact_phone: form.emergency_contact_phone.trim() ? compactPhone(form.emergency_contact_phone) : null,
    };
    const { error } = await supabase.from("patients").update(pick(patch, ALLOWED.patientUpdate) as never).eq("id", patientId);
    setSaving(false);
    if (error) { toast.error(`Couldn't save the health card. ${error.message || friendlyError(error)}`); return; }
    qc.invalidateQueries({ queryKey: ["patient-profile"] });
    toast.success("Health card saved");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{firstName}'s health card</DialogTitle>
          <DialogDescription>Doctors treating {firstName} see this. Keep it up to date.</DialogDescription>
        </DialogHeader>
        {!form ? (
          <QueryState isLoading={row.isLoading} isError={row.isError} error={row.error} onRetry={() => row.refetch()}>
            <p className="text-sm text-muted-foreground">We couldn't load the health card.</p>
          </QueryState>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="Blood group">
                <Select value={form.blood_group || NOT_SURE} onValueChange={(v) => set("blood_group", v === NOT_SURE ? "" : v)}>
                  <SelectTrigger aria-label="Blood group"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NOT_SURE}>Not sure</SelectItem>{BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Genotype">
                <Select value={form.genotype || NOT_SURE} onValueChange={(v) => set("genotype", v === NOT_SURE ? "" : v)}>
                  <SelectTrigger aria-label="Genotype"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NOT_SURE}>Not sure</SelectItem>{GENOTYPES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </FieldRow>
            </div>
            <FieldRow label="Allergies" htmlFor="card-allergies">
              <Textarea id="card-allergies" value={form.allergies} maxLength={HEALTH_NOTE_MAX} placeholder="e.g. Penicillin, peanuts" onChange={(e) => set("allergies", e.target.value)} />
              <p className="text-xs text-muted-foreground">{form.allergies.length}/{HEALTH_NOTE_MAX} · Leave empty if none are known.</p>
            </FieldRow>
            <FieldRow label="Long-term conditions" htmlFor="card-conditions">
              <Textarea id="card-conditions" value={form.medical_conditions} maxLength={HEALTH_NOTE_MAX} placeholder="e.g. Asthma, sickle cell" onChange={(e) => set("medical_conditions", e.target.value)} />
              <p className="text-xs text-muted-foreground">{form.medical_conditions.length}/{HEALTH_NOTE_MAX} · Leave empty if none are known.</p>
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="Emergency contact name" htmlFor="card-ec-name">
                <Input id="card-ec-name" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
              </FieldRow>
              <FieldRow label="Emergency contact phone" htmlFor="card-ec-phone" error={tried ? phoneError : undefined}>
                <Input id="card-ec-phone" type="tel" value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
              </FieldRow>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form || saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- The section ---------------------------------------------------------------------------
export function FamilySection() {
  const q = useFamily();
  const person = useActivePatient();
  const remove = useRemoveFamilyMember();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [removing, setRemoving] = useState<FamilyMember | null>(null);
  const [verifying, setVerifying] = useState<{ id: string; justAdded: boolean } | null>(null);
  const list = q.data ?? [];
  const verifyMember = verifying ? list.find((m) => m.patient_id === verifying.id) ?? null : null;
  const today = lagosToday();

  // "Add family member" in the header switcher lands here with the form open.
  useEffect(() => {
    if (params.get("add-family") !== "1") return;
    setAdding(true);
    params.delete("add-family");
    setParams(params, { replace: true });
    document.getElementById("family")?.scrollIntoView({ behavior: "smooth" });
  }, [params, setParams]);

  // A locked member chosen in the header switcher, the dashboard banner and family
  // notifications land here with Verify open (?verify=<member id>).
  useEffect(() => {
    const id = params.get("verify");
    if (!id) return;
    setVerifying({ id, justAdded: false });
    params.delete("verify");
    setParams(params, { replace: true });
    document.getElementById("family")?.scrollIntoView({ behavior: "smooth" });
  }, [params, setParams]);

  async function confirmRemove() {
    const m = removing;
    if (!m) return;
    try {
      const result = await remove.mutateAsync(m.patient_id);
      toast.success(result.held_by_hospitals
        ? `${m.first_name} was removed. Hospitals that treated ${m.first_name} keep their records.`
        : `${m.first_name} was removed.`);
    } catch (e) {
      toast.error(dbMessage(e));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div id="family" className="scroll-mt-20 rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading font-bold"><Users className="h-4 w-4 text-primary" />Family</h3>
        <Button size="sm" onClick={() => setAdding(true)} disabled={list.length >= MAX_FAMILY}><Plus className="mr-1.5 h-4 w-4" />Add family member</Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Book visits and keep health records for your children and other family members, from your own account.</p>

      <QueryState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No family members yet. Add a child, parent or other family member to manage their health care here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((m) => {
              const showing = !person.isMe && person.patientId === m.patient_id;
              const note = turning18Note(m, today);
              const verify = verifyState(m);
              return (
                <li key={m.patient_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{m.first_name} {m.last_name}{showing && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Showing now</span>}</p>
                      <p className="text-sm text-muted-foreground">{[ageText(m.age) ? `Age ${ageText(m.age)}` : "", relationshipLabel(m.relationship)].filter(Boolean).join(" · ")}</p>
                      <VerifyBadge member={m} className="mt-1" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {verify.action && <Button size="sm" variant={verify.canUpload ? "default" : "outline"} onClick={() => setVerifying({ id: m.patient_id, justAdded: false })} aria-label={`${verify.action}: ${m.first_name}`}>{verify.action}</Button>}
                      {!showing && !verify.locked && <Button size="sm" variant="outline" onClick={() => { activePerson.set(m.patient_id); toast.info(`Showing ${m.first_name}`); }}>Show {m.first_name}</Button>}
                      {!verify.locked && <Button size="sm" variant="outline" onClick={() => setEditing(m)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Health card</Button>}
                      <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRemoving(m)} aria-label={`Remove ${m.first_name}`}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove
                      </Button>
                    </div>
                  </div>
                  {note && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm">{note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
      {list.length >= MAX_FAMILY && <p className="mt-3 text-xs text-muted-foreground">You can add up to {MAX_FAMILY} family members.</p>}

      <AddFamilyDialog open={adding} onOpenChange={setAdding} onAdded={(id) => setVerifying({ id, justAdded: true })} />
      <VerifyFamilyDialog member={verifyMember} justAdded={verifying?.justAdded} onClose={() => setVerifying(null)} />
      <EditHealthCardDialog patientId={editing?.patient_id ?? null} firstName={editing?.first_name ?? ""} open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }} />
      <AlertDialog open={!!removing} onOpenChange={(v) => { if (!v) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.first_name}?</AlertDialogTitle>
            <AlertDialogDescription>{removing ? removeExplanation(removing.first_name) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); confirmRemove(); }} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
