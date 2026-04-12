import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { durationLabel, formatRupee, formatTime } from "@/lib/format";
import type { Schedule } from "@/lib/types";
import { fonts, palette, radii, shadows } from "@/constants/theme";

type Props = {
  schedule: Schedule;
  onPress: () => void;
};

export function ScheduleTripCard({ schedule, onPress }: Props) {
  const busLabel =
    (schedule.bus.service_name && schedule.bus.service_name.trim()) || schedule.bus.registration_no;
  const promo = schedule.operator_promo_title || schedule.platform_promo_title;
  const hasStrike = schedule.fare_original && Number(schedule.fare_original) > Number(schedule.fare);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.press, pressed && { opacity: 0.96 }]}>
      <View style={styles.card}>
        <LinearGradient
          colors={[palette.indigo600, "#6366f1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.accent}
        />
        <View style={styles.body}>
          <View style={styles.timesRow}>
            <View>
              <AppText style={styles.timeBig}>{formatTime(schedule.departure_dt)}</AppText>
              <AppText variant="caption" style={styles.subMuted}>
                {schedule.route.origin}
              </AppText>
            </View>
            <View style={styles.midPill}>
              <AppText variant="caption" style={styles.midPillText}>
                {durationLabel(schedule.departure_dt, schedule.arrival_dt)}
              </AppText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <AppText style={styles.timeBig}>{formatTime(schedule.arrival_dt)}</AppText>
              <AppText variant="caption" style={styles.subMuted}>
                {schedule.route.destination}
              </AppText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.busRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <AppText variant="label" numberOfLines={2}>
                {busLabel}
              </AppText>
              {schedule.bus.rating_count && schedule.bus.rating_avg ? (
                <AppText variant="caption" style={styles.rating}>
                  ★ {Number(schedule.bus.rating_avg).toFixed(1)} · {schedule.bus.rating_count} reviews
                </AppText>
              ) : null}
            </View>
            <View style={styles.fareCol}>
              {hasStrike ? (
                <AppText variant="caption" style={styles.strike}>
                  {formatRupee(schedule.fare_original!)}
                </AppText>
              ) : null}
              <AppText style={styles.fare}>{formatRupee(schedule.fare)}</AppText>
              <AppText variant="caption" style={styles.perSeat}>
                per seat
              </AppText>
            </View>
          </View>

          {promo ? (
            <View style={styles.ribbon}>
              <AppText variant="caption" style={styles.ribbonText}>
                {promo}
              </AppText>
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <View style={[styles.pill, schedule.status === "ACTIVE" ? styles.pillLive : styles.pillMuted]}>
              <AppText variant="caption" style={styles.pillTxt}>
                {schedule.status}
              </AppText>
            </View>
            <AppText variant="caption" style={styles.tapHint}>
              Details →
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { marginBottom: 14 },
  card: {
    flexDirection: "row",
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: palette.white,
    ...shadows.card,
  },
  accent: { width: 5 },
  body: { flex: 1, padding: 16 },
  timesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeBig: { fontFamily: fonts.bold, fontSize: 20, color: palette.slate900 },
  subMuted: { marginTop: 4, color: palette.slate500, fontFamily: fonts.medium },
  midPill: {
    backgroundColor: palette.indigo50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginHorizontal: 8,
  },
  midPillText: { color: palette.indigo700, fontFamily: fonts.semibold, fontSize: 11 },
  divider: { height: 1, backgroundColor: palette.slate100, marginVertical: 14 },
  busRow: { flexDirection: "row", alignItems: "flex-start" },
  rating: { marginTop: 4, color: palette.slate500 },
  fareCol: { alignItems: "flex-end" },
  strike: { textDecorationLine: "line-through", color: palette.slate400 },
  fare: { fontFamily: fonts.bold, fontSize: 22, color: palette.indigo700 },
  perSeat: { color: palette.slate500, marginTop: 2 },
  ribbon: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: palette.indigo50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  ribbonText: { color: palette.indigo800, fontFamily: fonts.semibold },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  pillLive: { backgroundColor: "#d1fae5" },
  pillMuted: { backgroundColor: palette.slate100 },
  pillTxt: { color: palette.slate800, textTransform: "capitalize", fontFamily: fonts.semibold },
  tapHint: { color: palette.indigo600, fontFamily: fonts.medium },
});
