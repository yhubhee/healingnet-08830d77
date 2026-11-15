// Complete profile (shown first until the required details are filled in) and Edit
// profile (?edit=1). Same fields, checks and messages as the website's
// src/pages/patient/CompleteProfile.tsx.
import { Camera, ImageIcon, ShieldCheck } from "@/components/icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { DateField, Field, SelectField } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Heading, ListSkeleton, Notice, Small } from "@/components/ui";
import { AvatarError, pickPhoto, uploadAvatar } from "@/lib/avatar";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useMemberProfile, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { lagosToday } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import {
  BLOOD_GROUPS, compactPhone, GENOTYPES, HEALTH_NOTE_MAX, isNigerianPhone, NIGERIAN_STATES, PATIENT_UPDATE_COLUMNS, pick, profileProgress, validateProfile,
  type ProfileErrors, type ProfileForm,
} from "@/shared/patientProfile";
import { space, useTheme } from "@/theme";

const GENDERS = [{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }];
const NOT_SURE = { value: "", label: "Not sure" };

export default function CompleteProfile() {
  const { colors } = useTheme();
  const { profile: own, profileComplete, signOut } = useSession();
  const params = useLocalSearchParams<{ edit?: string; person?: string }>();
  // ?person=<patient id>: a family member's health card. The guardian edits it through
  // the same form; only the health card and emergency contact are asked for.
  const memberId = params.person || null;
  const member = useMemberProfile(memberId);
  const p = memberId ? member.data : own;
  const forMember = !!memberId;
  const qc = useQueryClient();
  const toast = useToast();
  const online = useOnline();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Shown first, with no way out except Sign out, until the required details are saved.
  // The session decides (the local check and the server's my_profile_status).
  const firstTime = !memberId && profileComplete === false;

  // Android's back button does nothing here while the profile is incomplete.
  useFocusEffect(useCallback(() => {
    if (!firstTime) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [firstTime]));

  useEffect(() => {
    if (!p || form) return;
    const s = (v: unknown) => (v == null ? "" : String(v));
    setForm({
      phone: s(p.phone), date_of_birth: s(p.date_of_birth), gender: s(p.gender), state: s(p.state), city: s(p.city),
      address: s(p.address), emergency_contact_name: s(p.emergency_contact_name), emergency_contact_phone: s(p.emergency_contact_phone),
      blood_group: s(p.blood_group), genotype: s(p.genotype), insurance_provider: s(p.insurance_provider), insurance_policy_number: s(p.insurance_policy_number),
      allergies: s(p.allergies), medical_conditions: s(p.medical_conditions),
    });
  }, [p, form]);

  if (!p || !form) {
    return <Screen title={forMember ? "Health card" : "Your profile"} back={forMember}><ListSkeleton rows={4} height={120} /></Screen>;
  }

  const today = lagosToday();
  /** A family member has no phone or address of their own to check: only what the form shows. */
  const validate = (f: ProfileForm): ProfileErrors => {
    if (!forMember) return validateProfile(f, today);
    const e: ProfileErrors = {};
    if (f.emergency_contact_phone.trim() && !isNigerianPhone(f.emergency_contact_phone)) e.emergency_contact_phone = "Enter a Nigerian number, e.g. 0803 123 4567.";
    if (f.allergies.trim().length > HEALTH_NOTE_MAX) e.allergies = `Keep this under ${HEALTH_NOTE_MAX} characters.`;
    if (f.medical_conditions.trim().length > HEALTH_NOTE_MAX) e.medical_conditions = `Keep this under ${HEALTH_NOTE_MAX} characters.`;
    return e;
  };
  const errors = tried ? validate(form) : {};
  const set = (k: keyof ProfileForm) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const progress = profileProgress(form, today);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["profile-status"] })]);

  async function changePhoto(source: "camera" | "gallery") {
    try {
      const asset = await pickPhoto(source);
      if (!asset) return;
      setPhotoBusy(true);
      const url = await uploadAvatar(asset);
      const { error } = await supabase.from("patients").update(pick({ profile_image_url: url }, PATIENT_UPDATE_COLUMNS) as never).eq("id", p!.id);
      if (error) throw error;
      await refresh();
      toast.success("Photo saved");
    } catch (e) {
      toast.error(e instanceof AvatarError ? e.message : `Couldn't save the photo. ${friendlyError(e)}`);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    setTried(true);
    if (!form) return;
    if (Object.keys(validate(form)).length) return toast.error("Check the highlighted fields.");
    setSaving(true);
    const opt = (v: string) => v.trim() || null;
    const patch = forMember ? {
      emergency_contact_name: opt(form.emergency_contact_name),
      emergency_contact_phone: form.emergency_contact_phone.trim() ? compactPhone(form.emergency_contact_phone) : null,
      blood_group: opt(form.blood_group), genotype: opt(form.genotype),
      allergies: opt(form.allergies), medical_conditions: opt(form.medical_conditions),
    } : {
      phone: compactPhone(form.phone), date_of_birth: form.date_of_birth, gender: form.gender, state: form.state,
      city: form.city.trim(), address: form.address.trim(), emergency_contact_name: form.emergency_contact_name.trim(),
      emergency_contact_phone: compactPhone(form.emergency_contact_phone),
      blood_group: opt(form.blood_group), genotype: opt(form.genotype),
      insurance_provider: opt(form.insurance_provider), insurance_policy_number: opt(form.insurance_policy_number),
      allergies: opt(form.allergies), medical_conditions: opt(form.medical_conditions),
    };
    const { error } = await supabase.from("patients").update(pick(patch, PATIENT_UPDATE_COLUMNS) as never).eq("id", p!.id);
    setSaving(false);
    if (error) return toast.error(`Couldn't save ${forMember ? "the health card" : "your profile"}. ${error.message || friendlyError(error)}`);
    await refresh();
    toast.success(firstTime ? "Profile complete" : forMember ? "Health card saved" : "Profile saved");
    if (firstTime || !router.canGoBack()) router.replace("/(tabs)");
    else router.back();
  }

  const stateOptions = [
    ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
    ...(form.state && !NIGERIAN_STATES.includes(form.state) ? [{ value: form.state, label: form.state }] : []),
  ];

  return (
    <Screen
      title={firstTime ? "Complete your profile" : forMember ? `${p.first_name}'s health card` : "Edit your profile"}
      back={!firstTime}
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label={firstTime ? "Save and continue" : "Save changes"} onPress={save} loading={saving} disabled={!online} disabledReason={OFFLINE_ACTION} />
        </>
      }
    >
      <Body muted>
        {firstTime ? "Hospitals need these details to book and treat you. It takes about 2 minutes."
          : forMember ? `Doctors treating ${p.first_name} see this. Keep it up to date.`
          : "Keep your details up to date so hospitals can reach you."}
      </Body>

      {firstTime ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={`${progress.text}. Required details`}
          accessibilityValue={{ min: 0, max: progress.total, now: progress.done }} style={{ gap: space.xs }}>
          <Small muted={false}>{progress.text}</Small>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" }}>
            <View style={{ width: `${(progress.done / progress.total) * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          </View>
        </View>
      ) : null}

      {forMember ? null : (
      <>
      <Card style={{ gap: space.lg }}>
        <Heading>About you</Heading>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <Avatar url={p.profile_image_url} first={p.first_name} last={p.last_name} size={72} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Button small variant="secondary" icon={Camera} label="Take a photo" onPress={() => changePhoto("camera")} loading={photoBusy} disabled={!online} disabledReason={OFFLINE_ACTION} />
            <Button small variant="secondary" icon={ImageIcon} label="Choose from gallery" onPress={() => changePhoto("gallery")} disabled={!online || photoBusy} disabledReason={OFFLINE_ACTION} />
          </View>
        </View>
        <Field label="Phone number *" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" placeholder="0803 123 4567" error={errors.phone} />
        <DateField label="Date of birth *" value={form.date_of_birth} onChange={set("date_of_birth")} min="1900-01-01" max={today} error={errors.date_of_birth} />
        <SelectField label="Gender *" value={form.gender} options={GENDERS} onChange={set("gender")} error={errors.gender} />
      </Card>

      <Card style={{ gap: space.lg }}>
        <Heading>Where you live</Heading>
        <SelectField label="State *" value={form.state} options={stateOptions} onChange={set("state")} error={errors.state} />
        <Field label="City / town *" value={form.city} onChangeText={set("city")} error={errors.city} />
        <Field label="Address *" value={form.address} onChangeText={set("address")} autoComplete="street-address" error={errors.address} />
      </Card>
      </>
      )}

      <Card style={{ gap: space.lg }}>
        <Heading>Emergency contact</Heading>
        <Field label={forMember ? "Name" : "Name *"} value={form.emergency_contact_name} onChangeText={set("emergency_contact_name")} error={errors.emergency_contact_name}
          hint={forMember ? "Who to call in an emergency. This can be you." : undefined} />
        <Field label={forMember ? "Phone" : "Phone *"} value={form.emergency_contact_phone} onChangeText={set("emergency_contact_phone")} keyboardType="phone-pad" error={errors.emergency_contact_phone} />
      </Card>

      <Card style={{ gap: space.lg }}>
        <Heading>{forMember ? "Health card" : "Health card (optional)"}</Heading>
        <Field label="Allergies" value={form.allergies} onChangeText={set("allergies")} multiline maxLength={HEALTH_NOTE_MAX} error={errors.allergies}
          placeholder="e.g. Penicillin, peanuts" hint={`${form.allergies.length}/${HEALTH_NOTE_MAX} · Leave empty if none are known.`} />
        <Field label="Long-term conditions" value={form.medical_conditions} onChangeText={set("medical_conditions")} multiline maxLength={HEALTH_NOTE_MAX} error={errors.medical_conditions}
          placeholder="e.g. Asthma, high blood pressure, sickle cell" hint={`${form.medical_conditions.length}/${HEALTH_NOTE_MAX} · Leave empty if none are known.`} />
      </Card>

      <Card style={{ gap: space.lg }}>
        <Heading>{forMember ? "Blood group and genotype" : "Medical and insurance (optional)"}</Heading>
        <SelectField label="Blood group" value={form.blood_group} options={[NOT_SURE, ...BLOOD_GROUPS.map((b) => ({ value: b, label: b }))]} onChange={set("blood_group")} placeholder="Not sure" />
        <SelectField label="Genotype" value={form.genotype} options={[NOT_SURE, ...GENOTYPES.map((g) => ({ value: g, label: g }))]} onChange={set("genotype")} placeholder="Not sure" />
        {forMember ? null : (
          <>
            <Field label="Insurance / HMO" value={form.insurance_provider} onChangeText={set("insurance_provider")} placeholder="e.g. NHIA, Hygeia" />
            <Field label="Policy number" value={form.insurance_policy_number} onChangeText={set("insurance_policy_number")} />
          </>
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
        <ShieldCheck size={18} color={colors.textMuted} />
        <Small style={{ flex: 1 }}>Only hospitals you visit, and doctors treating you, can see these details.</Small>
      </View>
      {firstTime ? <Button label="Sign out" variant="ghost" onPress={signOut} /> : null}
    </Screen>
  );
}
