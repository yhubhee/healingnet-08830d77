// Complete profile (shown first until the required details are filled in) and Edit
// profile (?edit=1). Same fields, checks and messages as the website's
// src/pages/patient/CompleteProfile.tsx.
import { Camera, ImageIcon, ShieldCheck } from "@/components/icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { DateField, Field, SelectField } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Heading, ListSkeleton, Notice, Small } from "@/components/ui";
import { AvatarError, pickPhoto, uploadAvatar } from "@/lib/avatar";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { lagosToday } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import {
  BLOOD_GROUPS, compactPhone, GENOTYPES, missingPatientFields, NIGERIAN_STATES, PATIENT_UPDATE_COLUMNS, pick, validateProfile,
  type ProfileForm,
} from "@/shared/patientProfile";
import { space, useTheme } from "@/theme";

const GENDERS = [{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }];
const NOT_SURE = { value: "", label: "Not sure" };

export default function CompleteProfile() {
  const { colors } = useTheme();
  const { profile: p, signOut } = useSession();
  const params = useLocalSearchParams<{ edit?: string }>();
  const editing = params.edit === "1";
  const qc = useQueryClient();
  const toast = useToast();
  const online = useOnline();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!p || form) return;
    const s = (v: unknown) => (v == null ? "" : String(v));
    setForm({
      phone: s(p.phone), date_of_birth: s(p.date_of_birth), gender: s(p.gender), state: s(p.state), city: s(p.city),
      address: s(p.address), emergency_contact_name: s(p.emergency_contact_name), emergency_contact_phone: s(p.emergency_contact_phone),
      blood_group: s(p.blood_group), genotype: s(p.genotype), insurance_provider: s(p.insurance_provider), insurance_policy_number: s(p.insurance_policy_number),
    });
  }, [p, form]);

  if (!p || !form) {
    return <Screen title="Your profile"><ListSkeleton rows={4} height={120} /></Screen>;
  }

  const today = lagosToday();
  const errors = tried ? validateProfile(form, today) : {};
  const set = (k: keyof ProfileForm) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const firstTime = !editing && missingPatientFields(p).length > 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ["profile"] });

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
    if (Object.keys(validateProfile(form, today)).length) return toast.error("Check the highlighted fields.");
    setSaving(true);
    const opt = (v: string) => v.trim() || null;
    const patch = {
      phone: compactPhone(form.phone), date_of_birth: form.date_of_birth, gender: form.gender, state: form.state,
      city: form.city.trim(), address: form.address.trim(), emergency_contact_name: form.emergency_contact_name.trim(),
      emergency_contact_phone: compactPhone(form.emergency_contact_phone),
      blood_group: opt(form.blood_group), genotype: opt(form.genotype),
      insurance_provider: opt(form.insurance_provider), insurance_policy_number: opt(form.insurance_policy_number),
    };
    const { error } = await supabase.from("patients").update(pick(patch, PATIENT_UPDATE_COLUMNS) as never).eq("id", p!.id);
    setSaving(false);
    if (error) return toast.error(`Couldn't save your profile. ${error.message || friendlyError(error)}`);
    await refresh();
    toast.success(firstTime ? "Profile complete" : "Profile saved");
    if (firstTime || !router.canGoBack()) router.replace("/(tabs)");
    else router.back();
  }

  const stateOptions = [
    ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
    ...(form.state && !NIGERIAN_STATES.includes(form.state) ? [{ value: form.state, label: form.state }] : []),
  ];

  return (
    <Screen
      title={firstTime ? "Complete your profile" : "Edit your profile"}
      back={!firstTime}
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label={firstTime ? "Save and continue" : "Save changes"} onPress={save} loading={saving} disabled={!online} disabledReason={OFFLINE_ACTION} />
        </>
      }
    >
      <Body muted>
        {firstTime ? "Hospitals need these details to book and treat you. It takes about 2 minutes." : "Keep your details up to date so hospitals can reach you."}
      </Body>

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

      <Card style={{ gap: space.lg }}>
        <Heading>Emergency contact</Heading>
        <Field label="Name *" value={form.emergency_contact_name} onChangeText={set("emergency_contact_name")} error={errors.emergency_contact_name} />
        <Field label="Phone *" value={form.emergency_contact_phone} onChangeText={set("emergency_contact_phone")} keyboardType="phone-pad" error={errors.emergency_contact_phone} />
      </Card>

      <Card style={{ gap: space.lg }}>
        <Heading>Medical and insurance (optional)</Heading>
        <SelectField label="Blood group" value={form.blood_group} options={[NOT_SURE, ...BLOOD_GROUPS.map((b) => ({ value: b, label: b }))]} onChange={set("blood_group")} placeholder="Not sure" />
        <SelectField label="Genotype" value={form.genotype} options={[NOT_SURE, ...GENOTYPES.map((g) => ({ value: g, label: g }))]} onChange={set("genotype")} placeholder="Not sure" />
        <Field label="Insurance / HMO" value={form.insurance_provider} onChangeText={set("insurance_provider")} placeholder="e.g. NHIA, Hygeia" />
        <Field label="Policy number" value={form.insurance_policy_number} onChangeText={set("insurance_policy_number")} />
      </Card>

      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
        <ShieldCheck size={18} color={colors.textMuted} />
        <Small style={{ flex: 1 }}>Only hospitals you visit, and doctors treating you, can see these details.</Small>
      </View>
      {firstTime ? <Button label="Sign out" variant="ghost" onPress={signOut} /> : null}
    </Screen>
  );
}
