// My profile, read-only (src/pages/patient/Profile.tsx). Edit opens the profile form.
import { Pencil, UserRound } from "@/components/icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Screen } from "@/components/Screen";
import { Button, Card, EmptyState, Heading, IconButton, Label, ListSkeleton, Small, Strong } from "@/components/ui";
import { useSession } from "@/lib/session";
import { fmtLongDate } from "@/shared/dates";
import { space } from "@/theme";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card style={{ gap: space.md }}><Label>{title}</Label>{children}</Card>;
}
function Item({ label, value }: { label: string; value?: string | null }) {
  return <View><Small>{label}</Small><Strong>{value || "—"}</Strong></View>;
}

export default function Profile() {
  const { profile: p, retry } = useSession();
  const edit = () => router.push("/complete-profile?edit=1");
  return (
    <Screen title="My profile" back onRefresh={retry} right={<IconButton icon={Pencil} label="Edit profile" onPress={edit} />}>
      {p === undefined ? <ListSkeleton /> : p === null ? (
        <EmptyState icon={UserRound} title="Profile not found" text="Pull down to try again." actionLabel="Try again" onAction={retry} />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Avatar url={p.profile_image_url} first={p.first_name} last={p.last_name} size={76} />
            <View style={{ flex: 1 }}>
              <Heading>{p.first_name} {p.last_name}</Heading>
              {p.email ? <Small>{p.email}</Small> : null}
              {p.phone ? <Small>{p.phone}</Small> : null}
            </View>
          </View>
          <Section title="Personal information">
            <Item label="Date of birth" value={p.date_of_birth ? fmtLongDate(p.date_of_birth) : null} />
            <Item label="Gender" value={p.gender} />
            <Item label="Address" value={p.address} />
            <Item label="City / State" value={[p.city, p.state].filter(Boolean).join(", ")} />
          </Section>
          <Section title="Medical information">
            <Item label="Blood group" value={p.blood_group} />
            <Item label="Genotype" value={p.genotype} />
          </Section>
          <Section title="Emergency contact">
            <Item label="Name" value={p.emergency_contact_name} />
            <Item label="Phone" value={p.emergency_contact_phone} />
          </Section>
          <Section title="Insurance / NHIS">
            <Item label="Provider" value={p.insurance_provider} />
            <Item label="Policy number" value={p.insurance_policy_number} />
          </Section>
          <Button label="Edit profile" icon={Pencil} onPress={edit} />
        </>
      )}
    </Screen>
  );
}
