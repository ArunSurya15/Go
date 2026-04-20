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
import { AppProblemState } from "@/components/ui/AppProblemState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { formatRupee } from "@/lib/format";
import { mergeBookingFlow } from "@/lib/booking-flow";
import { computeFemaleOnlySeatLabels, computeMaleOnlySeatLabels } from "@/lib/seat-rules";
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
  const [ruleTip, setRuleTip] = useState<{ label: string; kind: "male" | "female" } | null>(null);

  useEffect(() => {
    if (!ruleTip) return;
    const t = setTimeout(() => setRuleTip(null), 1500);
    return () => clearTimeout(t);
  }, [ruleTip]);

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
  const genderMap = useMemo(() => {
    const m = new Map<string, string>();
    seatMap?.occupied_details?.forEach((o) => {
      if (o.label) m.set(o.label, (o.gender || "").toString().toUpperCase());
    });
    return m;
  }, [seatMap]);
  const femaleOnlySet = useMemo(() => {
    if (!seatMap) return new Set<string>();
    return computeFemaleOnlySeatLabels(seatMap.layout, occupied, genderMap);
  }, [seatMap, occupied, genderMap]);
  const maleOnlySet = useMemo(() => {
    if (!seatMap) return new Set<string>();
    return computeMaleOnlySeatLabels(seatMap.layout, occupied, genderMap);
  }, [seatMap, occupied, genderMap]);
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

  const legendSeatKinds = useMemo(() => {
    if (!seatMap) return [];
    const kinds = new Set<"Sleeper" | "Semi-sleeper" | "Seater">();
    const labs = seatMap.layout.labels ?? [];
    const types = seatMap.layout.types ?? [];
    for (let i = 0; i < labs.length; i++) {
      const lab = labs[i];
      if (!lab || !String(lab).trim()) continue;
      const cellType = String(types[i] ?? "").toLowerCase();
      if (cellType === "aisle" || cellType === "blank") continue;
      kinds.add(resolveSeatType(types[i]));
    }
    const order: ("Seater" | "Semi-sleeper" | "Sleeper")[] = ["Seater", "Semi-sleeper", "Sleeper"];
    return order.filter((k) => kinds.has(k));
  }, [seatMap]);

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
        <AppProblemState
          eyebrow="Page not found"
          title="Oops,"
          highlight="wrong stop!"
          description="We can't find this trip link. Try going back and search buses again."
          primaryAction={{ label: "Go Home", onPress: () => router.replace("/(tabs)") }}
          secondaryAction={{ label: "Search buses", onPress: () => router.back() }}
        />
      </View>
    );
  }

  if (seatMapErr) {
    return (
      <View style={[styles.center, { padding: 20 }]}>
        <AppProblemState
          eyebrow="Loading issue"
          title="Oops,"
          highlight="hit a bump!"
          description={seatMapErr || "Couldn't load seats right now. Please try again."}
          primaryAction={{ label: "Try again", onPress: () => router.replace({ pathname: "/select-seats", params }) }}
          secondaryAction={{ label: "Search buses", onPress: () => router.back() }}
        />
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
  const hasOnlySleeper = legendSeatKinds.length > 0 && legendSeatKinds.every((kind) => kind === "Sleeper");

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
            const bookedG = bookedGenderFromMap(genderMap, label);
            const isOccFemale = isOcc && bookedG === "F";
            const isOccMale = isOcc && bookedG === "M";
            const isFemaleOnly = !isOcc && femaleOnlySet.has(label);
            const isMaleOnly = !isOcc && maleOnlySet.has(label) && !femaleOnlySet.has(label);
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
                onPress={() => {
                  if (!selected.includes(label)) {
                    if (isFemaleOnly) {
                      setRuleTip({ label, kind: "female" });
                    } else if (isMaleOnly) {
                      setRuleTip({ label, kind: "male" });
                    }
                  }
                  toggle(label);
                }}
                disabled={isOcc}
                style={({ pressed }) => [
                  styles.seat,
                  { width: cell, height: cell, marginRight: c < cols - 1 ? gap : 0 },
                  ruleTip?.label === label && styles.seatTipHost,
                  isOcc && styles.seatOccDim,
                  isOccFemale && styles.seatOccFemale,
                  isOccMale && styles.seatOccMale,
                  isOcc && !isOccFemale && !isOccMale && styles.seatOccUnknown,
                  isFemaleOnly && !isSel && styles.seatFemaleOnly,
                  isMaleOnly && !isSel && styles.seatMaleOnly,
                  isSel && styles.seatSel,
                  !isOcc && !isSel && pressed && { opacity: 0.85 },
                ]}
              >
                {renderSeatTypeIcon(
                  seatType,
                  seatIconColor({ isSel, isOcc, isOccFemale, isOccMale, isFemaleOnly, isMaleOnly })
                )}
                {ruleTip?.label === label ? (
                  <View pointerEvents="none" style={styles.ruleTipWrap}>
                    <View style={styles.ruleTipBubble}>
                      <AppText style={styles.ruleTipPrice}>{formatRupee(seatFare(label).toFixed(2))}</AppText>
                      <AppText style={styles.ruleTipText}>{ruleTip.kind === "male" ? "Male only" : "Female only"}</AppText>
                    </View>
                    <View style={styles.ruleTipCaret} />
                  </View>
                ) : null}
                <AppText
                  numberOfLines={1}
                  style={[
                    isOcc ? styles.seatSoldTxt : styles.seatFareTxt,
                    isOccFemale && styles.seatSoldFemale,
                    isOccMale && styles.seatSoldMale,
                    isOcc && !isOccFemale && !isOccMale && { color: palette.slate500 },
                    isSel && !isOcc && { color: "#fff" },
                  ]}
                >
                  {isOcc ? "Sold" : formatRupee(seatFare(label).toFixed(2))}
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

      <SurfaceCard style={{ marginBottom: 14, paddingVertical: 12 }}>
        <AppText variant="label" style={styles.legendTitle}>
          Seat types
        </AppText>
        {(legendSeatKinds.length ? legendSeatKinds : (["Seater", "Semi-sleeper", "Sleeper"] as const)).map((kind, idx) => (
          <View key={kind} style={[styles.legendRow, idx > 0 && styles.legendRowSep]}>
            <View style={styles.legendIconWrap}>{renderSeatTypeIcon(kind, palette.indigo600)}</View>
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={styles.legendName}>
                {kind}
              </AppText>
            </View>
          </View>
        ))}
      </SurfaceCard>

      <SurfaceCard style={{ marginBottom: 16, paddingVertical: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckScrollContent}>
          <View style={styles.decksRow}>
            <View style={[styles.deckCard, { width: layoutWidth }]}>
              <View style={styles.deckHeader}>
                <AppText variant="label" style={styles.deckLabel}>
                  {showSplitDeck ? "Lower deck" : "Lower berth"}
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
      </SurfaceCard>

      <SurfaceCard style={{ marginBottom: 14, paddingVertical: 12 }}>
        <AppText variant="label" style={styles.legendTitle}>
          Seat status
        </AppText>
        <View style={[styles.legendRow, styles.legendRowSep]}>
          <View style={styles.legendIconWrap}>{renderSeatTypeIcon("Seater", palette.indigo600)}</View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={styles.legendName}>
              Available
            </AppText>
          </View>
        </View>
        <View style={[styles.legendRow, styles.legendRowSep]}>
          <View style={[styles.legendSwatch, styles.legendSwatchMaleOnly]} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={styles.legendName}>
              Male only (available)
            </AppText>
          </View>
        </View>
        <View style={[styles.legendRow, styles.legendRowSep]}>
          <View style={[styles.legendSwatch, styles.legendSwatchFemaleOnly]} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={styles.legendName}>
              Female only (available)
            </AppText>
          </View>
        </View>
        <View style={[styles.legendRow, styles.legendRowSep]}>
          <View style={[styles.legendSwatch, styles.legendSwatchMale]} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={styles.legendName}>
              Booked Male
            </AppText>
          </View>
        </View>
        <View style={[styles.legendRow, styles.legendRowSep]}>
          <View style={[styles.legendSwatch, styles.legendSwatchFemale]} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={styles.legendName}>
              Booked Female
            </AppText>
          </View>
        </View>
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
    overflow: "visible",
  },
  seatTipHost: { zIndex: 20 },
  seatOccDim: { opacity: 0.55 },
  seatOccFemale: { backgroundColor: "#fdf2f8", borderColor: "#fbcfe8" },
  seatOccMale: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  seatOccUnknown: { backgroundColor: palette.slate100, borderColor: palette.slate200 },
  seatFemaleOnly: {
    borderColor: "#f472b6",
    borderWidth: 2,
    backgroundColor: "#fdf2f8",
  },
  seatMaleOnly: {
    borderColor: "#60a5fa",
    borderWidth: 2,
    backgroundColor: "#eff6ff",
  },
  seatSel: {
    backgroundColor: palette.indigo600,
    borderColor: palette.indigo600,
  },
  seatIcon: { marginBottom: 4 },
  seatSemiWrap: { position: "relative", width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  seatSemiBackrest: {
    position: "absolute",
    width: 3,
    height: 11,
    borderRadius: 2,
    left: 5,
    top: 3,
    transform: [{ rotate: "-28deg" }],
  },
  seatSemiCushion: {
    position: "absolute",
    width: 12,
    height: 3,
    borderRadius: 2,
    left: 6,
    top: 12,
  },
  seatlegs: {
    position: "absolute",
    width: 11,
    height: 2,
    borderRadius: 2,
    left: 6.5,
    top: 16,
  },
  seatSemiPersonBack: {
    position: "absolute",
    width: 4,
    height:9,
    borderRadius: 2,
    left: 9,
    top: 3,
    transform: [{ rotate: "-30deg" }],
  },
  seatSemiPersonThigh: {
    position: "absolute",
    width: 7,
    height: 3,
    borderRadius: 2,
    left: 11,
    top: 8.5,
  },
  seatSemiPersonLeg: {
    position: "absolute",
    width: 2,
    height: 6,
    borderRadius: 2,
    left: 18,
    top: 9,
    transform: [{ rotate: "-45deg" }],
  },
  seatSemiPersonHead: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 4,
    left:5,
    top: -2,
  },
  seatFareTxt: { fontFamily: fonts.medium, fontSize: 9, lineHeight: 11, color: palette.slate500 },
  seatSoldTxt: { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 12, color: palette.slate500 },
  seatSoldFemale: { color: "#db2777" },
  seatSoldMale: { color: "#2563eb" },
  legendSwatch: { width: 36, height: 28, borderRadius: radii.sm, marginRight: 12, alignSelf: "center" },
  legendSwatchFemale: { backgroundColor: "#fdf2f8", borderWidth: 2, borderColor: "#fbcfe8" },
  legendSwatchMale: { backgroundColor: "#eff6ff", borderWidth: 2, borderColor: "#bfdbfe" },
  legendSwatchFemaleOnly: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#f472b6" },
  legendSwatchMaleOnly: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#60a5fa" },
  ruleTipWrap: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 8,
    alignItems: "center",
  },
  ruleTipBubble: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 82,
  },
  ruleTipPrice: { color: "#fff", fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
  ruleTipText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 10, lineHeight: 13 },
  ruleTipCaret: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#1f2937",
    marginTop: -1,
  },
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
  legendTitle: { color: palette.slate700, marginBottom: 4 },
  legendRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10 },
  legendRowSep: { borderTopWidth: 1, borderTopColor: palette.slate100 },
  legendIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  legendName: { fontFamily: fonts.semibold, color: palette.slate800, marginBottom: 2 },
});

