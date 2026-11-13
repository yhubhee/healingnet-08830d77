// Rate your visit: 5 large stars and an optional comment (rate_appointment). Rating again
// replaces the rating. The database's own messages are shown as they are.
import { Star } from "./icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRateVisit } from "@/lib/data";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { doctorOrPending, type Appointment } from "@/shared/appointments";
import { dbMessage } from "@/shared/errors";
import type { VisitReview } from "@/shared/reviews";
import { space, useTheme } from "@/theme";
import { Field, Sheet } from "./form";
import { useToast } from "./toast";
import { visitWhen } from "./VisitBits";
import { Body, Button, Small } from "./ui";

export function RateVisitSheet({ appointment, review, onClose }: {
  appointment: Appointment | null;
  /** The rating already given, when changing it. */
  review: VisitReview | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const rate = useRateVisit();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const id = appointment?.id;
  useEffect(() => { setRating(review?.rating ?? 0); setComment(review?.comment ?? ""); }, [id, review?.rating, review?.comment]);

  async function submit() {
    if (!appointment || !rating) return;
    try {
      await rate.mutateAsync({ appointmentId: appointment.id, rating, comment });
      toast.success(review ? "Rating changed" : "Thanks for your rating");
      onClose();
    } catch (e) {
      toast.error(dbMessage(e));
    }
  }

  return (
    <Sheet visible={!!appointment} onClose={onClose} title={review ? "Change your rating" : "Rate your visit"}
      footer={<Button label={review ? "Save rating" : "Submit rating"} onPress={submit} loading={rate.isPending} disabled={!rating || !online}
        disabledReason={!online ? OFFLINE_ACTION : "Choose 1 to 5 stars first"} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
        {appointment ? <Body muted>{doctorOrPending(appointment)} · {visitWhen(appointment)}. Your rating helps other patients choose a doctor.</Body> : null}
        <View accessibilityRole="radiogroup" accessibilityLabel="Stars" style={{ flexDirection: "row", justifyContent: "center" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: rating === n }} accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
              onPress={() => setRating(n)} style={{ width: 60, height: 64, alignItems: "center", justifyContent: "center" }}>
              <Star size={44} color={n <= rating ? colors.warningText : colors.textMuted} fill={n <= rating ? colors.warningText : "transparent"} />
            </Pressable>
          ))}
        </View>
        <Small style={{ textAlign: "center" }}>{rating ? `${rating} out of 5 stars` : "Tap a star"}</Small>
        <Field label="Comment (optional)" value={comment} onChangeText={setComment} maxLength={500} multiline
          hint={`${comment.length}/500 · Your doctor and the hospital can read it.`} />
      </ScrollView>
    </Sheet>
  );
}
