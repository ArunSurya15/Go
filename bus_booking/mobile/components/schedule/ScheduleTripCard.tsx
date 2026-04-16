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
  const busTypeLabel =
    (schedule.bus.service_name && schedule.bus.service_name.trim()) ||
    (schedule.bus.registration_no && schedule.bus.registration_no.trim()) ||
    `Bus #${schedule.id}`;
  const operatorName = (schedule.bus.operator_name || "").trim();
  const primaryOperator = operatorName || busTypeLabel;
  const secondaryType = operatorName ? busTypeLabel : schedule.bus.registration_no || "";
  const promo = schedule.operator_promo_title || schedule.platform_promo_title || schedule.platform_promo_line || "";
  const fareNow = Number(schedule.fare || 0);
  const fareOrigNum = schedule.fare_original ? Number(schedule.fare_original) : NaN;
  const displayFare = Number.isFinite(fareOrigNum) ? Math.min(fareNow, fareOrigNum) : fareNow;
  const hasStrike = Number.isFinite(fareOrigNum) && fareOrigNum > displayFare;
  const saveAmount = hasStrike ? Math.max(0, Math.round(fareOrigNum - displayFare)) : 0;
  const rating = Number(schedule.bus.rating_avg || 0);
  const ratingCount = Number(schedule.bus.rating_count || 0);
  const ratingTone = rating >= 4 ? "good" : rating >= 3 ? "warn" : "bad";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.press, pressed && { opacity: 0.96 }]}>
      <View style={styles.card}>
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
              <AppText numberOfLines={1} style={styles.operatorName}>
                {primaryOperator}
              </AppText>
              <AppText numberOfLines={2} style={styles.busName}>
                {secondaryType}
              </AppText>
              {ratingCount > 0 && rating > 0 ? (
                <View style={styles.ratingRow}>
                  <View
                    style={[
                      styles.ratingBadge,
                      ratingTone === "good" && styles.ratingGood,
                      ratingTone === "warn" && styles.ratingWarn,
                      ratingTone === "bad" && styles.ratingBad,
                    ]}
                  >
                    <AppText variant="caption" style={styles.ratingBadgeText}>
                      ★ {rating.toFixed(1)}
                    </AppText>
                  </View>
                  <AppText variant="caption" style={styles.ratingCountText}>
                    {ratingCount} reviews
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.fareCol}>
              {hasStrike ? (
                <AppText variant="caption" style={styles.strike}>
                  {formatRupee(schedule.fare_original!)}
                </AppText>
              ) : null}
              <AppText style={styles.fare}>{formatRupee(String(displayFare))}</AppText>
              <AppText variant="caption" style={styles.perSeat}>
                onwards
              </AppText>
            </View>
          </View>

          {(promo || hasStrike) ? (
            <View style={styles.offerWrap}>
              {promo ? (
                <View style={styles.ribbon}>
                  <AppText variant="caption" style={styles.ribbonText}>
                    {promo}
                  </AppText>
                </View>
              ) : null}
              {hasStrike ? (
                <View style={styles.lastMinuteChip}>
                  <AppText variant="caption" style={styles.lastMinuteText}>
                    Last minute deal{saveAmount > 0 ? ` · Save ${formatRupee(String(saveAmount))}` : ""}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.footerRow}>
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
  press: { marginBottom: 12, paddingHorizontal: 8 },
  card: {
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: palette.white,
    ...shadows.card,
  },
  body: { flex: 1, padding: 13 },
  timesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeBig: { fontFamily: fonts.bold, fontSize: 15, color: palette.slate900 },
  subMuted: { marginTop: 4, color: palette.slate500, fontFamily: fonts.medium },
  midPill: {
    backgroundColor: palette.indigo50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    marginHorizontal: 8,
  },
  midPillText: { color: palette.indigo700, fontFamily: fonts.semibold, fontSize: 10 },
  divider: { height: 1, backgroundColor: palette.slate100, marginVertical: 12 },
  busRow: { flexDirection: "row", alignItems: "flex-start" },
  operatorName: { color: palette.slate900, fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, marginBottom: 2 },
  busName: { fontFamily: fonts.medium, fontSize: 12, color: palette.slate600, lineHeight: 17 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  ratingBadge: { borderRadius: radii.full, paddingHorizontal: 7, paddingVertical: 2 },
  ratingGood: { backgroundColor: "#16a34a" },
  ratingWarn: { backgroundColor: "#f59e0b" },
  ratingBad: { backgroundColor: "#dc2626" },
  ratingBadgeText: { color: palette.white, fontFamily: fonts.semibold },
  ratingCountText: { marginLeft: 8, color: palette.slate500 },
  fareCol: { alignItems: "flex-end", minWidth: 92, flexShrink: 0 },
  strike: { textDecorationLine: "line-through", color: palette.slate400 },
  fare: { fontFamily: fonts.bold, fontSize: 16, color: palette.indigo700 },
  perSeat: { color: palette.slate500, marginTop: 2 },
  offerWrap: { marginTop: 8, gap: 6 },
  ribbon: {
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  ribbonText: { color: "#92400e", fontFamily: fonts.semibold },
  lastMinuteChip: {
    alignSelf: "flex-start",
    backgroundColor: "#ede9fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  lastMinuteText: { color: "#5b21b6", fontFamily: fonts.semibold },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  tapHint: { color: palette.indigo600, fontFamily: fonts.medium },
});
