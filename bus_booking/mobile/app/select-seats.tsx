import { router, useLocalSearchParams } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { formatRupee } from "@/lib/format";
import { mergeBookingFlow } from "@/lib/booking-flow";
import { paramOne } from "@/lib/router-params";
import { bookingApi, routesApi } from "@/lib/api";
import type { SeatMapResponse } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export default function SelectSeatsScreen() {
  const insets = useSafeAreaInsets();
  const { access, isReady, getValidToken } = useAuth();
  const params = useLocalSearchParams<{
    schedule_id: string;
    date: string;
    from: string;
    to: string;
    fare: string;
    route_id: string;
  }>();

  const scheduleId = Number(paramOne(params.schedule_id));
  const date = paramOne(params.date);
  const from = paramOne(params.from);
  const to = paramOne(params.to);
  const fareParam = paramOne(params.fare) || "0";
  const routeId = paramOne(params.route_id);

  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [seatMapErr, setSeatMapErr] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!scheduleId) return;
    routesApi
      .scheduleSeatMap(scheduleId)
      .then(setSeatMap)
      .catch((e) => setSeatMapErr(e instanceof Error ? e.message : "Failed to load seat map"));
  }, [scheduleId]);

  const fare = seatMap?.fare ?? fareParam;

  const amount = useMemo(() => {
    if (selected.length === 0) return 0;
    const base = parseFloat(seatMap?.fare ?? fareParam ?? "0") || 0;
    const map = seatMap?.seat_fares;
    return selected.reduce((sum, label) => {
      const raw = map?.[label];
      const unit = raw != null && String(raw).trim() !== "" ? parseFloat(raw) : base;
      return sum + (Number.isFinite(unit) ? unit : 0);
    }, 0);
  }, [selected, seatMap, fareParam]);

  const occupied = useMemo(() => new Set(seatMap?.occupied ?? []), [seatMap]);

  const toggle = useCallback(
    (label: string) => {
      if (!label.trim() || occupied.has(label)) return;
      setSelected((prev) =>
        prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
      );
    },
    [occupied]
  );

  const onContinue = async () => {
    setErr("");
    if (selected.length === 0) {
      setErr("Select at least one seat.");
      return;
    }
    const token = await getValidToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      await bookingApi.reserve(token, scheduleId, selected);
      await mergeBookingFlow({
        schedule_id: scheduleId,
        route_id: routeId ? Number(routeId) : undefined,
        date,
        from,
        to,
        fare: String(fare),
        seats: selected,
        amount: amount.toFixed(2),
      });
      router.push({
        pathname: "/board-drop",
        params: { schedule_id: String(scheduleId) },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reserve failed.";
      setErr(
        msg.toLowerCase().includes("token") || msg.includes("401")
          ? "Session expired. Sign in again."
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.indigo600} />
      </View>
    );
  }

  if (!access) {
    return (
      <View style={[styles.center, { padding: 20 }]}>
        <SurfaceCard>
          <AppText variant="title" style={{ marginBottom: 8 }}>
            Sign in to book
          </AppText>
          <AppText variant="body" style={{ marginBottom: 16, color: palette.slate600 }}>
            Choose seats after you log in with your passenger account.
          </AppText>
          <PrimaryButton title="Sign in" onPress={() => router.push("/login")} />
        </SurfaceCard>
      </View>
    );
  }

  if (!scheduleId || !date) {
    return (
      <View style={[styles.center, { padding: 20 }]}>
        <AppText variant="body">Invalid trip link.</AppText>
        <PrimaryButton title="Go back" variant="outline" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (seatMapErr) {
    return (
      <View style={[styles.center, { padding: 20 }]}>
        <AppText style={{ color: palette.rose500, textAlign: "center" }}>{seatMapErr}</AppText>
        <PrimaryButton title="Back" variant="outline" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!seatMap) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.indigo600} />
        <AppText variant="caption" style={{ marginTop: 12, color: palette.slate500 }}>
          Loading seat map…
        </AppText>
      </View>
    );
  }

  const { rows, cols, labels } = seatMap.layout;
  const seatTypes = seatMap.layout.types ?? [];
  const cell = 54;
  const gap = 6;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16, paddingTop: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="caption" style={styles.routeHint}>
        {from} → {to}
      </AppText>
      <AppText variant="title" style={{ marginBottom: 4 }}>
        Select seats
      </AppText>
      <AppText variant="body" style={{ color: palette.slate600, marginBottom: 16 }}>
        Tap seats to add or remove. {selected.length ? `${selected.length} selected` : "None selected"}
      </AppText>
      <View style={styles.legendRow}>
        <LegendChip label="Sleeper" tone="sleep" />
        <LegendChip label="Semi-sleeper" tone="semi" />
        <LegendChip label="Seater" tone="seat" />
      </View>

      <SurfaceCard style={{ marginBottom: 16, paddingVertical: 12 }}>
        <View style={{ alignSelf: "center" }}>
          {Array.from({ length: rows }, (_, r) => (
            <View key={r} style={[styles.row, { marginBottom: r < rows - 1 ? gap : 0 }]}>
              {Array.from({ length: cols }, (_, c) => {
                const idx = r * cols + c;
                const label = labels[idx] ?? "";
                const seatType = resolveSeatType(seatTypes[idx]);
                const seatMeta = seatTypeMeta(seatType);
                const isOcc = Boolean(label && occupied.has(label));
                const isSel = Boolean(label && selected.includes(label));
                const empty = !label || !String(label).trim();
                if (empty) {
                  return <View key={c} style={{ width: cell, height: cell, marginRight: c < cols - 1 ? gap : 0 }} />;
                }
                return (
                  <Pressable
                    key={c}
                    onPress={() => toggle(label)}
                    disabled={isOcc}
                    style={({ pressed }) => [
                      styles.seat,
                      { width: cell, height: cell, marginRight: c < cols - 1 ? gap : 0 },
                      isOcc && styles.seatOcc,
                      isSel && styles.seatSel,
                      !isOcc && !isSel && pressed && { opacity: 0.85 },
                    ]}
                  >
                    <AppText
                      style={[
                        styles.seatTxt,
                        isOcc && { color: palette.slate400 },
                        isSel && { color: "#fff" },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </AppText>
                    <AppText
                      numberOfLines={1}
                      style={[
                        styles.seatTypeTxt,
                        isOcc && { color: palette.slate400 },
                        isSel && { color: "#fff" },
                      ]}
                    >
                      <FontAwesome
                        name={seatMeta.icon}
                        size={8}
                        color={isSel ? "#fff" : isOcc ? palette.slate400 : seatMeta.color}
                      />{" "}
                      {seatMeta.short}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <AppText variant="caption" style={{ textAlign: "center", marginTop: 12, color: palette.slate500 }}>
          Front of bus → (layout is schematic)
        </AppText>
      </SurfaceCard>

      <View style={styles.summary}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <AppText variant="label" style={{ color: palette.slate600 }}>
            Total
          </AppText>
          {selected.length ? (
            <AppText numberOfLines={2} variant="caption" style={{ marginTop: 3, color: palette.slate500 }}>
              {selected
                .map((seatNo) => {
                  const i = labels.indexOf(seatNo);
                  const t = i >= 0 ? resolveSeatType(seatTypes[i]) : "Seat";
                  return `${seatNo} (${seatTypeMeta(t).short})`;
                })
                .join(", ")}
            </AppText>
          ) : null}
        </View>
        <AppText style={styles.totalAmt}>{formatRupee(amount.toFixed(2))}</AppText>
      </View>

      {err ? (
        <AppText variant="caption" style={{ color: palette.rose500, marginBottom: 12 }}>
          {err}
        </AppText>
      ) : null}

      <PrimaryButton
        title={busy ? "Holding seats…" : "Continue to boarding / drop"}
        loading={busy}
        onPress={() => void onContinue()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  routeHint: { color: palette.slate500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center" },
  seat: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
  },
  seatOcc: {
    backgroundColor: palette.slate100,
    borderColor: palette.slate200,
  },
  seatSel: {
    backgroundColor: palette.indigo600,
    borderColor: palette.indigo600,
  },
  seatTxt: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, color: palette.slate800 },
  seatTypeTxt: { fontFamily: fonts.medium, fontSize: 9, lineHeight: 11, color: palette.slate500, marginTop: 2 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  totalAmt: { fontFamily: fonts.bold, fontSize: 22, color: palette.indigo700 },
});

function resolveSeatType(raw?: string): "Sleeper" | "Semi-sleeper" | "Seater" {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return "Seater";
  if (v.includes("semi")) return "Semi-sleeper";
  if (v.includes("sleep")) return "Sleeper";
  return "Seater";
}

function LegendChip({ label, tone }: { label: string; tone: "sleep" | "semi" | "seat" }) {
  const bg =
    tone === "sleep" ? "#e0e7ff" : tone === "semi" ? "#ede9fe" : "#ecfeff";
  const fg =
    tone === "sleep" ? "#3730a3" : tone === "semi" ? "#5b21b6" : "#155e75";
  const icon = tone === "sleep" ? "bed" : tone === "semi" ? "moon-o" : "user";
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <FontAwesome name={icon} size={11} color={fg} style={{ marginRight: 6 }} />
      <AppText variant="caption" style={{ color: fg, fontFamily: fonts.semibold }}>
        {label}
      </AppText>
    </View>
  );
}

function seatTypeMeta(type: string): {
  short: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
} {
  if (type === "Sleeper") return { short: "Sleep", icon: "bed", color: "#3730a3" };
  if (type === "Semi-sleeper") return { short: "Semi", icon: "moon-o", color: "#5b21b6" };
  return { short: "Seat", icon: "user", color: "#155e75" };
}
