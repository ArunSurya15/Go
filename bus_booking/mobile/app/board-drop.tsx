import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { mergeBookingFlow } from "@/lib/booking-flow";
import { paramOne } from "@/lib/router-params";
import { pointsApi } from "@/lib/api";
import type { BoardingPoint, DroppingPoint } from "@/lib/types";

function formatPointTime(iso: string) {
  if (!iso) return "—";
  if (iso.length <= 5 && iso.includes(":")) return iso;
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "—";
  }
}

export default function BoardDropScreen() {
  const insets = useSafeAreaInsets();
  const { schedule_id: sidRaw } = useLocalSearchParams<{ schedule_id: string }>();
  const scheduleId = Number(paramOne(sidRaw));

  const [boarding, setBoarding] = useState<BoardingPoint[]>([]);
  const [dropping, setDropping] = useState<DroppingPoint[]>([]);
  const [boardingId, setBoardingId] = useState<number | null>(null);
  const [droppingId, setDroppingId] = useState<number | null>(null);
  const [tab, setTab] = useState<"boarding" | "dropping">("boarding");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      return;
    }
    Promise.all([pointsApi.boarding(scheduleId), pointsApi.dropping(scheduleId)])
      .then(([b, d]) => {
        setBoarding(b);
        setDropping(d);
        if (b.length === 1) setBoardingId(b[0].id);
        if (d.length === 1) setDroppingId(d[0].id);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load points."))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  const canContinue =
    (boarding.length === 0 || boardingId != null) && (dropping.length === 0 || droppingId != null);

  const onContinue = async () => {
    await mergeBookingFlow({
      boarding_point_id: boardingId ?? undefined,
      dropping_point_id: droppingId ?? undefined,
    });
    router.push({
      pathname: "/passenger",
      params: { schedule_id: String(scheduleId) },
    });
  };

  if (!scheduleId) {
    return (
      <View style={styles.center}>
        <AppText>Invalid link.</AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      <AppText variant="caption" style={styles.step}>
        Step 2 of 4 · Boarding & drop-off
      </AppText>

      {err ? (
        <AppText style={{ color: palette.rose500, marginBottom: 12 }}>{err}</AppText>
      ) : null}

      <View style={styles.tabs}>
        <Pressable style={[styles.tabBtn, tab === "boarding" && styles.tabBtnOn]} onPress={() => setTab("boarding")}>
          <AppText variant="caption" style={tab === "boarding" ? styles.tabTxtOn : styles.tabTxt}>
            Boarding
          </AppText>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === "dropping" && styles.tabBtnOn]} onPress={() => setTab("dropping")}>
          <AppText variant="caption" style={tab === "dropping" ? styles.tabTxtOn : styles.tabTxt}>
            Drop-off
          </AppText>
        </Pressable>
      </View>

      {tab === "boarding" ? (
        <SurfaceCard style={{ marginBottom: 20 }}>
          <AppText variant="title" style={{ marginBottom: 4 }}>
            Boarding
          </AppText>
          {loading ? <AppText variant="body">Loading…</AppText> : null}
          {!loading && boarding.length === 0 ? (
            <AppText variant="body" style={{ color: palette.slate600 }}>
              No boarding points — continue.
            </AppText>
          ) : null}
          {!loading &&
            boarding.map((bp) => {
              const sel = boardingId === bp.id;
              return (
                <Pressable
                  key={bp.id}
                  onPress={() => {
                    setBoardingId(bp.id);
                    if (dropping.length > 0) setTab("dropping");
                  }}
                  style={[styles.pointRow, sel && styles.pointRowSel]}
                >
                  <AppText style={styles.time}>{formatPointTime(bp.time)}</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.loc}>{bp.location_name}</AppText>
                    {bp.landmark ? (
                      <AppText variant="caption" style={{ color: palette.slate500 }}>
                        {bp.landmark}
                      </AppText>
                    ) : null}
                  </View>
                  <View style={[styles.radio, sel && styles.radioSel]} />
                </Pressable>
              );
            })}
        </SurfaceCard>
      ) : (
        <SurfaceCard style={{ marginBottom: 20 }}>
          <AppText variant="title" style={{ marginBottom: 4 }}>
            Drop-off
          </AppText>
          {loading ? <AppText variant="body">Loading…</AppText> : null}
          {!loading && dropping.length === 0 ? (
            <AppText variant="body" style={{ color: palette.slate600 }}>
              No drop points — continue.
            </AppText>
          ) : null}
          {!loading &&
            dropping.map((dp) => {
              const sel = droppingId === dp.id;
              return (
                <Pressable
                  key={dp.id}
                  onPress={() => setDroppingId(dp.id)}
                  style={[styles.pointRow, sel && styles.pointRowSel]}
                >
                  <AppText style={styles.time}>{formatPointTime(dp.time)}</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.loc}>{dp.location_name}</AppText>
                    {dp.description ? (
                      <AppText variant="caption" style={{ color: palette.slate500 }}>
                        {dp.description}
                      </AppText>
                    ) : null}
                  </View>
                  <View style={[styles.radio, sel && styles.radioSel]} />
                </Pressable>
              );
            })}
        </SurfaceCard>
      )}

      <PrimaryButton title="Continue" disabled={!canContinue} onPress={() => void onContinue()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  step: { color: palette.slate500, marginBottom: 12 },
  tabs: {
    flexDirection: "row",
    backgroundColor: palette.slate100,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    borderRadius: radii.sm,
    paddingVertical: 8,
    alignItems: "center",
  },
  tabBtnOn: { backgroundColor: palette.white },
  tabTxt: { color: palette.slate600 },
  tabTxtOn: { color: palette.indigo700, fontFamily: fonts.semibold },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.slate200,
    marginBottom: 8,
    gap: 10,
  },
  pointRowSel: {
    borderColor: palette.indigo500,
    backgroundColor: palette.indigo50,
  },
  time: { fontFamily: fonts.semibold, width: 48, color: palette.indigo700 },
  loc: { fontFamily: fonts.medium, fontSize: 15 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.slate200,
  },
  radioSel: { borderColor: palette.indigo600, backgroundColor: palette.indigo600 },
});
