import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BusRatingSheet } from "@/components/trip/BusRatingSheet";
import { RouteStopTimeline } from "@/components/trip/RouteStopTimeline";
import { RotatingTextBanner } from "@/components/trip/RotatingTextBanner";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { featureLabel, LAYOUT_KIND_LABELS } from "@/lib/bus-features";
import { durationLabel, formatRupee, formatTime } from "@/lib/format";
import { seatFareBreakup } from "@/lib/fare-breakup";
import { paramOne } from "@/lib/router-params";
import { routesApi } from "@/lib/api";
import type { BusFeatureItem, BusReview, Schedule } from "@/lib/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function featureIdsFromBus(features?: BusFeatureItem[]): string[] {
  if (!features?.length) return [];
  const out: string[] = [];
  for (const f of features) {
    const id = typeof f === "string" ? f : f.id;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

function displayFareParts(s: Schedule) {
  const fareNow = Number(s.fare || 0);
  const fareOrigNum = s.fare_original ? Number(s.fare_original) : NaN;
  const displayFare = Number.isFinite(fareOrigNum) ? Math.min(fareNow, fareOrigNum) : fareNow;
  const hasStrike = Number.isFinite(fareOrigNum) && fareOrigNum > displayFare;
  return { displayFare, hasStrike };
}

/** Green ≥ 4, amber ≥ 3, rose < 3  */
function ratingColors(avg: number): { bg: string; text: string; border: string } {
  if (avg >= 4) return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
  if (avg >= 3) return { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" };
  return { bg: "#fee2e2", text: "#9f1239", border: "#fca5a5" };
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function ScheduleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, routeId, date, from, to } = useLocalSearchParams<{
    id: string;
    routeId: string;
    date: string;
    from: string;
    to: string;
  }>();

  const sid = paramOne(id);
  const rid = paramOne(routeId);
  const d = paramOne(date);
  const fromL = paramOne(from);
  const toL = paramOne(to);

  const [schedule, setSchedule] = useState<Schedule | null | undefined>(undefined);
  const [reviews, setReviews] = useState<BusReview[]>([]);
  const [ratingSheetOpen, setRatingSheetOpen] = useState(false);
  const [fareOpen, setFareOpen] = useState(false);

  useEffect(() => {
    if (!rid || !d || !sid) { setSchedule(null); return; }
    let alive = true;
    routesApi
      .schedules(Number(rid), d)
      .then((list) => { if (alive) setSchedule(list.find((x) => x.id === Number(sid)) ?? null); })
      .catch(() => { if (alive) setSchedule(null); });
    return () => { alive = false; };
  }, [rid, d, sid]);

  useEffect(() => {
    const busId = schedule?.bus?.id;
    if (!busId) { setReviews([]); return; }
    let alive = true;
    routesApi
      .busReviews(busId)
      .then((r) => { if (alive) setReviews(Array.isArray(r) ? r : []); })
      .catch(() => { if (alive) setReviews([]); });
    return () => { alive = false; };
  }, [schedule?.bus?.id]);

  const tickerLines = useMemo(() => {
    if (!schedule) return [];
    const lines: string[] = [];
    const avg = Number(schedule.bus.rating_avg || 0);
    const n = Number(schedule.bus.rating_count || 0);
    const layout =
      (schedule.bus.layout_kind && LAYOUT_KIND_LABELS[schedule.bus.layout_kind]) || LAYOUT_KIND_LABELS.mixed;
    const feats = featureIdsFromBus(schedule.bus.features);
    const featSample = feats.slice(0, 3).map(featureLabel).join(" · ");
    if (n > 0 && avg > 0) {
      lines.push(`Passengers rate this bus ★ ${avg.toFixed(1)} on average (${n} rating${n === 1 ? "" : "s"}).`);
      lines.push(`${layout}${featSample ? ` · ${featSample}` : ""}.`);
    }
    for (const rev of reviews.slice(0, 6)) {
      const bit = (rev.comment || "").trim().replace(/\s+/g, " ");
      if (bit.length > 8) {
        const short = bit.length > 90 ? `${bit.slice(0, 87)}…` : bit;
        lines.push(`"${short}" — ${rev.reviewer_label}, ★${rev.stars}`);
      } else if (rev.stars >= 4) {
        lines.push(`${rev.reviewer_label} rated this trip ★${rev.stars}.`);
      }
    }
    if (lines.length === 0) {
      lines.push("Ratings are collected after completed trips — book to ride and share feedback.");
      lines.push(`${layout}${featSample ? ` · ${featSample}` : ""}.`);
    }
    return lines;
  }, [schedule, reviews]);

  // ── loading / error states ──────────────────────────────────────────────────
  if (schedule === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.indigo600} />
      </View>
    );
  }
  if (!schedule) {
    return (
      <View style={styles.center}>
        <SurfaceCard>
          <AppText variant="title" style={{ marginBottom: 8 }}>Trip not found</AppText>
          <AppText variant="body" style={{ marginBottom: 16 }}>
            This departure may have been removed. Go back and pick another bus.
          </AppText>
          <PrimaryButton title="Back to results" onPress={() => router.back()} />
        </SurfaceCard>
      </View>
    );
  }

  // ── derived values ──────────────────────────────────────────────────────────
  const busLabel =
    (schedule.bus.service_name && schedule.bus.service_name.trim()) || schedule.bus.registration_no;
  const operator = (schedule.bus.operator_name || "").trim();
  const { displayFare, hasStrike } = displayFareParts(schedule);
  const breakup = seatFareBreakup(displayFare);
  const gstPct = Math.round(breakup.gstRate * 100);
  const ratingAvg = Number(schedule.bus.rating_avg || 0);
  const ratingCount = Number(schedule.bus.rating_count || 0);
  const hasRating = ratingCount > 0 && ratingAvg > 0;
  const rc = hasRating ? ratingColors(ratingAvg) : null;
  const featureIds = featureIdsFromBus(schedule.bus.features);
  const layoutLabel = (schedule.bus.layout_kind && LAYOUT_KIND_LABELS[schedule.bus.layout_kind]) || null;
  const patternStops = schedule.route_pattern?.stops ?? [];
  const patternName = (schedule.route_pattern?.name || "").trim();
  const hasRoute = patternStops.length >= 2;

  const depTime = formatTime(schedule.departure_dt);
  const arrTime = formatTime(schedule.arrival_dt);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── hero ─────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#312e81", "#4f46e5", "#6366f1"]}
          style={[styles.hero, { paddingTop: 12 }]}
        >
          <AppText variant="caption" style={styles.heroEyebrow}>
            {fromL && toL ? `${fromL} → ${toL}` : "Trip"}
          </AppText>
          <AppText style={styles.heroTime}>
            {depTime} — {arrTime}
          </AppText>
          <AppText variant="subtitle" style={styles.heroDur}>
            {durationLabel(schedule.departure_dt, schedule.arrival_dt)} on road
          </AppText>

          <View style={styles.heroFareBlock}>
            <AppText variant="caption" style={styles.heroFareEyebrow}>From (per seat)</AppText>
            <View style={styles.heroFareRow}>
              {hasStrike ? (
                <AppText style={styles.heroStrike}>{formatRupee(schedule.fare_original!)}</AppText>
              ) : null}
              <AppText style={styles.heroFare}>{formatRupee(String(displayFare))}</AppText>
            </View>
            {hasStrike ? (
              <AppText variant="caption" style={styles.heroSave}>
                You save {formatRupee(String(Math.max(0, Number(schedule.fare_original) - displayFare)))} vs list price
              </AppText>
            ) : null}
          </View>
        </LinearGradient>

        <SurfaceCard style={styles.card}>
          {/* ── bus identity ─────────────────────────────────────────────── */}
          <AppText variant="label" style={{ marginBottom: 6 }}>Bus</AppText>
          <AppText variant="title" style={{ fontSize: 18, marginBottom: 4 }}>{busLabel}</AppText>
          {operator ? (
            <AppText variant="body" style={{ color: palette.slate600, marginBottom: 4 }}>{operator}</AppText>
          ) : null}
          <AppText variant="caption" style={{ color: palette.slate500 }}>
            {schedule.bus.registration_no}
            {schedule.bus.capacity ? ` · ${schedule.bus.capacity} seats` : ""}
            {layoutLabel ? ` · ${layoutLabel}` : ""}
          </AppText>

          {/* ── ratings ──────────────────────────────────────────────────── */}
          <View style={styles.ratingBlock}>
            <AppText variant="label" style={{ marginBottom: 8 }}>Ratings</AppText>
            {hasRating && rc ? (
              <Pressable
                onPress={() => setRatingSheetOpen(true)}
                style={({ pressed }) => [
                  styles.ratingTap,
                  { backgroundColor: rc.bg, borderColor: rc.border },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={[styles.ratingBadge, { backgroundColor: rc.text }]}>
                  <AppText variant="caption" style={[styles.ratingBadgeText, { color: "#fff" }]}>
                    ★ {ratingAvg.toFixed(1)}
                  </AppText>
                </View>
                <AppText variant="body" style={[styles.ratingMeta, { color: rc.text }]}>
                  {ratingCount} passenger rating{ratingCount === 1 ? "" : "s"}  · Tap to view all
                </AppText>
                <MaterialCommunityIcons name="chevron-right" size={18} color={rc.text} />
              </Pressable>
            ) : (
              <AppText variant="body" style={{ color: palette.slate600 }}>
                No ratings yet. They appear after travellers complete trips and leave a review.
              </AppText>
            )}
            <RotatingTextBanner lines={tickerLines} intervalMs={3800} />
          </View>

          {/* ── route stops ──────────────────────────────────────────────── */}
          {hasRoute ? (
            <View style={styles.section}>
              <AppText variant="label" style={styles.sectionTitle}>
                Your route
                {patternName ? ` · ${patternName}` : ""}
              </AppText>
              <AppText variant="caption" style={[styles.sectionMuted, { marginBottom: 12 }]}>
                Stops are shown in journey order (illustration — road distance may differ).
              </AppText>
              <RouteStopTimeline
                stops={patternStops}
                from={fromL || schedule.route.origin}
                to={toL || schedule.route.destination}
                departureTime={depTime}
                arrivalTime={arrTime}
              />
            </View>
          ) : null}

          {/* ── gallery ──────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <AppText variant="label" style={styles.sectionTitle}>Bus gallery</AppText>
            <AppText variant="caption" style={[styles.sectionMuted, { marginBottom: 10 }]}>
              Photos are added by operators — preview placeholders until uploads go live.
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {[
                { icon: "bus-side" as const, label: "Exterior", tint: ["#3730a3", "#6366f1"] as const },
                { icon: "seat-recline-extra" as const, label: "Seats", tint: ["#312e81", "#4f46e5"] as const },
                { icon: "star-circle" as const, label: "Onboard", tint: ["#1e293b", "#475569"] as const },
              ].map((slot) => (
                <LinearGradient key={slot.label} colors={[...slot.tint]} style={styles.photoCard}>
                  <MaterialCommunityIcons name={slot.icon} size={36} color="rgba(255,255,255,0.92)" />
                  <AppText variant="caption" style={styles.photoCardLabel}>{slot.label}</AppText>
                </LinearGradient>
              ))}
            </ScrollView>
          </View>

          {/* ── features ─────────────────────────────────────────────────── */}
          {(featureIds.length > 0 || (schedule.bus.extras_note || "").trim()) ? (
            <View style={styles.section}>
              <AppText variant="label" style={styles.sectionTitle}>Features</AppText>
              {featureIds.length > 0 ? (
                <View style={styles.chipWrap}>
                  {featureIds.map((fid) => (
                    <View key={fid} style={styles.chip}>
                      <AppText variant="caption" style={styles.chipText}>{featureLabel(fid)}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
              {(schedule.bus.extras_note || "").trim() ? (
                <AppText variant="body" style={[styles.sectionBody, { marginTop: 8 }]}>
                  {(schedule.bus.extras_note || "").trim()}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {/* ── fare breakup (collapsible) ────────────────────────────────── */}
          <View style={styles.section}>
            <Pressable
              onPress={() => setFareOpen((v) => !v)}
              style={styles.fareHeader}
            >
              <AppText variant="label" style={{ color: palette.slate700 }}>
                Fare breakup (per seat)
              </AppText>
              <MaterialCommunityIcons
                name={fareOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={palette.slate500}
              />
            </Pressable>

            {!fareOpen ? (
              <View style={styles.fareCollapsed}>
                <AppText variant="body" style={{ color: palette.slate600 }}>
                  Base + {gstPct}% GST incl.
                </AppText>
                <AppText style={styles.fareCollapsedTotal}>{formatRupee(String(displayFare))}</AppText>
              </View>
            ) : (
              <View style={styles.breakRows}>
                <View style={styles.breakRow}>
                  <AppText variant="body" style={styles.breakLabel}>Seat fare (excl. GST, approx.)</AppText>
                  <AppText variant="body" style={styles.breakVal}>
                    {formatRupee(String(Math.round(breakup.baseExclGst)))}
                  </AppText>
                </View>
                <View style={styles.breakRow}>
                  <AppText variant="body" style={styles.breakLabel}>GST ({gstPct}%, included)</AppText>
                  <AppText variant="body" style={styles.breakVal}>
                    {formatRupee(String(Math.round(breakup.gstAmount)))}
                  </AppText>
                </View>
                <View style={styles.breakRow}>
                  <AppText variant="body" style={styles.breakLabel}>Platform / convenience fee</AppText>
                  <AppText variant="body" style={styles.breakVal}>
                    {formatRupee(String(breakup.platformFee))}
                  </AppText>
                </View>
                <View style={[styles.breakRow, styles.breakTotalRow]}>
                  <AppText style={styles.breakTotalLabel}>You pay</AppText>
                  <AppText style={styles.breakTotalVal}>{formatRupee(String(displayFare))}</AppText>
                </View>
                <AppText variant="caption" style={styles.breakDisclaimer}>
                  Exact tax lines and any state levies appear on your ticket after booking.
                  The GST split is an estimate when only the inclusive fare is shown.
                </AppText>
              </View>
            )}
          </View>

          {/* ── promo ────────────────────────────────────────────────────── */}
          {(schedule.operator_promo_title || schedule.platform_promo_line) ? (
            <View style={styles.promo}>
              <AppText variant="caption" style={styles.promoText}>
                {schedule.operator_promo_title || schedule.platform_promo_line}
              </AppText>
            </View>
          ) : null}
        </SurfaceCard>
      </ScrollView>

      {/* ── sticky footer CTA ────────────────────────────────────────────── */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.stickyFareHint}>
          <AppText variant="caption" style={styles.stickyFareLabel}>Per seat from</AppText>
          <AppText style={styles.stickyFareAmount}>{formatRupee(String(displayFare))}</AppText>
        </View>
        <PrimaryButton
          title="Choose seats"
          style={styles.stickyBtn}
          onPress={() =>
            router.push({
              pathname: "/select-seats",
              params: {
                schedule_id: String(schedule.id),
                date: d,
                from: fromL,
                to: toL,
                fare: schedule.fare,
                route_id: rid || "",
              },
            })
          }
        />
      </View>

      {/* ── full reviews bottom sheet ─────────────────────────────────────── */}
      {hasRating ? (
        <BusRatingSheet
          busId={schedule.bus.id}
          avg={ratingAvg}
          count={ratingCount}
          visible={ratingSheetOpen}
          onClose={() => setRatingSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: palette.slate50 },

  // hero
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  heroEyebrow: { color: "rgba(255,255,255,0.8)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  heroTime: { fontFamily: fonts.bold, fontSize: 28, color: "#fff" },
  heroDur: { color: "rgba(255,255,255,0.9)", marginTop: 8 },
  heroFareBlock: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.25)" },
  heroFareEyebrow: { color: "rgba(255,255,255,0.85)", marginBottom: 4 },
  heroFareRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 10 },
  heroFare: { fontFamily: fonts.bold, fontSize: 30, color: "#fff" },
  heroStrike: { fontFamily: fonts.medium, fontSize: 18, color: "rgba(255,255,255,0.55)", textDecorationLine: "line-through" },
  heroSave: { color: "rgba(255,255,255,0.9)", marginTop: 6 },

  // card
  card: { marginHorizontal: 16, marginTop: -22, zIndex: 2 },

  // ratings
  ratingBlock: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.slate100 },
  ratingTap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ratingBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm },
  ratingBadgeText: { fontFamily: fonts.bold },
  ratingMeta: { flex: 1 },

  // sections
  section: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.slate100 },
  sectionTitle: { marginBottom: 8, color: palette.slate700 },
  sectionBody: { color: palette.slate800 },
  sectionMuted: { color: palette.slate500, marginTop: 4 },

  // gallery
  photoStrip: { gap: 12, paddingRight: 8 },
  photoCard: { width: 132, height: 100, borderRadius: radii.md, padding: 12, justifyContent: "space-between" },
  photoCardLabel: { color: "rgba(255,255,255,0.95)", fontFamily: fonts.semibold },

  // feature chips
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: palette.slate100, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full },
  chipText: { color: palette.slate800, fontFamily: fonts.medium },

  // fare breakup
  fareHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  fareCollapsed: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.slate100,
  },
  fareCollapsedTotal: { fontFamily: fonts.bold, fontSize: 18, color: palette.indigo700 },
  breakRows: { gap: 10, marginTop: 10 },
  breakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  breakLabel: { color: palette.slate600, flex: 1 },
  breakVal: { fontFamily: fonts.medium, color: palette.slate900 },
  breakTotalRow: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.slate200 },
  breakTotalLabel: { fontFamily: fonts.bold, fontSize: 16, color: palette.indigo900 },
  breakTotalVal: { fontFamily: fonts.bold, fontSize: 16, color: palette.indigo700 },
  breakDisclaimer: { marginTop: 10, color: palette.slate500, lineHeight: 18 },

  // promo
  promo: { marginTop: 16, backgroundColor: palette.indigo50, padding: 12, borderRadius: radii.md },
  promoText: { color: palette.indigo900, fontFamily: fonts.medium },

  // sticky footer
  stickyFooter: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.slate100,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  stickyFareHint: { flex: 1 },
  stickyFareLabel: { color: palette.slate500 },
  stickyFareAmount: { fontFamily: fonts.bold, fontSize: 22, color: palette.indigo700 },
  stickyBtn: { flex: 1.6 },
});