function bookedGenderFromMap(genderMap: Map<string, string>, label: string): "F" | "M" | "?" {
  const g = (genderMap.get(label) || "").toUpperCase();
  if (g === "F" || g === "FEMALE") return "F";
  if (g === "M" || g === "MALE") return "M";
  return "?";
}

function seatIconColor(opts: {
  isSel: boolean;
  isOcc: boolean;
  isOccFemale: boolean;
  isOccMale: boolean;
  isFemaleOnly: boolean;
  isMaleOnly: boolean;
}): string {
  if (opts.isSel && !opts.isOcc && !(opts.isFemaleOnly || opts.isMaleOnly)) return "#fff";
  if (opts.isOcc) {
    if (opts.isOccFemale) return "#db2777";
    if (opts.isOccMale) return "#2563eb";
    return palette.slate400;
  }
  if (opts.isFemaleOnly) return opts.isSel ? "#fff" : "#db2777";
  if (opts.isMaleOnly) return opts.isSel ? "#fff" : "#2563eb";
  return palette.indigo600;
}

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
      <View style={[styles.seatIcon, styles.seatSemiWrap]}>
        <View style={[styles.seatSemiBackrest, { backgroundColor: color }]} />
        <View style={[styles.seatSemiCushion, { backgroundColor: color }]} />
        <View style={[styles.seatSemiPersonBack, { backgroundColor: color }]} />
        <View style={[styles.seatSemiPersonThigh, { backgroundColor: color }]} />
        <View style={[styles.seatSemiPersonLeg, { backgroundColor: color }]} />
        <View style={[styles.seatSemiPersonHead, { backgroundColor: color }]} />
      </View>
    );
  }
  return <MaterialCommunityIcons name="seat-passenger" size={18} color={color} style={styles.seatIcon} />;
}
