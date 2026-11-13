// "Get it from a pharmacy" and "Rate this pharmacy" (src/components/patient/rx/PharmacyPicker.tsx
// and RatePharmacy.tsx): pharmacy_directory → choose → rx_send_to_pharmacy, and rx_review_pharmacy.
import { Check, Star } from "./icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/shared/errors";
import { NIGERIAN_STATES } from "@/shared/patientProfile";
import type { PatientRequest } from "@/shared/pharmacy";
import { MIN_TOUCH, radius, space, useTheme } from "@/theme";
import { Field, SelectField, Sheet } from "./form";
import { useToast } from "./toast";
import { Body, Button, ListSkeleton, Notice, Small, Strong } from "./ui";

interface Pharmacy { id: string; name: string; address: string | null; city: string | null; state: string | null; phone: string | null; rating: number | null; reviews: number }

export function PharmacyPickerSheet({ visible, onClose, documentId, code, defaultState, defaultCity, onSent }: {
  visible: boolean; onClose: () => void; documentId: string; code?: string;
  defaultState?: string | null; defaultCity?: string | null; onSent: () => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const [state, setState] = useState(defaultState ?? "");
  const [city, setCity] = useState(defaultCity ?? "");
  const [search, setSearch] = useState({ state: defaultState ?? "", city: defaultCity ?? "" });
  const [chosen, setChosen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setState(defaultState ?? "");
    setCity(defaultCity ?? "");
    setSearch({ state: defaultState ?? "", city: defaultCity ?? "" });
    setChosen(null);
    setNote("");
  }, [visible, defaultState, defaultCity]);

  const q = useQuery({
    enabled: visible,
    queryKey: ["pharmacy-directory", search.state, search.city],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pharmacy_directory", { p_state: search.state || undefined, p_city: search.city.trim() || undefined });
      if (error) throw error;
      return (data ?? []) as Pharmacy[];
    },
  });

  async function send() {
    if (!chosen) return;
    setBusy(true);
    const { error } = await supabase.rpc("rx_send_to_pharmacy", { p_document_id: documentId, p_pharmacy_id: chosen, p_note: note.trim() || undefined });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Sent. The pharmacy will reply with stock, price and pickup time.");
    onSent();
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Get it from a pharmacy"
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label="Send prescription" onPress={send} loading={busy} disabled={!chosen || !online} disabledReason={!online ? OFFLINE_ACTION : "Choose a pharmacy first"} />
        </>
      }>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }}>
        <Small>Send {code ? `prescription ${code}` : "your prescription"} to a verified pharmacy. They reply with stock, price and pickup time. You pay at the counter.</Small>
        <SelectField label="State" value={state} onChange={setState} placeholder="Any state"
          options={[{ value: "", label: "Any state" }, ...NIGERIAN_STATES.map((s) => ({ value: s, label: s }))]} />
        <Field label="City or town" value={city} onChangeText={setCity} placeholder="Any" />
        <Button small variant="secondary" label="Search" onPress={() => setSearch({ state, city })} />

        {q.isFetching ? <ListSkeleton rows={2} height={72} /> : q.isError ? (
          <View style={{ gap: space.sm }}>
            <Notice tone="danger" text="Couldn't load pharmacies." />
            <Button small variant="secondary" label="Try again" onPress={() => q.refetch()} />
          </View>
        ) : (q.data ?? []).length === 0 ? (
          <Notice text="No verified pharmacies found here yet. Try another city, or leave the city empty." />
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Pharmacies" style={{ gap: space.sm }}>
            {q.data!.map((p) => {
              const selected = chosen === p.id;
              const rating = p.reviews > 0 && p.rating !== null ? `${Number(p.rating).toFixed(1)} stars (${p.reviews} review${p.reviews === 1 ? "" : "s"})` : "No reviews yet";
              return (
                <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setChosen(p.id)}
                  style={{ flexDirection: "row", gap: space.md, alignItems: "center", minHeight: MIN_TOUCH, padding: space.md, borderRadius: radius.button,
                    borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.card }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Strong>{p.name}</Strong>
                    <Small>{rating}</Small>
                    {p.address || p.city ? <Small>{[p.address, p.city, p.state].filter(Boolean).join(", ")}</Small> : null}
                    {p.phone ? <Small>{p.phone}</Small> : null}
                  </View>
                  {selected ? <Check size={22} color={colors.primaryText} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}
        <Field label="Note for the pharmacy (optional)" value={note} onChangeText={setNote} maxLength={500} multiline placeholder="e.g. I can collect after 5 pm" />
      </ScrollView>
    </Sheet>
  );
}

export function RatePharmacySheet({ request, onClose, onRated }: { request: PatientRequest | null; onClose: () => void; onRated: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRating(0); setComment(""); }, [request?.id]);

  async function submit() {
    if (!request || !rating) return;
    setBusy(true);
    const { error } = await supabase.rpc("rx_review_pharmacy", { p_request_id: request.id, p_rating: rating, p_comment: comment.trim() || undefined });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Thanks for your rating");
    onRated();
    onClose();
  }

  return (
    <Sheet visible={!!request} onClose={onClose} title={`Rate ${request?.pharmacies?.name ?? "this pharmacy"}`}
      footer={<Button label="Submit rating" onPress={submit} loading={busy} disabled={!rating || !online} disabledReason={!online ? OFFLINE_ACTION : "Choose 1 to 5 stars first"} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
        <Body muted>Your rating helps other patients choose a pharmacy.</Body>
        <View accessibilityRole="radiogroup" accessibilityLabel="Stars" style={{ flexDirection: "row", justifyContent: "center" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: rating === n }} accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
              onPress={() => setRating(n)} style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center" }}>
              <Star size={36} color={n <= rating ? colors.warningText : colors.textMuted} fill={n <= rating ? colors.warningText : "transparent"} />
            </Pressable>
          ))}
        </View>
        <Small style={{ textAlign: "center" }}>{rating ? `${rating} out of 5 stars` : "Tap a star"}</Small>
        <Field label="Comment (optional)" value={comment} onChangeText={setComment} maxLength={500} multiline />
      </ScrollView>
    </Sheet>
  );
}
