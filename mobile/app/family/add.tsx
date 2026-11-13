// Add a family member: name, date of birth, sex and relationship. Someone 18 or over needs
// the tick box saying the guardian has their permission. The database makes the same checks
// and its own messages are shown as written.
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { DateField, Field, SelectField } from "@/components/form";
import { Check } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Notice, Small, Strong } from "@/components/ui";
import { activePerson } from "@/lib/activePerson";
import { useAddFamilyMember } from "@/lib/family";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { lagosToday } from "@/shared/dates";
import { dbMessage } from "@/shared/errors";
import { EMPTY_FAMILY_FORM, needsPermission, permissionLabel, RELATIONSHIPS, validateFamilyForm, type FamilyForm } from "@/shared/family";
import { MIN_TOUCH, space, useTheme } from "@/theme";

const SEXES = [{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }];

export default function AddFamilyMember() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const add = useAddFamilyMember();
  const [form, setForm] = useState<FamilyForm>(EMPTY_FAMILY_FORM);
  const [tried, setTried] = useState(false);

  const today = lagosToday();
  const adult = needsPermission(form.date_of_birth, today);
  const errors = tried ? validateFamilyForm(form, today) : {};
  const set = <K extends keyof FamilyForm>(k: K) => (v: FamilyForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const tick = permissionLabel(form.first_name);

  async function save() {
    setTried(true);
    if (Object.keys(validateFamilyForm(form, today)).length) return toast.error("Check the highlighted fields.");
    try {
      const id = await add.mutateAsync(form);
      toast.success(`${form.first_name.trim()} added`);
      // Straight to the new person, so the next thing done is for them.
      activePerson.set(id);
      if (router.canGoBack()) router.back(); else router.replace("/(tabs)");
    } catch (e) {
      toast.error(dbMessage(e));
    }
  }

  return (
    <Screen title="Add family member" back
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label="Add family member" onPress={save} loading={add.isPending} disabled={!online} disabledReason={OFFLINE_ACTION} />
        </>
      }>
      <Body muted>You will manage their visits, prescriptions and records from your account.</Body>
      <Card style={{ gap: space.lg }}>
        <Field label="First name *" value={form.first_name} onChangeText={set("first_name")} autoCapitalize="words" maxLength={80} error={errors.first_name} />
        <Field label="Last name *" value={form.last_name} onChangeText={set("last_name")} autoCapitalize="words" maxLength={80} error={errors.last_name} />
        <DateField label="Date of birth *" value={form.date_of_birth} onChange={set("date_of_birth")} min="1900-01-01" max={today} error={errors.date_of_birth} />
        <SelectField label="Sex *" value={form.gender} options={SEXES} onChange={set("gender")} error={errors.gender} />
        <SelectField label="Relationship to you *" value={form.relationship} options={[...RELATIONSHIPS]} onChange={set("relationship")} error={errors.relationship}
          hint="For example, choose Child if you are their parent." />
      </Card>

      {adult ? (
        <Card style={{ gap: space.sm, borderColor: errors.consent ? colors.danger : colors.border }}>
          <Small muted={false}>{form.first_name.trim() || "This person"} is 18 or older, so you need their permission.</Small>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.consent }} accessibilityLabel={tick}
            onPress={() => set("consent")(!form.consent)}
            style={{ minHeight: MIN_TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center",
              borderColor: form.consent ? colors.primary : errors.consent ? colors.danger : colors.border, backgroundColor: form.consent ? colors.primary : "transparent" }}>
              {form.consent ? <Check size={18} color={colors.onPrimary} /> : null}
            </View>
            <Strong style={{ flex: 1 }}>{tick}</Strong>
          </Pressable>
          {errors.consent ? <Small color={colors.danger} accessibilityRole="alert">{errors.consent}</Small> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
