import { router, useLocalSearchParams } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SteeringWheelIcon } from "@/components/SteeringWheelIcon";
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
  const baseFare = useMemo(() => parseFloat(seatMap?.fare ?? fareParam ?? "0") || 0, [seatMap, fareParam]);
  const seatFare = useCallback(
    (label: string) => {
      const raw = seatMap?.seat_fares?.[label];
      const parsed = raw != null && String(raw).trim() !== "" ? parseFloat(raw) : baseFare;
      return Number.isFinite(parsed) ? parsed : 0;
    },
    [seatMap, baseFare]
  );

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
  const layoutWidth = cols * cell + (cols - 1) * gap;
  const hasUpperDeck = seatMap.layout.has_upper_deck !== false;
  const rawSplitRow = seatMap.layout.deck_split_row;
  const splitRow =
    !hasUpperDeck
      ? rows
      : typeof rawSplitRow === "number" && Number.isFinite(rawSplitRow) && rawSplitRow >= 1 && rawSplitRow < rows
      ? Math.floor(rawSplitRow)
      : Math.ceil(rows / 2);
  const showSplitDeck = hasUpperDeck && splitRow > 0 && splitRow < rows;
  const deckHeaderIconBox = 40;

  const renderSeatRows = (startRow: number, endRow: number, keyPrefix: string) =>
    Array.from({ length: endRow - startRow }, (_, rowOffset) => {
      const r = startRow + rowOffset;
      const isLast = r === endRow - 1;
      return (
        <View key={`${keyPrefix}-${r}`} style={[styles.row, { marginBottom: isLast ? 0 : gap }]}>
          {Array.from({ length: cols }, (_, c) => {
            const idx = r * cols + c;
            const label = labels[idx] ?? "";
            const cellType = String(seatTypes[idx] ?? "").toLowerCase();
            const seatType = resolveSeatType(seatTypes[idx]);
            const isOcc = Boolean(label && occupied.has(label));
            const isSel = Boolean(label && selected.includes(label));
            const empty = !label || !String(label).trim();
            const isAisle = empty && cellType === "aisle";
            const aisleWidth = Math.max(10, Math.floor(cell * 0.44));
            if (empty) {
              return (
                <View
                  key={c}
                  style={{
                    width: isAisle ? aisleWidth : cell,
                    height: cell,
                    marginRight: c < cols - 1 ? gap : 0,
                  }}
                />
              );
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
                {renderSeatTypeIcon(seatType, isSel ? "#fff" : isOcc ? palette.slate400 : palette.indigo600)}
                <AppText
                  numberOfLines={1}
                  style={[
                    styles.seatFareTxt,
                    isOcc && { color: palette.slate400 },
                    isSel && { color: "#fff" },
                  ]}
                >
                  {formatRupee(seatFare(label).toFixed(2))}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      );
    });

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
      <SurfaceCard style={{ marginBottom: 16, paddingVertical: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckScrollContent}>
          <View style={styles.decksRow}>
            <View style={[styles.deckCard, { width: layoutWidth }]}>
              <View style={styles.deckHeader}>
                <AppText variant="label" style={styles.deckLabel}>
                  {showSplitDeck ? "Lower deck" : "Seat layout"}
                </AppText>
                <View style={styles.driverSteering}>
                  <SteeringWheelIcon size={30} color={palette.slate400} />
                </View>
              </View>
              <View style={styles.layoutWrap}>{renderSeatRows(0, showSplitDeck ? splitRow : rows, "lower")}</View>
            </View>
            {showSplitDeck ? (
              <View style={[styles.deckCard, { width: layoutWidth }]}>
                <View style={styles.deckHeader}>
                  <AppText variant="label" style={styles.deckLabel}>
                    Upper deck
                  </AppText>
                  <View style={{ width: deckHeaderIconBox, height: deckHeaderIconBox }} />
                </View>
                <View style={styles.layoutWrap}>{renderSeatRows(splitRow, rows, "upper")}</View>
              </View>
            ) : null}
          </View>
        </ScrollView>
        <AppText variant="caption" style={{ textAlign: "center", marginTop: 12, color: palette.slate500 }}>
          Front of bus → (layout is schematic)
        </AppText>
      </SurfaceCard>

      <View style={styles.summary}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <AppText variant="label" style={{ color: palette.slate600 }}>
            Total
          </AppText>
          <AppText numberOfLines={1} variant="caption" style={{ marginTop: 3, color: palette.slate500 }}>
            {selected.length ? `${selected.length} selected` : "None selected"}
          </AppText>
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
  seatIcon: { marginBottom: 4 },
  seatSemiIcon: { marginBottom: 2, marginLeft: 1 },
  seatFareTxt: { fontFamily: fonts.medium, fontSize: 9, lineHeight: 11, color: palette.slate500 },
  deckScrollContent: { paddingHorizontal: 4 },
  decksRow: { flexDirection: "row", alignItems: "flex-start", columnGap: 14 },
  deckCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.slate50,
    padding: 10,
  },
  deckHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    minHeight: 40,
  },
  layoutWrap: { alignSelf: "center" },
  deckLabel: { color: palette.slate600 },
  driverSteering: {
    width: 40,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
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

function renderSeatTypeIcon(type: "Sleeper" | "Semi-sleeper" | "Seater", color: string) {
  if (type === "Sleeper") {
    return <FontAwesome name="bed" size={16} color={color} style={styles.seatIcon} />;
  }
  if (type === "Semi-sleeper") {
    return (
      <MaterialCommunityIcons name="seat-recline-extra" size={17} color={color} style={[styles.seatIcon, styles.seatSemiIcon]} />
    );
  }
  return <MaterialCommunityIcons name="seat-passenger" size={18} color={color} style={styles.seatIcon} />;
}
