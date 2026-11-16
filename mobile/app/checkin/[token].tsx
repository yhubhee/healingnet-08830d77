// After scanning (or opening healingnet://checkin/<token>): which hospital this is, who is
// checking in, today's visit if there is one, an optional reason, and the Check in button.
// The database's own messages are shown as they are.
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Field } from "@/components/form";
import { Building2, CalendarCheck, MapPin } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, ErrorState, Heading, Label, ListSkeleton, Notice, Small } from "@/components/ui";
import { useCheckinLookup, useHospitalPlace, useSelfCheckIn } from "@/lib/checkin";
import { useActivePerson } from "@/lib/family";
import { useOnline } from "@/lib/net";
import { CHECKIN_REASON_MAX, cleanCheckinToken, linkNotice, NOT_A_CHECKIN_CODE, SCANNER_OFFLINE, visitTodayLine } from "@/shared/checkin";
import { fmt12 } from "@/shared/dates";
import { dbMessage, profileIncompleteRoute } from "@/shared/errors";
import { addressLine } from "@/shared/geo";
import { space, useTheme } from "@/theme";

export default function CheckInConfirm() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const qc = useQueryClient();
  const person = useActivePerson();
  const { token: raw } = useLocalSearchParams<{ token: string }>();
  const token = cleanCheckinToken(raw);
  const lookup = useCheckinLookup(token);
  const place = useHospitalPlace(lookup.data?.hospital_id);
  const checkIn = useSelfCheckIn();
  const [reason, setReason] = useState("");

  const h = lookup.data;
  // Already in this hospital's queue today: show the place in the queue instead.
  const already = !!h?.already_checked_in;
  useEffect(() => { if (already) router.replace("/checkin/status"); }, [already]);

  function submit() {
    if (!token) return;
    checkIn.mutate({ token, reason }, {
      onSuccess: () => router.replace("/checkin/status"),
      onError: (e) => {
        const unfinished = profileIncompleteRoute(e);
        if (unfinished) {
          toast.info(unfinished.toast);
          qc.invalidateQueries({ queryKey: ["profile"] });
          qc.invalidateQueries({ queryKey: ["profile-status"] });
          router.replace(unfinished.route);
          return;
        }
        toast.error(dbMessage(e));
      },
    });
  }

  const where = h ? addressLine({ address: place.data?.address, city: h.city, state: h.state }) : "";
  const visit = h ? visitTodayLine(h.appointment_today, fmt12) : null;

  return (
    <Screen title="Check in" back person="switch"
      footer={h && !already ? (
        <>
          {!online ? <Notice tone="warning" text={SCANNER_OFFLINE} /> : null}
          <Button label={person.isMe ? "Check in" : `Check in ${person.firstName}`} onPress={submit} loading={checkIn.isPending} disabled={!online} disabledReason={SCANNER_OFFLINE} />
        </>
      ) : undefined}>
      {!token ? (
        <ErrorState message={NOT_A_CHECKIN_CODE} onRetry={() => router.replace("/checkin")} />
      ) : lookup.isLoading ? (
        <ListSkeleton rows={2} height={120} />
      ) : lookup.isError || !h ? (
        <ErrorState offline={!online} message={online ? dbMessage(lookup.error) : SCANNER_OFFLINE} onRetry={() => lookup.refetch()} />
      ) : (
        <>
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
              {h.logo_url ? (
                <Image source={{ uri: h.logo_url }} style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: "#FFFFFF" }} contentFit="contain" accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={28} color={colors.primaryText} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Label>Check in at</Label>
                <Heading>{h.name}</Heading>
              </View>
            </View>
            {where ? (
              <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
                <MapPin size={18} color={colors.textMuted} />
                <Small style={{ flex: 1 }}>{where}</Small>
              </View>
            ) : null}
          </Card>

          {visit ? (
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 16, padding: space.md }}>
              <CalendarCheck size={20} color={colors.primaryText} />
              <Body style={{ flex: 1 }}>{visit}</Body>
            </View>
          ) : null}

          <Field label="Reason for your visit (optional)" value={reason} onChangeText={(t) => setReason(t.slice(0, CHECKIN_REASON_MAX))} multiline maxLength={CHECKIN_REASON_MAX}
            placeholder="For example: fever since Monday" hint={`${reason.length}/${CHECKIN_REASON_MAX}. The front desk sees this.`} />

          {!h.already_linked ? <Notice text={linkNotice(h.name)} /> : null}
        </>
      )}
    </Screen>
  );
}
