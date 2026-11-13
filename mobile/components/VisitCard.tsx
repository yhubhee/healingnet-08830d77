// One visit in the Visits list. Memoised: a card only redraws when its own visit changes.
import { CalendarPlus, RotateCcw, Video } from "./icons";
import { router } from "expo-router";
import { memo } from "react";
import { View } from "react-native";
import { OFFLINE_ACTION } from "@/lib/net";
import { canCancel, canJoinCall, doctorIsInCall, doctorOrPending, isUpcoming, statusText, statusTone, type Appointment } from "@/shared/appointments";
import { space } from "@/theme";
import { Body, Button, Card, Chip, Heading, Notice, Small } from "./ui";
import { VisitFacts } from "./VisitBits";

export const VisitCard = memo(function VisitCard({ a, online, cancelling, onCancel, onReschedule, onCalendar, onJoin }: {
  a: Appointment;
  online: boolean;
  cancelling: boolean;
  onCancel: (a: Appointment) => void;
  onReschedule: (a: Appointment) => void;
  onCalendar: (a: Appointment) => void;
  onJoin: (a: Appointment) => void;
}) {
  const upcoming = isUpcoming(a);
  return (
    <Card style={{ gap: space.md }}>
      <Chip label={statusText(a)} tone={statusTone(a.status)} />
      <View>
        <Heading>{doctorOrPending(a)}</Heading>
        {a.doctors?.specialty ? <Small>{a.doctors.specialty}</Small> : null}
      </View>
      <VisitFacts a={a} />
      {a.reason ? <Body>{a.reason}</Body> : null}
      {upcoming ? <Small>We'll remind you 24 hours and 1 hour before.</Small> : null}

      {canJoinCall(a) ? (
        <>
          {doctorIsInCall(a) ? <Notice tone="success" text="Your doctor is in the call and waiting for you." /> : null}
          <Button label="Join call" icon={Video} onPress={() => onJoin(a)} disabled={!online} disabledReason={OFFLINE_ACTION} />
        </>
      ) : null}
      {a.status === "rejected" ? <Button label="Book again" icon={RotateCcw} onPress={() => router.push("/book")} /> : null}
      {upcoming ? (
        <View style={{ gap: space.sm }}>
          <Button label="Add to calendar" variant="secondary" icon={CalendarPlus} onPress={() => onCalendar(a)} />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label="Reschedule" variant="secondary" style={{ flex: 1 }} onPress={() => onReschedule(a)} disabled={!online} disabledReason={OFFLINE_ACTION} />
            {canCancel(a) ? (
              <Button label="Cancel" variant="dangerGhost" style={{ flex: 1 }} onPress={() => onCancel(a)}
                disabled={!online || cancelling} disabledReason={OFFLINE_ACTION} accessibilityLabel="Cancel this appointment" />
            ) : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
});
