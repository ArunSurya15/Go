import { useNavigation } from "@react-navigation/native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScheduleTripCard } from "@/components/schedule/ScheduleTripCard";
import { AppText } from "@/components/ui/AppText";
import { AppProblemState } from "@/components/ui/AppProblemState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette } from "@/constants/theme";
import { formatYMDChip } from "@/lib/date";
import { paramOne } from "@/lib/router-params";
import { routesApi } from "@/lib/api";
import type { Schedule } from "@/lib/types";

type SortMode = "relevance" | "priceLowToHigh" | "bestRated" | "earlyDeparture" | "lateDeparture";

export default function ScheduleResultsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { routeId: routeIdRaw, date: dateRaw, from: fromRaw, to: toRaw } = useLocalSearchParams<{
    routeId: string;
    date: string;
    from: string;
    to: string;
  }>();

  const routeId = paramOne(routeIdRaw);
  const date = paramOne(dateRaw);
  const from = paramOne(fromRaw);
  const to = paramOne(toRaw);

  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [dealsOnly, setDealsOnly] = useState(false);
  const [acOnly, setAcOnly] = useState(false);
  const [nonAcOnly, setNonAcOnly] = useState(false);
  const [sleeperOnly, setSleeperOnly] = useState(false);
  const [semiSleeperOnly, setSemiSleeperOnly] = useState(false);
  const [singleSeatOnly, setSingleSeatOnly] = useState(false);
  const [highRatedOnly, setHighRatedOnly] = useState(false);
  const [liveTrackingOnly, setLiveTrackingOnly] = useState(false);

  /** Horizontal offset of chip row; drives cross-fade between full pill and icon pill. */
  const filterChipScrollX = useRef(new Animated.Value(0)).current;
  const FILTER_PILL_FADE_IN = 42;
  const filterPillFullOpacity = filterChipScrollX.interpolate({
    inputRange: [0, 10, 24, FILTER_PILL_FADE_IN],
    outputRange: [1, 0.9, 0.35, 0],
    extrapolate: "clamp",
  });
  const filterPillIconOpacity = filterChipScrollX.interpolate({
    inputRange: [0, 16, 28, FILTER_PILL_FADE_IN],
    outputRange: [0, 0.2, 0.72, 1],
    extrapolate: "clamp",
  });
  const filterPillLabelOpacity = filterChipScrollX.interpolate({
    inputRange: [0, 8, 20, 30, FILTER_PILL_FADE_IN],
    outputRange: [1, 0.95, 0.55, 0.12, 0],
    extrapolate: "clamp",
  });
  const filterPillLabelTranslateX = filterChipScrollX.interpolate({
    inputRange: [0, FILTER_PILL_FADE_IN],
    outputRange: [0, -5],
    extrapolate: "clamp",
  });
  const onFilterChipsScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: filterChipScrollX } } }], {
        useNativeDriver: true,
      }),
    [filterChipScrollX]
  );

  const load = useCallback(async () => {
    if (!routeId || !date) {
      setErr("Missing route or date.");
      setRows([]);
      setLoading(false);
      return;
    }
    setErr("");
    try {
      const data = await routesApi.schedules(Number(routeId), date);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load trips.");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    const title = from && to ? `${from} → ${to}` : "Trips";
    navigation.setOptions({ title });
  }, [navigation, from, to]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const filteredRows = useMemo(() => {
    const norm = (s: string | undefined | null) => (s || "").toLowerCase();
    const withMeta = rows.map((r) => {
      const title = `${norm(r.bus.service_name)} ${norm(r.bus.registration_no)}`.trim();
      const promoText = norm(r.operator_promo_title || r.platform_promo_title || r.platform_promo_line);
      const dep = new Date(r.departure_dt);
      const arr = new Date(r.arrival_dt);
      const rating = Number(r.bus.rating_avg || 0);
      const ratingCount = Number(r.bus.rating_count || 0);
      const isAc = /\ba\/?c\b|\bac\b/.test(title) && !/non[\s-]?a\/?c|non[\s-]?ac/.test(title);
      const isNonAc = /non[\s-]?a\/?c|non[\s-]?ac/.test(title) || !isAc;
      const isSleeper = title.includes("sleeper");
      const isSemiSleeper = title.includes("semi sleeper") || title.includes("semi-sleeper") || title.includes("semi");
      const hasSingleSeat = title.includes("single");
      const hasDeal = !!promoText || (r.fare_original ? Number(r.fare_original) > Number(r.fare) : false);
      const isLiveTracking = (r.status || "").toUpperCase() === "ACTIVE";
      const depHour = Number.isNaN(dep.getHours()) ? 0 : dep.getHours();
      const durationMs = Math.max(0, arr.getTime() - dep.getTime());
      return {
        r,
        title,
        depHour,
        durationMs,
        rating,
        ratingCount,
        isAc,
        isNonAc,
        isSleeper,
        isSemiSleeper,
        hasSingleSeat,
        hasDeal,
        isLiveTracking,
      };
    });

    let list = withMeta.filter((x) => {
      if (dealsOnly && !x.hasDeal) return false;
      if (acOnly && !x.isAc) return false;
      if (nonAcOnly && !x.isNonAc) return false;
      if (sleeperOnly && !x.isSleeper) return false;
      if (semiSleeperOnly && !x.isSemiSleeper) return false;
      if (singleSeatOnly && !x.hasSingleSeat) return false;
      if (highRatedOnly && !(x.rating >= 4.5 && x.ratingCount >= 30)) return false;
      if (liveTrackingOnly && !x.isLiveTracking) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortMode === "priceLowToHigh") return Number(a.r.fare) - Number(b.r.fare);
      if (sortMode === "bestRated") return b.rating - a.rating || b.ratingCount - a.ratingCount;
      if (sortMode === "earlyDeparture") {
        return new Date(a.r.departure_dt).getTime() - new Date(b.r.departure_dt).getTime();
      }
      if (sortMode === "lateDeparture") {
        return new Date(b.r.departure_dt).getTime() - new Date(a.r.departure_dt).getTime();
      }
      const relevanceA = (a.hasDeal ? 3 : 0) + (a.rating >= 4.5 ? 2 : 0) - Number(a.r.fare) / 10000;
      const relevanceB = (b.hasDeal ? 3 : 0) + (b.rating >= 4.5 ? 2 : 0) - Number(b.r.fare) / 10000;
      if (relevanceB !== relevanceA) return relevanceB - relevanceA;
      return new Date(a.r.departure_dt).getTime() - new Date(b.r.departure_dt).getTime();
    });
    return list.map((x) => x.r);
  }, [
    rows,
    dealsOnly,
    acOnly,
    nonAcOnly,
    sleeperOnly,
    semiSleeperOnly,
    singleSeatOnly,
    highRatedOnly,
    liveTrackingOnly,
    sortMode,
  ]);

  const clearFilters = () => {
    setDealsOnly(false);
    setAcOnly(false);
    setNonAcOnly(false);
    setSleeperOnly(false);
    setSemiSleeperOnly(false);
    setSingleSeatOnly(false);
    setHighRatedOnly(false);
    setLiveTrackingOnly(false);
    setSortMode("relevance");
  };

  const openDetail = (s: Schedule) => {
    router.push({
      pathname: "/schedule/[id]",
      params: {
        id: String(s.id),
        routeId,
        date,
        from,
        to,
      },
    });
  };

  if (loading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.indigo600} />
        <AppText variant="body" style={{ marginTop: 16, color: palette.slate500 }}>
          Finding buses…
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 8 }]}>
      {date ? (
        <AppText variant="caption" style={styles.dateHint}>
          {formatYMDChip(date)}
        </AppText>
      ) : null}
      <View style={styles.metaRow}>
        <AppText variant="label" style={styles.countText}>
          {filteredRows.length} buses
        </AppText>
        <Pressable
          onPress={clearFilters}
          disabled={
            !(
              dealsOnly ||
              acOnly ||
              nonAcOnly ||
              sleeperOnly ||
              semiSleeperOnly ||
              singleSeatOnly ||
              highRatedOnly ||
              liveTrackingOnly ||
              sortMode !== "relevance"
            )
          }
          style={[
            styles.clearBtn,
            !(
              dealsOnly ||
              acOnly ||
              nonAcOnly ||
              sleeperOnly ||
              semiSleeperOnly ||
              singleSeatOnly ||
              highRatedOnly ||
              liveTrackingOnly ||
              sortMode !== "relevance"
            ) && styles.clearBtnHidden,
          ]}
        >
          <AppText variant="caption" style={styles.clearBtnText}>
            Clear filters
          </AppText>
        </Pressable>
      </View>
      <View style={styles.filterBarRow}>
        <View style={styles.frozenFilterWrap}>
          <Pressable
            onPress={() => setShowFilterSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter and sort"
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          >
            <View style={styles.filterPillFrame}>
              <Animated.View
                style={[
                  styles.filterPillFull,
                  showFilterSheet ? styles.filterPillOpen : styles.filterPillClosed,
                  { opacity: filterPillFullOpacity },
                ]}
                pointerEvents="none"
              >
                <View style={styles.filterPillRow}>
                  <View style={styles.filterPillIconSlot}>
                    <FontAwesome
                      name="sliders"
                      size={14}
                      color={showFilterSheet ? palette.white : palette.slate600}
                      style={styles.filterAdaptiveIcon}
                    />
                  </View>
                  <Animated.View
                    style={[
                      styles.filterPillLabelWrap,
                      {
                        opacity: filterPillLabelOpacity,
                        transform: [{ translateX: filterPillLabelTranslateX }],
                      },
                    ]}
                  >
                    <AppText
                      numberOfLines={1}
                      style={[
                        styles.filterAdaptiveLabel,
                        showFilterSheet && styles.filterAdaptiveLabelActive,
                      ]}
                    >
                      Filter & Sort
                    </AppText>
                  </Animated.View>
                </View>
              </Animated.View>
              <Animated.View
                style={[
                  styles.filterPillIconOnly,
                  showFilterSheet ? styles.filterPillOpen : styles.filterPillClosed,
                  { opacity: filterPillIconOpacity },
                ]}
                pointerEvents="none"
              >
                <FontAwesome
                  name="sliders"
                  size={14}
                  color={showFilterSheet ? palette.white : palette.slate600}
                  style={styles.filterAdaptiveIcon}
                />
              </Animated.View>
            </View>
          </Pressable>
        </View>
        <View style={styles.chipScrollWrap}>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroller}
            style={styles.chipScrollView}
            onScroll={onFilterChipsScroll}
            scrollEventThrottle={16}
          >
            <Chip label="Deals" icon="tags" width={88} active={dealsOnly} onPress={() => setDealsOnly((v) => !v)} />
            <Chip label="AC" icon="snowflake-o" width={78} active={acOnly} onPress={() => setAcOnly((v) => !v)} />
            <Chip label="Non-AC" icon="non-ac" width={98} active={nonAcOnly} onPress={() => setNonAcOnly((v) => !v)} />
            <Chip label="Sleeper" icon="seat-sleeper" width={104} active={sleeperOnly} onPress={() => setSleeperOnly((v) => !v)} />
            <Chip label="Semi-sleeper" icon="seat-semi" width={126} active={semiSleeperOnly} onPress={() => setSemiSleeperOnly((v) => !v)} />
            <Chip label="Single seats" icon="seat-seater" width={116} active={singleSeatOnly} onPress={() => setSingleSeatOnly((v) => !v)} />
            <Chip label="Highly rated" icon="star" width={122} active={highRatedOnly} onPress={() => setHighRatedOnly((v) => !v)} />
            <Chip label="Live tracking" icon="map-marker" width={126} active={liveTrackingOnly} onPress={() => setLiveTrackingOnly((v) => !v)} />
          </Animated.ScrollView>
        </View>
      </View>
      {err ? (
        <SurfaceCard style={{ marginBottom: 12 }}>
          <AppProblemState
            eyebrow="Loading issue"
            title="Oops,"
            highlight="hit a bump!"
            description={err || "Couldn't load buses right now. Please try again."}
            primaryAction={{ label: "Try again", onPress: () => void load() }}
            secondaryAction={{ label: "Go Home", onPress: () => router.replace("/(tabs)") }}
          />
        </SurfaceCard>
      ) : null}
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={filteredRows.length === 0 ? styles.centerList : styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.indigo600} />}
        ListEmptyComponent={
          !err ? (
            <SurfaceCard>
              <AppText variant="title" style={{ marginBottom: 8 }}>
                No buses for current filters
              </AppText>
              <AppText variant="body" style={{ marginBottom: 16 }}>
                Try removing filters or changing date/route.
              </AppText>
              <PrimaryButton title="Edit search" variant="outline" onPress={() => router.back()} />
            </SurfaceCard>
          ) : null
        }
        renderItem={({ item }) => <ScheduleTripCard schedule={item} onPress={() => openDetail(item)} />}
      />
      <Modal
        visible={showFilterSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilterSheet(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.sheetHeader}>
            <AppText variant="title" style={styles.sheetTitle}>
              Filter & sort
            </AppText>
            <Pressable onPress={() => setShowFilterSheet(false)} style={styles.closeBtn}>
              <FontAwesome name="close" size={16} color={palette.slate700} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
            <AppText variant="label" style={styles.sectionTitle}>
              Sort by
            </AppText>
            <View style={styles.optList}>
              <OptionRow label="Relevance (default)" active={sortMode === "relevance"} onPress={() => setSortMode("relevance")} />
              <OptionRow label="Price low to high" active={sortMode === "priceLowToHigh"} onPress={() => setSortMode("priceLowToHigh")} />
              <OptionRow label="Best rated first" active={sortMode === "bestRated"} onPress={() => setSortMode("bestRated")} />
              <OptionRow label="Early departure first" active={sortMode === "earlyDeparture"} onPress={() => setSortMode("earlyDeparture")} />
              <OptionRow label="Late departure first" active={sortMode === "lateDeparture"} onPress={() => setSortMode("lateDeparture")} />
            </View>
            <AppText variant="label" style={styles.sectionTitle}>
              Filters
            </AppText>
            <View style={styles.filterGrid}>
              <Chip label="Deals" icon="tags" width={88} active={dealsOnly} onPress={() => setDealsOnly((v) => !v)} />
              <Chip label="AC" icon="snowflake-o" width={78} active={acOnly} onPress={() => setAcOnly((v) => !v)} />
              <Chip label="Non-AC" icon="non-ac" width={98} active={nonAcOnly} onPress={() => setNonAcOnly((v) => !v)} />
              <Chip label="Sleeper" icon="seat-sleeper" width={104} active={sleeperOnly} onPress={() => setSleeperOnly((v) => !v)} />
              <Chip label="Semi-sleeper" icon="seat-semi" width={126} active={semiSleeperOnly} onPress={() => setSemiSleeperOnly((v) => !v)} />
              <Chip label="Single seats" icon="seat-seater" width={116} active={singleSeatOnly} onPress={() => setSingleSeatOnly((v) => !v)} />
              <Chip label="Highly rated" icon="star" width={122} active={highRatedOnly} onPress={() => setHighRatedOnly((v) => !v)} />
              <Chip label="Live tracking" icon="map-marker" width={126} active={liveTrackingOnly} onPress={() => setLiveTrackingOnly((v) => !v)} />
            </View>
          </ScrollView>
          <View style={styles.sheetFooter}>
            <PrimaryButton title="Clear all" variant="outline" onPress={clearFilters} style={{ flex: 1, marginRight: 8 }} />
            <PrimaryButton title={`View ${filteredRows.length} buses`} onPress={() => setShowFilterSheet(false)} style={{ flex: 1.4 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  centerList: { flexGrow: 1, justifyContent: "center", paddingVertical: 40 },
  list: { paddingBottom: 24 },
  dateHint: { color: palette.slate500, marginBottom: 10, marginLeft: 4 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  countText: { color: palette.slate700 },
  clearBtn: {
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.slate100,
    alignItems: "center",
  },
  clearBtnHidden: { opacity: 0 },
  clearBtnText: { color: palette.slate700 },
  filterBarRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    marginBottom: 10,
  },
  frozenFilterWrap: {
    marginRight: 6,
    alignItems: "flex-start",
    zIndex: 10,
    backgroundColor: palette.slate50,
  },
  filterPillFrame: { width: 128, height: 38, position: "relative" },
  filterPillFull: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 128,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  filterPillIconOnly: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 40,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillClosed: { borderColor: palette.slate200, backgroundColor: palette.white },
  filterPillOpen: { borderColor: palette.indigo600, backgroundColor: palette.indigo600 },
  filterPillRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    height: 38,
    paddingLeft: 8,
    paddingRight: 8,
    gap: 4,
  },
  filterPillIconSlot: { width: 20, alignItems: "center", justifyContent: "center" },
  filterPillLabelWrap: { minWidth: 0, flex: 1, overflow: "hidden", justifyContent: "center" },
  filterAdaptiveIcon: { width: 14, textAlign: "center" },
  filterAdaptiveLabel: { fontSize: 12, lineHeight: 16, color: palette.slate700 },
  filterAdaptiveLabelActive: { color: palette.white, fontFamily: fonts.semibold },
  chipScrollWrap: { flex: 1, position: "relative" },
  chipScrollView: { flex: 1 },
  chipScroller: { paddingLeft: 0, paddingRight: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)" },
  sheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    height: "82%",
  },
  sheetScroll: { flex: 1 },
  sheetScrollContent: { paddingBottom: 6 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sheetTitle: { fontSize: 20, lineHeight: 24 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.slate100,
  },
  sectionTitle: { marginTop: 10, marginBottom: 8, color: palette.slate700 },
  optList: { gap: 8 },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  sheetFooter: {
    flexDirection: "row",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.slate100,
    backgroundColor: palette.white,
  },
});

