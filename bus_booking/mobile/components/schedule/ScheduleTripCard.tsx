import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { durationLabel, formatRupee, formatTime } from "@/lib/format";
import type { Schedule } from "@/lib/types";
import { fonts, palette, radii, shadows } from "@/constants/theme";

type Props = {
  schedule: Schedule;
  onPress: () => void;
};

type DealTone = "gold" | "flash" | "smart";

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
  const rating = Number(schedule.bus.rating_avg || 0);
  const ratingCount = Number(schedule.bus.rating_count || 0);
  const displayFare = Number.isFinite(fareOrigNum) ? Math.min(fareNow, fareOrigNum) : fareNow;
  const hasStrike = Number.isFinite(fareOrigNum) && fareOrigNum > displayFare;
  const saveAmount = hasStrike ? Math.max(0, Math.round(fareOrigNum - displayFare)) : 0;
  const hasExclusiveOffer = Boolean((promo || "").trim()) || hasStrike;
  const fareForValue = Number.isFinite(displayFare) ? displayFare : fareNow;
  const discountPct = hasStrike && fareOrigNum > 0 ? ((fareOrigNum - displayFare) / fareOrigNum) * 100 : 0;
  const dealTone: DealTone =
    hasStrike && discountPct >= 14 ? "flash" : rating >= 4.4 ? "smart" : fareForValue <= 900 ? "flash" : "gold";
  const toneMeta =
    dealTone === "flash"
      ? {
          chip: "FLASH",
          ribbon: "SPECIAL OFFER",
          title: hasStrike ? `Save ${formatRupee(String(saveAmount))} right now` : "Flash price unlocked",
          subtitle: "Best value window is live",
          icon: "bolt" as const,
          strip: styles.dealStripFlash,
          spark: styles.dealSparkFlash,
          ribbonStyle: styles.cornerRibbonFlash,
          titleStyle: styles.dealTitleFlash,
          subStyle: styles.dealSubFlash,
        }
      : dealTone === "smart"
        ? {
            chip: "SMART PICK",
            ribbon: "TOP PICK",
            title: "Top rated and worth it",
            subtitle: promo.trim() || "Trusted choice for comfortable rides",
            icon: "thumbs-up" as const,
            strip: styles.dealStripSmart,
            spark: styles.dealSparkSmart,
            ribbonStyle: styles.cornerRibbonSmart,
            titleStyle: styles.dealTitleSmart,
            subStyle: styles.dealSubSmart,
          }
        : {
            chip: "GOLD",
            ribbon: "EXCLUSIVE",
            title: hasStrike ? `Save ${formatRupee(String(saveAmount))} instantly` : "Exclusive offer unlocked",
            subtitle: hasStrike ? "Limited seats on this fare" : promo.trim() || "Tap for full offer details",
            icon: "diamond" as const,
            strip: styles.dealStripGold,
            spark: styles.dealSparkGold,
            ribbonStyle: styles.cornerRibbonGold,
            titleStyle: styles.dealTitleGold,
            subStyle: styles.dealSubGold,
          };
  const sparklePulse = useRef(new Animated.Value(0)).current;
  const stripFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasExclusiveOffer) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sparklePulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sparklePulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const floaty = Animated.loop(
      Animated.sequence([
        Animated.timing(stripFloat, {
          toValue: 1,
          duration: 1050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(stripFloat, {
          toValue: 0,
          duration: 1050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    floaty.start();
    return () => {
      pulse.stop();
      floaty.stop();
      sparklePulse.setValue(0);
      stripFloat.setValue(0);
    };
  }, [hasExclusiveOffer, sparklePulse, stripFloat]);

  const sparkleScale = sparklePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });
  const sparkleRotate = sparklePulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "10deg"],
  });
  const stripTranslateY = stripFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1.6],
  });
  const ratingTone = rating >= 4 ? "good" : rating >= 3 ? "warn" : "bad";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.press, pressed && { opacity: 0.96 }]}>
      <View style={styles.card}>
        {hasExclusiveOffer ? (
          <View style={styles.cornerRibbonClip}>
            <View style={[styles.cornerRibbonBand, toneMeta.ribbonStyle]}>
              <AppText numberOfLines={1} style={styles.cornerRibbonText}>
                {toneMeta.ribbon}
              </AppText>
            </View>
          </View>
        ) : null}
        <View style={styles.body}>
          {hasExclusiveOffer ? (
            <Animated.View
              style={[styles.dealStrip, toneMeta.strip, { transform: [{ translateY: stripTranslateY }] }]}
            >
              <View style={styles.dealCopyWrap}>
                <AppText numberOfLines={1} variant="caption" style={[styles.dealTitle, toneMeta.titleStyle]}>
                  {toneMeta.title}
                </AppText>
                <AppText numberOfLines={1} variant="caption" style={[styles.dealSubTitle, toneMeta.subStyle]}>
                  {toneMeta.subtitle}
                </AppText>
              </View>
              <Animated.View
                style={[
                  styles.dealSparkWrap,
                  toneMeta.spark,
                  { transform: [{ scale: sparkleScale }, { rotate: sparkleRotate }] },
                ]}
              >
                <FontAwesome name={toneMeta.icon} size={11} color={dealTone === "flash" ? "#7f1d1d" : "#92400e"} />
              </Animated.View>
            </Animated.View>
          ) : null}
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
                <View style={styles.dealFareBlock}>
                  <AppText variant="caption" style={styles.strikeLabel}>
                    Was
                  </AppText>
                  <AppText variant="caption" style={styles.strike}>
                    {formatRupee(schedule.fare_original!)}
                  </AppText>
                </View>
              ) : null}
              <AppText style={styles.fare}>{formatRupee(String(displayFare))}</AppText>
              <AppText variant="caption" style={styles.perSeat}>
                {hasStrike ? "Deal price · onwards" : "onwards"}
              </AppText>
            </View>
          </View>

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
  dealStrip: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingLeft: 34,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  dealStripGold: { backgroundColor: "#fff8dc", shadowColor: "#f59e0b" },
  dealStripFlash: { backgroundColor: "#fff1f2", shadowColor: "#fb7185" },
  dealStripSmart: { backgroundColor: "#ecfdf5", shadowColor: "#34d399" },
  dealSparkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  dealSparkGold: { backgroundColor: "#fde68a" },
  dealSparkFlash: { backgroundColor: "#fecdd3" },
  dealSparkSmart: { backgroundColor: "#bbf7d0" },
  dealCopyWrap: { flex: 1, minWidth: 0, paddingLeft: 16 },
  dealTitle: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
  dealTitleGold: { color: "#78350f" },
  dealTitleFlash: { color: "#7f1d1d" },
  dealTitleSmart: { color: "#065f46" },
  dealSubTitle: { marginTop: 1, fontSize: 10, lineHeight: 12 },
  dealSubGold: { color: "#92400e" },
  dealSubFlash: { color: "#9f1239" },
  dealSubSmart: { color: "#047857" },
  cornerRibbonClip: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 84,
    height: 84,
    overflow: "hidden",
    zIndex: 3,
  },
  /**
   * Band center must sit on the clip diagonal.
   * Clip = 84×84, diagonal = 84√2 ≈ 119 → band width 120.
   * Band center (42,42): left = 42 - 60 = -18, top = 42 - (paddingVert+lineHeight/2) ≈ 28.
   */
  cornerRibbonBand: {
    position: "absolute",
    top: 20,
    left: -30,
    width: 120,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-45deg" }],
    elevation: 2,
  },
  cornerRibbonGold: { backgroundColor: "#f59e0b" },
  cornerRibbonFlash: { backgroundColor: "#ef4444" },
  cornerRibbonSmart: { backgroundColor: "#10b981" },
  cornerRibbonText: {
    color: palette.white,
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.6,
    textAlign: "center",
    includeFontPadding: false,
    width: "100%",
  },
  timesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeBig: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 22,
    color: palette.slate900,
    includeFontPadding: true,
    paddingBottom: 1,
  },
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
  dealFareBlock: { flexDirection: "row", alignItems: "center", gap: 4 },
  strikeLabel: { color: palette.slate400, fontSize: 10, lineHeight: 14 },
  strike: { textDecorationLine: "line-through", color: palette.slate400 },
  fare: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: palette.indigo700,
    includeFontPadding: true,
    paddingBottom: 1,
  },
  perSeat: { color: palette.slate500, marginTop: 2, lineHeight: 16 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  tapHint: { color: palette.indigo600, fontFamily: fonts.medium },
});
