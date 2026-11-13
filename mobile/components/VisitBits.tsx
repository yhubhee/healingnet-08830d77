// Small pieces shared by the Home card and the Visits list.
import { CalendarDays, MapPin, Video } from "./icons";
import { View } from "react-native";
import type { Appointment } from "@/shared/appointments";
import { fmt12, fmtDayDate } from "@/shared/dates";
import { space, useTheme } from "@/theme";
import { Small } from "./ui";

export const visitWhen = (a: Pick<Appointment, "requested_date" | "requested_time">) =>
  `${fmtDayDate(a.requested_date)}${a.requested_time ? ` at ${fmt12(a.requested_time)}` : ""}`;

export const visitKind = (a: Pick<Appointment, "is_telemedicine">) => (a.is_telemedicine === true ? "Video" : "In person");

/** Date and time, then "Video" or "In person" with the hospital. Always in words, with icons as support. */
export function VisitFacts({ a, color }: { a: Appointment; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.textMuted;
  const video = a.is_telemedicine === true;
  const Place = video ? Video : MapPin;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <CalendarDays size={18} color={c} />
        <Small color={c} style={{ flex: 1 }}>{visitWhen(a)}</Small>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Place size={18} color={c} />
        <Small color={c} style={{ flex: 1 }}>{video ? "Video visit" : `In person${a.hospitals?.name ? ` · ${a.hospitals.name}` : ""}`}</Small>
      </View>
    </View>
  );
}
