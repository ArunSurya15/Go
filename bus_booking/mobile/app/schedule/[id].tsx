import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { durationLabel, formatRupee, formatTime } from "@/lib/format";
import { paramOne } from "@/lib/router-params";
import { routesApi } from "@/lib/api";
import type { Schedule } from "@/lib/types";

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

  useEffect(() => {
    if (!rid || !d || !sid) {
      setSchedule(null);
      return;
    }
    let alive = true;
    routesApi
      .schedules(Number(rid), d)
      .then((list) => {
        if (!alive) return;
        setSchedule(list.find((x) => x.id === Number(sid)) ?? null);
      })
      .catch(() => {
        if (alive) setSchedule(null);
      });
    return () => {
      alive = false;
    };
  }, [rid, d, sid]);

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
          <AppText variant="title" style={{ marginBottom: 8 }}>
            Trip not found
          </AppText>
          <AppText variant="body" style={{ marginBottom: 16 }}>
            This departure may have been removed. Go back and pick another bus.
          </AppText>
          <PrimaryButton title="Back to results" onPress={() => router.back()} />
        </SurfaceCard>
      </View>
    );
  }

  const busLabel =
    (schedule.bus.service_name && schedule.bus.service_name.trim()) || schedule.bus.registration_no;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={["#312e81", "#4f46e5", "#6366f1"]} style={[styles.hero, { paddingTop: 12 }]}>
        <AppText variant="caption" style={styles.heroEyebrow}>
          {fromL && toL ? `${fromL} → ${toL}` : "Trip"}
        </AppText>
        <AppText style={styles.heroTime}>
          {formatTime(schedule.departure_dt)} — {formatTime(schedule.arrival_dt)}
        </AppText>
        <AppText variant="subtitle" style={styles.heroDur}>
          {durationLabel(schedule.departure_dt, schedule.arrival_dt)} on road
        </AppText>
      </LinearGradient>

      <SurfaceCard style={styles.card}>
        <AppText variant="label" style={{ marginBottom: 6 }}>
          Bus
        </AppText>
        <AppText variant="title" style={{ fontSize: 18, marginBottom: 4 }}>
          {busLabel}
        </AppText>
        {schedule.bus.rating_count && schedule.bus.rating_avg ? (
          <AppText variant="body" style={{ color: palette.slate600 }}>
            ★ {Number(schedule.bus.rating_avg).toFixed(1)} · {schedule.bus.rating_count} ratings
          </AppText>
        ) : null}

        <View style={styles.priceBlock}>
          <AppText variant="caption" style={{ color: palette.slate500 }}>
            From
          </AppText>
          <AppText style={styles.bigFare}>{formatRupee(schedule.fare)}</AppText>
          <AppText variant="caption" style={{ color: palette.slate500 }}>
            per seat (taxes as per invoice)
          </AppText>
        </View>

        {(schedule.operator_promo_title || schedule.platform_promo_line) ? (
          <View style={styles.promo}>
            <AppText variant="caption" style={styles.promoText}>
              {schedule.operator_promo_title || schedule.platform_promo_line}
            </AppText>
          </View>
        ) : null}

        <View style={styles.ctaBox}>
          <PrimaryButton
            title="Choose seats"
            style={{ marginTop: 8 }}
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
      </SurfaceCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: palette.slate50 },
  center: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: palette.slate50 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  heroEyebrow: { color: "rgba(255,255,255,0.8)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  heroTime: { fontFamily: fonts.bold, fontSize: 28, color: "#fff" },
  heroDur: { color: "rgba(255,255,255,0.9)", marginTop: 8 },
  card: { marginHorizontal: 16, marginTop: -18, zIndex: 2 },
  priceBlock: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.slate100 },
  bigFare: { fontFamily: fonts.bold, fontSize: 32, color: palette.indigo700, marginVertical: 4 },
  promo: {
    marginTop: 16,
    backgroundColor: palette.indigo50,
    padding: 12,
    borderRadius: radii.md,
  },
  promoText: { color: palette.indigo900, fontFamily: fonts.medium },
  ctaBox: { marginTop: 24 },
});
