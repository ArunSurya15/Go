import { useNavigation } from "@react-navigation/native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Chip
          label="Filter & Sort"
          icon="sliders"
          width={128}
          active={showFilterSheet}
          onPress={() => setShowFilterSheet(true)}
        />
        <Chip label="Deals" icon="tags" width={88} active={dealsOnly} onPress={() => setDealsOnly((v) => !v)} />
        <Chip label="AC" icon="snowflake-o" width={78} active={acOnly} onPress={() => setAcOnly((v) => !v)} />
        <Chip label="Non-AC" icon="sun-o" width={98} active={nonAcOnly} onPress={() => setNonAcOnly((v) => !v)} />
        <Chip label="Sleeper" icon="bed" width={104} active={sleeperOnly} onPress={() => setSleeperOnly((v) => !v)} />
        <Chip label="Semi-sleeper" icon="moon-o" width={126} active={semiSleeperOnly} onPress={() => setSemiSleeperOnly((v) => !v)} />
        <Chip label="Single seats" icon="user" width={116} active={singleSeatOnly} onPress={() => setSingleSeatOnly((v) => !v)} />
        <Chip label="Highly rated" icon="star" width={122} active={highRatedOnly} onPress={() => setHighRatedOnly((v) => !v)} />
        <Chip label="Live tracking" icon="map-marker" width={126} active={liveTrackingOnly} onPress={() => setLiveTrackingOnly((v) => !v)} />
      </ScrollView>
      {err ? (
        <SurfaceCard style={{ marginBottom: 12 }}>
          <AppText variant="body" style={{ color: palette.rose500, marginBottom: 12 }}>
            {err}
          </AppText>
          <PrimaryButton title="Try again" onPress={() => void load()} />
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
              <Chip label="Non-AC" icon="sun-o" width={98} active={nonAcOnly} onPress={() => setNonAcOnly((v) => !v)} />
              <Chip label="Sleeper" icon="bed" width={104} active={sleeperOnly} onPress={() => setSleeperOnly((v) => !v)} />
              <Chip label="Semi-sleeper" icon="moon-o" width={126} active={semiSleeperOnly} onPress={() => setSemiSleeperOnly((v) => !v)} />
              <Chip label="Single seats" icon="user" width={116} active={singleSeatOnly} onPress={() => setSingleSeatOnly((v) => !v)} />
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
  chipRow: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
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
  icon?: React.ComponentProps<typeof FontAwesome>["name"];
  active?: boolean;
  width?: number | "auto";
  onPress: () => void;
}) {
  const customIcon =
    icon === "sun-o" ? (
      <View style={chipStyles.nonAcIconWrap}>
        <FontAwesome name="snowflake-o" size={12} color={active ? palette.white : palette.slate500} />
        <View style={[chipStyles.nonAcSlash, active && chipStyles.nonAcSlashActive]} />
      </View>
    ) : icon === "moon-o" ? (
      <View style={chipStyles.semiIconWrap}>
        <FontAwesome name="bed" size={12} color={active ? palette.white : palette.slate500} />
        <View style={[chipStyles.semiDot, active && chipStyles.semiDotActive]} />
      </View>
    ) : icon ? (
      <FontAwesome
        name={icon}
        size={12}
        color={active ? palette.white : palette.slate500}
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
  nonAcIconWrap: { width: 13, height: 13, marginRight: 6, alignItems: "center", justifyContent: "center" },
  nonAcSlash: {
    position: "absolute",
    width: 14,
    height: 1.6,
    backgroundColor: palette.slate500,
    transform: [{ rotate: "-35deg" }],
    borderRadius: 2,
  },
  nonAcSlashActive: { backgroundColor: palette.white },
  semiIconWrap: { width: 14, height: 14, marginRight: 6, alignItems: "center", justifyContent: "center" },
  semiDot: {
    position: "absolute",
    right: -1,
    top: -1,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.slate400,
  },
  semiDotActive: { backgroundColor: palette.white },
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
