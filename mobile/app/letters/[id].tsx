// One letter: who issued it, when, and what it says. Share as PDF (the same parts as the
// website's download).
import { Award, FileDown } from "@/components/icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, EmptyState, Heading, Notice, Small, Strong } from "@/components/ui";
import { sharePdf, useLetters } from "@/lib/health";
import { openUrl } from "@/lib/web";
import { fmtLongDate } from "@/shared/dates";
import { LETTER_STATUS_TEXT, letterDoctor, letterHtml, letterLabel, letterStatus } from "@/shared/records";
import { space } from "@/theme";

const TONE = { issued: "success", pending: "warning", expired: "neutral" } as const;

export default function LetterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const q = useLetters();
  const [sharing, setSharing] = useState(false);
  const l = (q.data ?? []).find((x) => x.id === id);
  const status = l ? letterStatus(l) : "issued";

  async function share() {
    if (!l) return;
    setSharing(true);
    try {
      if ((await sharePdf(letterHtml(l), "Share letter")) === "unavailable") toast.error("Sharing isn't available on this phone.");
    } catch {
      toast.error("We couldn't make the PDF. Please try again.");
    }
    setSharing(false);
  }

  return (
    <Screen title="Letter" back onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryState query={q}>
        {!l ? (
          <EmptyState icon={Award} title="Letter not found" text="It may have been removed. Pull down to refresh." />
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <Chip label={LETTER_STATUS_TEXT[status]} tone={TONE[status]} />
              <Heading>{l.title || letterLabel(l)}</Heading>
              {l.title && l.title !== letterLabel(l) ? <Small>{letterLabel(l)}</Small> : null}
            </View>
            <Card style={{ gap: space.md }}>
              <View><Small>Issued</Small><Strong>{fmtLongDate(l.issued_at)}</Strong></View>
              {l.valid_until ? <View><Small>Valid until</Small><Strong>{fmtLongDate(l.valid_until)}</Strong></View> : null}
              <View><Small>Doctor</Small><Strong>{letterDoctor(l) ?? "—"}</Strong>{l.doctors?.specialty ? <Small>{l.doctors.specialty}</Small> : null}</View>
              <View><Small>Hospital</Small><Strong>{l.hospitals?.name ?? "—"}</Strong>{l.hospitals?.address ? <Small>{l.hospitals.address}</Small> : null}</View>
            </Card>
            {status === "pending" ? (
              <Notice tone="warning" text="Your doctor hasn't issued this letter yet. We'll notify you when it is ready." />
            ) : (
              <>
                {status === "expired" ? <Notice text="This letter is past its valid-until date. Ask your doctor for a new one if you still need it." /> : null}
                <Card><Body selectable>{l.body || "This letter has no text."}</Body></Card>
                <Button label="Share as PDF" icon={FileDown} onPress={share} loading={sharing} />
                {l.pdf_url ? <Button label="Open the original PDF" variant="secondary" onPress={() => openUrl(l.pdf_url!)} /> : null}
              </>
            )}
          </>
        )}
      </QueryState>
    </Screen>
  );
}
