import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { formatTime } from "@/lib/format";
import { paramOne } from "@/lib/router-params";

type Coord = { latitude: number; longitude: number };
type TrackingState = "TRACKING" | "ARRIVING" | "NEAR_DESTINATION" | "COMPLETED";

const CITY_COORDS: Record<string, Coord> = {
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
  puducherry: { latitude: 11.9416, longitude: 79.8083 },
  pondicherry: { latitude: 11.9416, longitude: 79.8083 },
  chennai: { latitude: 13.0827, longitude: 80.2707 },
  hyderabad: { latitude: 17.385, longitude: 78.4867 },
  coimbatore: { latitude: 11.0168, longitude: 76.9558 },
  madurai: { latitude: 9.9252, longitude: 78.1198 },
  mysuru: { latitude: 12.2958, longitude: 76.6394 },
  hebbal: { latitude: 13.0352, longitude: 77.597 },
  bellandur: { latitude: 12.9279, longitude: 77.6762 },
  marathahalli: { latitude: 12.9591, longitude: 77.6974 },
  nagawara: { latitude: 13.0432, longitude: 77.6244 },
  tinfactory: { latitude: 13.0065, longitude: 77.6634 },
  krpuram: { latitude: 13.0157, longitude: 77.6956 },
};

function resolveCityCoord(city: string, fallback: Coord): Coord {
  const key = city.trim().toLowerCase();
  return CITY_COORDS[key] || fallback;
}

function normPlace(v: string): string {
  return v.trim().toLowerCase().replace(/[^a-z]/g, "");
}

function interpolateCoord(from: Coord, to: Coord, t: number): Coord {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

function createDemoRoute(from: Coord, to: Coord): Coord[] {
  return [
    from,
    interpolateCoord(from, to, 0.22),
    interpolateCoord(from, to, 0.45),
    interpolateCoord(from, to, 0.7),
    to,
  ];
}

function createRoadLikeRoute(fromLabel: string, toLabel: string, from: Coord, to: Coord): Coord[] {
  const f = normPlace(fromLabel);
  const t = normPlace(toLabel);

  // Bellandur-bound bus from Hebbal via ORR-like bends.
  if ((f === "hebbal" && t === "bellandur") || (f === "bellandur" && t === "hebbal")) {
    const he = CITY_COORDS.hebbal;
    const na = CITY_COORDS.nagawara;
    const tf = CITY_COORDS.tinfactory;
    const kp = CITY_COORDS.krpuram;
    const ma = CITY_COORDS.marathahalli;
    const be = CITY_COORDS.bellandur;
    const forward = [he, na, tf, kp, ma, be];
    return f === "hebbal" ? forward : [...forward].reverse();
  }

  if (
    (["bengaluru", "bangalore"].includes(f) && ["pondicherry", "puducherry"].includes(t)) ||
    (["pondicherry", "puducherry"].includes(f) && ["bengaluru", "bangalore"].includes(t))
  ) {
    const he = CITY_COORDS.hebbal;
    const na = CITY_COORDS.nagawara;
    const tf = CITY_COORDS.tinfactory;
    const kp = CITY_COORDS.krpuram;
    const ma = CITY_COORDS.marathahalli;
    const be = CITY_COORDS.bellandur;
    const ec: Coord = { latitude: 12.8399, longitude: 77.677 };
    const hs: Coord = { latitude: 12.7409, longitude: 77.8253 };
    const kg: Coord = { latitude: 12.5266, longitude: 78.2137 };
    const ti: Coord = { latitude: 12.2253, longitude: 79.0747 };
    const po = CITY_COORDS.pondicherry;
    const forward = [he, na, tf, kp, ma, be, ec, hs, kg, ti, po];
    return ["bengaluru", "bangalore"].includes(f) ? forward : [...forward].reverse();
  }

  return createDemoRoute(from, to);
}

function pointAtProgress(path: Coord[], progress: number): Coord {
  if (path.length < 2) return path[0] || { latitude: 0, longitude: 0 };
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const dx = path[i + 1].latitude - path[i].latitude;
    const dy = path[i + 1].longitude - path[i].longitude;
    const len = Math.hypot(dx, dy);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) return path[0];
  let target = total * Math.max(0, Math.min(1, progress));
  for (let i = 0; i < segLens.length; i += 1) {
    if (target <= segLens[i]) {
      const t = segLens[i] > 0 ? target / segLens[i] : 0;
      return interpolateCoord(path[i], path[i + 1], t);
    }
    target -= segLens[i];
  }
  return path[path.length - 1];
}

