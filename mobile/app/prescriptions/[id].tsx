// One prescription (src/components/patient/rx/*): the QR on white, the code, the
// medicines, the doctor, pharmacy requests, medicine checks and "Wasn't me?". The
// document comes from the saved list, so the QR and details also show offline.
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Copy, FileDown, Send, ShieldCheck, Star } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Field } from "@/components/form";
import { QueryState } from "@/components/QueryState";
import { PharmacyPickerSheet, RatePharmacySheet } from "@/components/RxSheets";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, Divider, EmptyState, Heading, Label, LinkText, Mono, Notice, Small, Strong } from "@/components/ui";
import { useRefreshRx, useRxDocuments, useRxExtras } from "@/lib/data";
import { WEB_URL } from "@/lib/env";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { shareRxPdf } from "@/lib/rxPdf";
import { usePatient } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { openUrl } from "@/lib/web";
import { fmtDateTime, fmtLongDate } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { verifyUrl } from "@/shared/links";
import {
  CHECK_LABEL, FAKE_THANKS, formatKobo, NAFDAC_GREENBOOK, NOT_VALID_TEXT, OPEN_REQUEST, prescriberName, REQUEST_LABEL, REQUEST_TONE,
  RX_TONE, rxStatusLabel, type CheckResult, type PatientRequest, type RxItem,
} from "@/shared/pharmacy";
import { MIN_TOUCH, QR_BACKGROUND, QR_FOREGROUND, space, useTheme } from "@/theme";