function Chip({
  label,
  icon,
  active,
  width = "auto",
  onPress,
}: {
  label: string;
  icon?:
    | React.ComponentProps<typeof FontAwesome>["name"]
    | "non-ac"
    | "seat-seater"
    | "seat-sleeper"
    | "seat-semi";
  active?: boolean;
  width?: number | "auto";
  onPress: () => void;
}) {
  const iconColor = active ? palette.white : palette.slate500;
  const customIcon =
    icon === "non-ac" ? (
      <View style={chipStyles.nonAcIconWrap}>
        <MaterialCommunityIcons name="air-conditioner" size={13} color={iconColor} />
        <View style={[chipStyles.nonAcSlash, active && chipStyles.nonAcSlashActive]} />
      </View>
    ) : icon === "seat-seater" ? (
      <MaterialCommunityIcons
        name="seat-passenger"
        size={15}
        color={iconColor}
        style={chipStyles.seaterIcon}
      />
    ) : icon === "seat-sleeper" ? (
      <FontAwesome
        name="bed"
        size={13}
        color={iconColor}
        style={chipStyles.sleeperIcon}
      />
    ) : icon === "seat-semi" ? (
      <View style={chipStyles.seatSemiWrap}>
        <View style={[chipStyles.seatSemiBackrest, { backgroundColor: iconColor }]} />
        <View style={[chipStyles.seatSemiCushion, { backgroundColor: iconColor }]} />
        <View style={[chipStyles.seatSemiPersonBack, { backgroundColor: iconColor }]} />
        <View style={[chipStyles.seatSemiPersonThigh, { backgroundColor: iconColor }]} />
        <View style={[chipStyles.seatSemiPersonLeg, { backgroundColor: iconColor }]} />
        <View style={[chipStyles.seatSemiPersonHead, { backgroundColor: iconColor }]} />
      </View>
    ) : icon ? (
      <FontAwesome
        name={icon as React.ComponentProps<typeof FontAwesome>["name"]}
        size={12}
        color={iconColor}
        style={{ marginRight: 6 }}
      />
    ) : null;

  return (
    <Pressable onPress={onPress} style={[chipStyles.base, width !== "auto" && { width }, active && chipStyles.active]}>
      {customIcon}
      <AppText numberOfLines={1} style={[chipStyles.text, active && chipStyles.textActive]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function OptionRow({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={chipStyles.optionRow}>
      <FontAwesome
        name={active ? "dot-circle-o" : "circle-o"}
        size={16}
        color={active ? palette.indigo600 : palette.slate400}
        style={{ marginRight: 10 }}
      />
      <AppText style={chipStyles.optionText}>{label}</AppText>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
    height: 38,
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  active: {
    borderColor: palette.indigo600,
    backgroundColor: palette.indigo600,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.slate700,
  },
  textActive: {
    color: palette.white,
    fontFamily: fonts.semibold,
  },
  nonAcIconWrap: { width: 14, height: 14, marginRight: 6, alignItems: "center", justifyContent: "center" },
  nonAcSlash: {
    position: "absolute",
    width: 15,
    height: 1.7,
    backgroundColor: palette.slate500,
    transform: [{ rotate: "-35deg" }],
    borderRadius: 2,
  },
  nonAcSlashActive: { backgroundColor: palette.white },
  seaterIcon: { marginRight: 6 },
  sleeperIcon: { marginRight: 6 },
  seatSemiWrap: { position: "relative", width: 16, height: 14, marginRight: 6, alignItems: "center", justifyContent: "center" },
  seatSemiBackrest: {
    position: "absolute",
    left: 1,
    top: 2,
    width: 4,
    height: 8,
    borderRadius: 2,
    opacity: 0.95,
  },
  seatSemiCushion: {
    position: "absolute",
    left: 4,
    top: 7,
    width: 9,
    height: 4,
    borderRadius: 2,
  },
  seatSemiPersonBack: {
    position: "absolute",
    left: 7,
    top: 3,
    width: 2,
    height: 4,
    borderRadius: 2,
  },
  seatSemiPersonThigh: {
    position: "absolute",
    left: 8,
    top: 7,
    width: 4,
    height: 2,
    borderRadius: 2,
  },
  seatSemiPersonLeg: {
    position: "absolute",
    left: 10,
    top: 8,
    width: 3,
    height: 2,
    borderRadius: 2,
  },
  seatSemiPersonHead: {
    position: "absolute",
    left: 8,
    top: 3,
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  optionRow: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.slate100,
    backgroundColor: palette.slate50,
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: { color: palette.slate700, fontSize: 14, lineHeight: 18 },
});