export default function LiveTrackingDemoScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    schedule_id: string;
    from: string;
    to: string;
    dep: string;
    arr: string;
    bus: string;
  }>();

  const from = paramOne(params.from) || "Origin";
  const to = paramOne(params.to) || "Destination";
  const dep = paramOne(params.dep);
  const arr = paramOne(params.arr);
  const bus = paramOne(params.bus) || "e-GO Service";
  const depDate = dep ? new Date(dep) : null;
  const minsToDeparture = depDate ? Math.round((depDate.getTime() - Date.now()) / 60000) : null;
  const isWithinLiveWindow = minsToDeparture !== null ? minsToDeparture <= 60 : true;

  const fromCoord = useMemo(() => resolveCityCoord(from, { latitude: 12.9716, longitude: 77.5946 }), [from]);
  const toCoord = useMemo(() => resolveCityCoord(to, { latitude: 11.9416, longitude: 79.8083 }), [to]);
  const routePolyline = useMemo(() => createRoadLikeRoute(from, to, fromCoord, toCoord), [from, to, fromCoord, toCoord]);
  const routeStops = useMemo(() => {
    const f = normPlace(from);
    const t = normPlace(to);
    if ((f === "hebbal" && t === "bellandur") || (f === "bellandur" && t === "hebbal")) {
      const forward = ["Hebbal", "Nagawara", "Tin Factory", "KR Puram", "Marathahalli", "Bellandur"];
      return f === "hebbal" ? forward : [...forward].reverse();
    }
    if (
      (["bengaluru", "bangalore"].includes(f) && ["pondicherry", "puducherry"].includes(t)) ||
      (["pondicherry", "puducherry"].includes(f) && ["bengaluru", "bangalore"].includes(t))
    ) {
      const forward = [
        "Hebbal (start)",
        "Nagawara",
        "Tin Factory",
        "KR Puram",
        "Marathahalli",
        "Bellandur (boarding)",
        "Electronic City",
        "Hosur",
        "Krishnagiri",
        "Tindivanam",
        "Pondicherry",
      ];
      return ["bengaluru", "bangalore"].includes(f) ? forward : [...forward].reverse();
    }
    return [from, "Checkpoint 1", "Checkpoint 2", "Checkpoint 3", to];
  }, [from, to]);
  const trackingPolyline = routePolyline;
  const trackingStops = routeStops;
  const trackingFromCoord = trackingPolyline[0] || fromCoord;
  const trackingToCoord = trackingPolyline[trackingPolyline.length - 1] || toCoord;

  const [progress, setProgress] = useState(0.18);
  const [delayMin, setDelayMin] = useState(0);
  const [busCoord, setBusCoord] = useState<Coord>(() => pointAtProgress(trackingPolyline, 0.18));
  const [forceDemo, setForceDemo] = useState(false);

  useEffect(() => {
    const ticker = setInterval(() => {
      setProgress((p) => {
        const next = p + 0.02;
        return next >= 1 ? 1 : next;
      });
    }, 1200);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    setBusCoord(pointAtProgress(trackingPolyline, progress));
  }, [trackingPolyline, progress]);

  const currentLeg = Math.min(trackingStops.length - 2, Math.max(0, Math.floor(progress * (trackingStops.length - 1))));
  const etaMin = Math.max(8, Math.round((1 - progress) * 95) + delayMin);
  const reachedPct = Math.round(progress * 100);
  const latDelta = Math.max(0.06, Math.abs(trackingFromCoord.latitude - trackingToCoord.latitude) * 1.65);
  const lngDelta = Math.max(0.06, Math.abs(trackingFromCoord.longitude - trackingToCoord.longitude) * 1.65);
  const hasGoogleProvider = Platform.OS === "android";
  const trackingState: TrackingState = progress >= 1 ? "COMPLETED" : progress >= 0.88 ? "NEAR_DESTINATION" : progress >= 0.58 ? "ARRIVING" : "TRACKING";
  const trackingStateText =
    trackingState === "TRACKING"
      ? "Bus is en route"
      : trackingState === "ARRIVING"
        ? "Bus is on the way with live GPS updates"
        : trackingState === "NEAR_DESTINATION"
          ? "Bus is nearing destination"
          : "Trip completed - tracking ended";

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <SurfaceCard style={styles.heroCard}>
        <AppText variant="caption" style={styles.demoTag}>Demo preview (fake data)</AppText>
        <AppText variant="subtitle" style={styles.busName}>{bus}</AppText>
        <AppText style={styles.routeText}>{from} → {to}</AppText>
        <View style={styles.metaRow}>
          <AppText variant="caption" style={styles.metaText}>Dep {dep ? formatTime(dep) : "--:--"}</AppText>
          <AppText variant="caption" style={styles.metaText}>Arr {arr ? formatTime(arr) : "--:--"}</AppText>
          <AppText variant="caption" style={styles.metaText}>ETA {etaMin} min</AppText>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.mapCard}>
        <View style={styles.trackHeader}>
          <AppText style={styles.trackTitle}>Live movement on map (demo)</AppText>
          <AppText variant="caption" style={styles.progressText}>{reachedPct}% route covered</AppText>
        </View>
        <View style={[styles.statePill, trackingState === "COMPLETED" ? styles.statePillClosed : styles.statePillLive]}>
          <AppText variant="caption" style={[styles.statePillText, trackingState === "COMPLETED" && styles.statePillTextClosed]}>
            {trackingStateText}
          </AppText>
        </View>

        {!isWithinLiveWindow && !forceDemo ? (
          <View style={styles.lockedWrap}>
            <AppText style={styles.lockedTitle}>Live tracking starts 1 hour before departure</AppText>
            <AppText variant="caption" style={styles.lockedSub}>
              {minsToDeparture !== null
                ? `Trip departs in about ${Math.max(0, minsToDeparture)} min. You can test demo tracking now.`
                : "Departure time unavailable. You can still run demo tracking now."}
            </AppText>
            <PrimaryButton title="Start demo tracking now" variant="outline" onPress={() => setForceDemo(true)} />
          </View>
        ) : (
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              provider={hasGoogleProvider ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                latitude: (trackingFromCoord.latitude + trackingToCoord.latitude) / 2,
                longitude: (trackingFromCoord.longitude + trackingToCoord.longitude) / 2,
                latitudeDelta: latDelta,
                longitudeDelta: lngDelta,
              }}
            >
              <Polyline coordinates={trackingPolyline} strokeColor={palette.indigo500} strokeWidth={5} />
              <Marker coordinate={trackingFromCoord} title={trackingStops[0] || from} pinColor="#10b981" />
              <Marker coordinate={trackingToCoord} title={trackingStops[trackingStops.length - 1] || to} pinColor="#ef4444" />
              {trackingState !== "COMPLETED" ? (
                <Marker coordinate={busCoord} title="e-GO Bus (Demo)">
                  <View style={styles.busMarker}>
                    <FontAwesome name="bus" size={12} color={palette.white} />
                  </View>
                </Marker>
              ) : null}
            </MapView>
          </View>
        )}

        <View style={styles.stopsRow}>
          {trackingStops.map((s, i) => {
            const stopPct = i / (trackingStops.length - 1);
            const passed = progress >= stopPct;
            const active = i === currentLeg || i === currentLeg + 1;
            return (
              <View key={`${s}-${i}`} style={styles.stopItem}>
                <View style={[styles.stopDot, passed && styles.stopDotPassed, active && styles.stopDotActive]} />
                <AppText numberOfLines={1} variant="caption" style={[styles.stopText, passed && styles.stopTextPassed]}>
                  {s}
                </AppText>
              </View>
            );
          })}
        </View>

        <View style={styles.legInfo}>
          <AppText variant="caption" style={styles.legLabel}>Now between</AppText>
          <AppText style={styles.legValue}>{trackingStops[currentLeg]} → {trackingStops[currentLeg + 1]}</AppText>
        </View>
      </SurfaceCard>

      <View style={styles.actions}>
        <Pressable style={styles.delayBtn} onPress={() => setDelayMin((d) => d + 4)}>
          <FontAwesome name="clock-o" size={14} color={palette.slate700} style={{ marginRight: 6 }} />
          <AppText variant="caption" style={styles.delayText}>Simulate +4 min delay</AppText>
        </Pressable>
        <PrimaryButton title="Back to trip" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50, padding: 16, gap: 12 },
  heroCard: { padding: 14 },
  demoTag: { color: palette.indigo700, fontFamily: fonts.semibold, marginBottom: 4 },
  busName: { fontFamily: fonts.bold, color: palette.slate900 },
  routeText: { marginTop: 3, color: palette.slate700 },
  metaRow: { marginTop: 8, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  metaText: { color: palette.slate500 },
  mapCard: { padding: 14 },
  trackHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  trackTitle: { fontFamily: fonts.semibold, color: palette.slate900 },
  progressText: { color: palette.indigo700 },
  statePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  statePillLive: { backgroundColor: "#e0e7ff" },
  statePillClosed: { backgroundColor: "#e2e8f0" },
  statePillText: { color: "#3730a3", fontFamily: fonts.medium },
  statePillTextClosed: { color: "#334155" },
  mapWrap: {
    height: 280,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.slate200,
  },
  map: { flex: 1 },
  lockedWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  lockedTitle: { fontFamily: fonts.semibold, color: palette.slate900 },
  lockedSub: { color: palette.slate600 },
  busMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.indigo700,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.indigo900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  stopsRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  stopItem: { width: "19%", alignItems: "center" },
  stopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.slate300 },
  stopDotPassed: { backgroundColor: palette.indigo500 },
  stopDotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.indigo700 },
  stopText: { marginTop: 4, color: palette.slate500, textAlign: "center" },
  stopTextPassed: { color: palette.indigo700, fontFamily: fonts.medium },
  legInfo: { marginTop: 12, borderRadius: radii.md, backgroundColor: palette.indigo50, padding: 10 },
  legLabel: { color: palette.indigo700 },
  legValue: { marginTop: 2, color: palette.indigo900, fontFamily: fonts.semibold },
  actions: { marginTop: "auto", gap: 10 },
  delayBtn: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  delayText: { color: palette.slate700 },
});
