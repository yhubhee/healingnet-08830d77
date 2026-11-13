// One lab result: every parameter with its value, unit and reference range. A value outside
// its range says so in words ("High", "Low"), never by colour alone. Share as PDF.
import { FileDown, FlaskConical } from "@/components/icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, Divider, EmptyState, Heading, Label, Notice, Small, Strong } from "@/components/ui";
import { sharePdf, useLabResults, useMarkLabViewed } from "@/lib/health";
import { usePatient } from "@/lib/session";
import { fmtLongDate } from "@/shared/dates";
import { isOutOfRange, labHtml, labIsNew, labIsReady, labStatusText, labTests, labTitle, rangeLabel, rangeWord, sortedParameters } from "@/shared/labs";
import { space } from "@/theme";

export default function LabResultDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { profile } = usePatient();
  const q = useLabResults();
  const markViewed = useMarkLabViewed();
  const [sharing, setSharing] = useState(false);
  const r = (q.data ?? []).find((x) => x.id === id);
  const ready = !!r && labIsReady(r);

  // Opening a finished result records that the patient has seen it and clears "New".
  const isNew = !!r && labIsNew(r);
  useEffect(() => { if (isNew) markViewed(id); }, [isNew, id, markViewed]);

  async function share() {
    if (!r) return;
    setSharing(true);
    try {
      const name = profile ? `${profile.first_name} ${profile.last_name}` : "";
      if ((await sharePdf(labHtml(r, name), "Share lab report")) === "unavailable") toast.error("Sharing isn't available on this phone.");
    } catch {
      toast.error("We couldn't make the PDF. Please try again.");
    }
    setSharing(false);
  }

  const tests = r ? labTests(r) : [];

  return (
    <Screen title="Lab result" back updatedAt={q.dataUpdatedAt || undefined} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryState query={q}>
        {!r ? (
          <EmptyState icon={FlaskConical} title="Result not found" text="It may have been removed. Pull down to refresh." />
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <Chip label={labStatusText(r)} tone={!ready ? "warning" : labStatusText(r) === "Ready" ? "success" : "danger"} />
              <Heading>{labTitle(r)}</Heading>
              <Small>{[r.hospitals?.name, fmtLongDate(r.created_at)].filter(Boolean).join(" · ")}</Small>
            </View>
            {!ready ? <Notice tone="warning" text="The lab hasn't finished this yet. We'll notify you when the results are ready." /> : null}

            {tests.length === 0 ? <Card><Body muted>No test entries yet.</Body></Card> : tests.map((t) => {
              const params = sortedParameters(t);
              return (
                <Card key={t.id} style={{ gap: space.md }}>
                  <View>
                    <Strong>{t.test_name}</Strong>
                    {t.category_name ? <Small>{t.category_name}</Small> : null}
                  </View>
                  {params.length === 0 ? <Small>No values entered yet.</Small> : params.map((p, i) => {
                    const word = rangeWord(p);
                    const out = isOutOfRange(word);
                    return (
                      <View key={p.id} style={{ gap: 4 }} accessible
                        accessibilityLabel={`${p.parameter_name}: ${p.result_value ?? "no value"} ${p.unit_snapshot ?? ""}. ${word ?? ""}. Reference range ${p.ref_range_snapshot || "not given"}`}>
                        {i > 0 ? <View style={{ marginBottom: space.sm }}><Divider /></View> : null}
                        <Label>{p.parameter_name}</Label>
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
                          <Strong style={{ fontSize: 18 }}>{p.result_value ?? "—"}{p.unit_snapshot ? ` ${p.unit_snapshot}` : ""}</Strong>
                          {word ? <Chip label={rangeLabel(word)} tone={out ? "danger" : "success"} /> : null}
                        </View>
                        <Small>Reference range: {p.ref_range_snapshot || "not given"}</Small>
                      </View>
                    );
                  })}
                </Card>
              );
            })}

            {r.notes ? <Card style={{ gap: 4 }}><Label>Notes from the lab</Label><Body>{r.notes}</Body></Card> : null}
            <Small>These results are for you and your doctor to go through together. A value outside the range is not always a problem.</Small>
            {tests.length > 0 ? <Button label="Share as PDF" icon={FileDown} variant="secondary" onPress={share} loading={sharing} /> : null}
          </>
        )}
      </QueryState>
    </Screen>
  );
}
