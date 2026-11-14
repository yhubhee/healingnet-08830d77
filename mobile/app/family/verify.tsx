// Verify a family member: choose which document proves the relationship, take a photo or
// choose a file, look at it, then send it. A HealingNet team member checks it. Reached
// straight after adding someone ("Later" skips it), from the Family screen, from Home's
// banner, and when a locked member is chosen in "Who is this for?".
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Camera, Check, FileText, FileUp, ImageIcon, UserRound } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, EmptyState, Label, ListSkeleton, Notice, Small, Strong } from "@/components/ui";
import { VerifyBadge } from "@/components/VerifyBadge";
import { useFamily } from "@/lib/family";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useScreenReady } from "@/lib/perf";
import { useSession } from "@/lib/session";
import { chooseDocument, DocumentError, useSubmitFamilyDocument, type ChosenDocument } from "@/lib/verification";
import { dbMessage } from "@/shared/errors";
import { relationshipLabel } from "@/shared/family";
import {
  DOCUMENT_PRIVACY, documentsFor, dueDayTime, explainVerify, fileSizeText, verifyState, type DocumentType,
} from "@/shared/verification";
import { MIN_TOUCH, radius, space, useTheme } from "@/theme";

export default function VerifyFamilyMember() {
  const { colors } = useTheme();
  const { id, added } = useLocalSearchParams<{ id: string; added?: string }>();
  const toast = useToast();
  const online = useOnline();
  const { userId } = useSession();
  const family = useFamily();
  const submit = useSubmitFamilyDocument();
  const [type, setType] = useState<DocumentType | null>(null);
  const [doc, setDoc] = useState<ChosenDocument | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const m = family.data?.find((x) => x.patient_id === id);
  useScreenReady("/family/verify", family.data !== undefined);

  const leave = () => {
    if (added) router.replace("/(tabs)");
    else if (router.canGoBack()) router.back();
    else router.replace("/family");
  };

  if (!m) {
    return (
      <Screen title="Verify family member" back onBack={leave}>
        {family.isPending ? <ListSkeleton /> : (
          <EmptyState icon={UserRound} title="Not in your family list" text="They may have been removed." actionLabel="Back to Family" onAction={() => router.replace("/family")} />
        )}
      </Screen>
    );
  }

  const name = m.first_name;
  const state = verifyState(m);
  const options = documentsFor(m.relationship);

  async function choose(source: "camera" | "gallery" | "file") {
    setProblem(null);
    setChoosing(true);
    try {
      const chosen = await chooseDocument(source);
      if (chosen) setDoc(chosen);
    } catch (e) {
      setProblem(e instanceof DocumentError ? e.message : "We couldn't open that. Try again.");
    }
    setChoosing(false);
  }

  async function send() {
    if (!type) return setProblem("Choose which document this is.");
    if (!doc || !userId) return setProblem("Take a photo or choose a file first.");
    setProblem(null);
    try {
      await submit.mutateAsync({ userId, patientId: m!.patient_id, type, doc });
      setDoc(null);
      toast.success(`Sent. We'll tell you when ${name}'s document has been checked.`);
      leave();
    } catch (e) {
      // The database's own message, as it is ("That document does not prove this relationship…").
      setProblem(dbMessage(e));
    }
  }

  // Nothing to send: already verified, or a document is being checked.
  if (!state.canUpload) {
    return (
      <Screen title={`Verify ${name}`} back onBack={leave} onRefresh={() => family.refetch()} refreshing={family.isRefetching}>
        <Card style={{ gap: space.md }}>
          <VerifyBadge member={m} lines={4} />
          <Body>{state.kind === "verified"
            ? `${name}'s document was accepted. There is nothing more to do.`
            : `We have ${name}'s document. A HealingNet team member checks it, usually within 2 working days. We'll send you a notification.`}</Body>
          {state.kind === "pending" && state.locked ? <Notice tone="warning" text={`${name} stays locked until the document is accepted.`} /> : null}
        </Card>
        <Button label="Done" onPress={leave} />
      </Screen>
    );
  }

  return (
    <Screen title={`Verify ${name}`} back onBack={leave}
      footer={
        <>
          {problem ? <Notice tone="danger" text={problem} /> : null}
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label="Send for checking" icon={FileUp} onPress={send} loading={submit.isPending} disabled={!online || !doc || !type}
            disabledReason={!online ? OFFLINE_ACTION : "Choose the document type and add a photo or file first"} />
          <Small style={{ textAlign: "center" }}>{DOCUMENT_PRIVACY}</Small>
          {added ? <Button label="Later" variant="ghost" onPress={leave} accessibilityLabel={`Verify ${name} later`} /> : null}
        </>
      }>
      <Body>{explainVerify(name)}</Body>
      <Card style={{ gap: space.sm }}>
        <VerifyBadge member={m} lines={4} />
        {state.kind === "due" ? <Small>{name} is locked on {dueDayTime(m.verification_due_at)} if no document has been sent.</Small> : null}
        {state.kind === "rejected" ? <Small>Send a different document, or a clearer copy of the same one.</Small> : null}
      </Card>

      <Card style={{ gap: space.xs }}>
        <Label>Which document? ({relationshipLabel(m.relationship)})</Label>
        <View accessibilityRole="radiogroup">
          {options.map((o) => {
            const chosen = type === o.value;
            return (
              <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: chosen }} accessibilityLabel={o.label}
                onPress={() => { setType(o.value); setProblem(null); }}
                style={{ minHeight: MIN_TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center",
                  borderColor: chosen ? colors.primary : colors.border, backgroundColor: chosen ? colors.primary : "transparent" }}>
                  {chosen ? <Check size={16} color={colors.onPrimary} /> : null}
                </View>
                <Strong style={{ flex: 1 }}>{o.label}</Strong>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {doc ? (
        <Card style={{ gap: space.md }}>
          <Label>Check it before sending</Label>
          {doc.isImage ? (
            <Image source={{ uri: doc.uri }} resizeMode="contain" accessibilityLabel="The photo you are about to send"
              style={{ width: "100%", height: 320, borderRadius: radius.input, backgroundColor: colors.surface }} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.input, backgroundColor: colors.surface }}>
              <FileText size={28} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Strong numberOfLines={2}>{doc.name}</Strong>
                <Small>PDF · {fileSizeText(doc.bytes.byteLength)}</Small>
              </View>
            </View>
          )}
          <Small>Make sure every name and date can be read and nothing is cut off.</Small>
          <Button small label="Choose a different one" variant="secondary" onPress={() => setDoc(null)} />
        </Card>
      ) : (
        <Card style={{ gap: space.sm }}>
          <Label>Add the document</Label>
          <Button label="Take a photo" icon={Camera} onPress={() => choose("camera")} loading={choosing} />
          <Button label="Choose a photo" icon={ImageIcon} variant="secondary" onPress={() => choose("gallery")} disabled={choosing} />
          <Button label="Choose a file (PDF or image)" icon={FileText} variant="secondary" onPress={() => choose("file")} disabled={choosing} />
          <Small>Photos are made smaller before sending. Files can be up to 5 MB.</Small>
        </Card>
      )}
    </Screen>
  );
}