export default function PrescriptionDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const online = useOnline();
  const { profile } = usePatient();
  const docs = useRxDocuments();
  const extras = useRxExtras();
  const refresh = useRefreshRx();
  const [pick, setPick] = useState(false);
  const [rate, setRate] = useState<PatientRequest | null>(null);
  const [sharing, setSharing] = useState(false);

  const doc = (docs.data ?? []).find((d) => d.document_id === id);
  const code = doc?.code ?? "";
  const items = doc?.items ?? [];
  const dispenses = doc?.dispenses ?? [];
  const requests = (extras.data?.requests ?? []).filter((r) => r.rx_document_id === id);
  const reviews = extras.data?.reviews ?? {};
  const checks = extras.data?.checks ?? {};

  async function copy() {
    try {
      await Clipboard.setStringAsync(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy. Read the code out instead.");
    }
  }

  async function sharePdf() {
    if (!doc) return;
    setSharing(true);
    try {
      if ((await shareRxPdf(doc)) === "unavailable") toast.error("Sharing isn't available on this phone.");
    } catch {
      toast.error("We couldn't make the PDF. Please try again.");
    }
    setSharing(false);
  }

  function cancelRequest(r: PatientRequest) {
    Alert.alert("Cancel this request?", `${r.pharmacies?.name ?? "The pharmacy"} will be told you no longer need it.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Yes, cancel", style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("rx_request_cancel", { p_request_id: r.id });
          if (error) return toast.error(friendlyError(error));
          toast.success("Request cancelled");
          refresh();
        },
      },
    ]);
  }

  function notMe(prescriptionId: string) {
    Alert.alert("Report a dispense you didn't make?", "HealingNet will review it with the pharmacy. You can also report to NAFDAC directly.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report it",
        onPress: async () => {
          const { error } = await supabase.rpc("record_medicine_check", {
            p_prescription_id: prescriptionId, p_result: "suspected_fake", p_details: "Dispense not made by me",
          });
          if (error) return toast.error(friendlyError(error));
          toast.success(FAKE_THANKS);
          refresh();
        },
      },
    ]);
  }

  return (
    <Screen title="Prescription" back updatedAt={docs.dataUpdatedAt || undefined} onRefresh={refresh} refreshing={docs.isRefetching}>
      <QueryState query={docs}>
        {!doc ? (
          <EmptyState icon={ShieldCheck} title="Prescription not found" text="It may have been removed. Pull down to refresh." />
        ) : (
          <>
            <Chip label={rxStatusLabel(doc)} tone={RX_TONE[doc.status]} />
            {doc.status === "not_valid" ? <Notice tone="warning" text={NOT_VALID_TEXT} /> : null}

            {/* The QR always sits on white, in dark mode too. */}
            <Card style={{ alignItems: "center", gap: space.md }}>
              <Small style={{ textAlign: "center" }}>Show this at the pharmacy. The pharmacist scans it to check your prescription.</Small>
              {code ? (
                <View style={{ backgroundColor: QR_BACKGROUND, padding: space.lg, borderRadius: 16 }} accessible accessibilityRole="image" accessibilityLabel={`QR code for prescription ${code}`}>
                  <QRCode value={verifyUrl(WEB_URL, code)} size={232} backgroundColor={QR_BACKGROUND} color={QR_FOREGROUND} ecl="M" />
                </View>
              ) : null}
              <Mono selectable accessibilityLabel={`Code ${code.split("").join(" ")}`} style={{ textAlign: "center" }}>{code}</Mono>
              <View style={{ flexDirection: "row", gap: space.sm, alignSelf: "stretch" }}>
                <Button label="Copy" icon={Copy} variant="secondary" style={{ flex: 1 }} onPress={copy} accessibilityLabel="Copy the code" />
                <Button label="Share as PDF" icon={FileDown} variant="secondary" style={{ flex: 1 }} onPress={sharePdf} loading={sharing} />
              </View>
            </Card>

            {doc.status === "valid" ? (
              <>
                <Button label="Get it from a pharmacy" icon={Send} onPress={() => setPick(true)} disabled={!online} disabledReason={OFFLINE_ACTION} />
                {!online ? <Notice tone="warning" text="You're offline. Sending to a pharmacy needs the internet; the QR and code above still work." /> : null}
              </>
            ) : null}

            <Heading>Medicines</Heading>
            <Card style={{ gap: space.md }}>
              {items.map((it, i) => (
                <View key={it.prescription_id} style={{ gap: 4 }}>
                  {i > 0 ? <View style={{ marginBottom: space.sm }}><Divider /></View> : null}
                  <Strong>{it.drug_name}</Strong>
                  <Small>{it.status === "cancelled" ? "Cancelled" : `${it.remaining} of ${1 + (it.refills_allowed ?? 0)} left`}</Small>
                  <Body muted>{[it.dosage, it.frequency, it.duration].filter(Boolean).join(" · ") || "No dose given"}</Body>
                  {it.instructions ? <Small style={{ fontStyle: "italic" }}>“{it.instructions}”</Small> : null}
                  {dispenses.filter((d) => d.prescription_id === it.prescription_id).map((d, n) => (
                    <View key={n}>
                      <Small muted={false}>Dispensed at {d.pharmacy} by {d.pharmacist} on {fmtDateTime(d.at)}{d.is_refill ? " (refill)" : ""}.</Small>
                      <LinkText label="Wasn't me?" color={colors.danger} onPress={() => notMe(it.prescription_id)} />
                    </View>
                  ))}
                  <MedicineCheck item={it} last={checks[it.prescription_id] ?? null} onRecorded={refresh} />
                </View>
              ))}
            </Card>

            <Heading>Prescribed by</Heading>
            <Card style={{ gap: 4 }}>
              <Strong>{prescriberName(doc.prescriber)}</Strong>
              <Small>Licence {doc.prescriber?.licence_number || "—"}{doc.prescriber?.licence_council ? ` · ${doc.prescriber.licence_council}` : ""}</Small>
              <Small>{[doc.hospital_name ?? doc.prescriber?.hospital_name, fmtLongDate(doc.issued_at)].filter(Boolean).join(" · ")}</Small>
            </Card>

            {requests.length > 0 ? (
              <>
                <Heading>Sent to pharmacies</Heading>
                {requests.map((r) => {
                  const name = r.pharmacies?.name ?? "Pharmacy";
                  return (
                    <Card key={r.id} style={{ gap: space.sm }}>
                      <Chip label={REQUEST_LABEL[r.status]} tone={REQUEST_TONE[r.status]} />
                      <Strong>{name}</Strong>
                      {r.price_kobo !== null || r.ready_by ? (
                        <Body>{[r.price_kobo !== null ? formatKobo(r.price_kobo) : null, r.ready_by ? `ready ${fmtDateTime(r.ready_by)}` : null].filter(Boolean).join(" · ")}</Body>
                      ) : null}
                      {r.pharmacy_note ? <Small>{r.pharmacy_note}</Small> : null}
                      {r.status === "available" || r.status === "partial" ? <Small>Pay at the counter when you collect. Show your code: {code}</Small> : null}
                      {OPEN_REQUEST.includes(r.status) ? (
                        <Button small label="Cancel request" variant="dangerGhost" onPress={() => cancelRequest(r)} disabled={!online} disabledReason={OFFLINE_ACTION} />
                      ) : null}
                      {r.status === "collected" ? (reviews[r.id]
                        ? <Small>You rated this pharmacy {reviews[r.id]} out of 5 stars.</Small>
                        : <Button small label="Rate this pharmacy" icon={Star} variant="secondary" onPress={() => setRate(r)} disabled={!online} disabledReason={OFFLINE_ACTION} />
                      ) : null}
                    </Card>
                  );
                })}
              </>
            ) : null}

            <PharmacyPickerSheet visible={pick} onClose={() => setPick(false)} documentId={doc.document_id ?? id} code={code}
              defaultState={profile?.state} defaultCity={profile?.city} onSent={refresh} />
            <RatePharmacySheet request={rate} onClose={() => setRate(null)} onRated={refresh} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}

/** "Check your medicine": the NAFDAC guidance, then Genuine / Not found / Looks fake (record_medicine_check). */
function MedicineCheck({ item, last, onRecorded }: { item: RxItem; last: CheckResult | null; onRecorded: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState("");
  const [nafdac, setNafdac] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState<CheckResult | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  async function record(result: CheckResult) {
    setBusy(result);
    const { error } = await supabase.rpc("record_medicine_check", {
      p_prescription_id: item.prescription_id,
      p_result: result,
      p_batch_number: batch.trim() || undefined,
      p_nafdac_no: nafdac.trim() || undefined,
      p_details: details.trim() || undefined,
    });
    setBusy(null);
    if (error) return toast.error(friendlyError(error));
    const msg = result === "suspected_fake" ? FAKE_THANKS : `Saved: ${CHECK_LABEL[result]}. Thank you.`;
    setThanks(msg);
    toast.success(msg);
    onRecorded();
  }

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <ShieldCheck size={20} color={colors.primaryText} />
        <Strong color={colors.primaryText} style={{ flex: 1 }}>Check your medicine{last ? ` · last: ${CHECK_LABEL[last]}` : ""}</Strong>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: space.md, backgroundColor: colors.surface, borderRadius: 16, padding: space.md, marginTop: space.sm }}>
      <Label>Check your medicine</Label>
      <Body>Scratch the code on the pack and send it free by SMS to NAFDAC's MAS number on the pack, or search the drug on NAFDAC's Greenbook.</Body>
      <LinkText label="Open greenbook.nafdac.gov.ng" onPress={() => openUrl(NAFDAC_GREENBOOK)} />
      <Field label="Batch number (optional)" value={batch} onChangeText={setBatch} maxLength={60} autoCapitalize="characters" />
      <Field label="NAFDAC number (optional)" value={nafdac} onChangeText={setNafdac} maxLength={60} autoCapitalize="characters" />
      <Field label="Details (optional)" value={details} onChangeText={setDetails} maxLength={1000} multiline />
      {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
      <View style={{ gap: space.sm }} accessibilityLabel={`Result for ${item.drug_name}`}>
        <Button label="Genuine" variant="secondary" onPress={() => record("genuine")} loading={busy === "genuine"} disabled={!online || !!busy} disabledReason={OFFLINE_ACTION} />
        <Button label="Not found" variant="secondary" onPress={() => record("not_found")} loading={busy === "not_found"} disabled={!online || !!busy} disabledReason={OFFLINE_ACTION} />
        <Button label="Looks fake" variant="danger" onPress={() => record("suspected_fake")} loading={busy === "suspected_fake"} disabled={!online || !!busy} disabledReason={OFFLINE_ACTION} />
        <Button label="Close" variant="ghost" onPress={() => setOpen(false)} />
      </View>
      {thanks ? <Notice tone="success" text={thanks} /> : null}
    </View>
  );
}
