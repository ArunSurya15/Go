import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateStrip } from "@/components/search/DateStrip";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { addDays, formatLocalYMD, formatYMDChip, parseYMD } from "@/lib/date";
import { routesApi } from "@/lib/api";
import { addRecentTrip, getRecentTrips, type RecentTrip } from "@/lib/recent-trips";
import { useSearchDraft } from "@/lib/search-draft-context";
import { normalizeCityAlias } from "@/lib/city-alias";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const today = formatLocalYMD(new Date());
  const { from, to, setFrom, setTo, swap } = useSearchDraft();
  const [dateYmd, setDateYmd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [swapFlipped, setSwapFlipped] = useState(false);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);

  const dateValue = useMemo(() => parseYMD(dateYmd) ?? new Date(), [dateYmd]);
  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const onDatePicked = (event: { type?: string }, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "dismissed") return;
    if (selected) setDateYmd(formatLocalYMD(selected));
  };

  const openCalendar = () => {
    Keyboard.dismiss();
    setShowDatePicker(true);
  };

  useEffect(() => {
    void getRecentTrips().then(setRecentTrips);
  }, []);

  const openResults = async (fromCity: string, toCity: string, date: string) => {
    const fromNorm = normalizeCityAlias(fromCity);
    const toNorm = normalizeCityAlias(toCity);
    const list = await routesApi.list(fromNorm, toNorm);
    if (!list.length) {
      Alert.alert(
        "No route",
        "We could not match those cities. Try Bengaluru/Bangalore and Puducherry/Pondicherry spellings."
      );
      return;
    }
    const routeId = list[0].id;
    await addRecentTrip({ from: fromNorm, to: toNorm, dateYmd: date });
    setRecentTrips(await getRecentTrips());
    router.push({
      pathname: "/schedule-results",
      params: {
        routeId: String(routeId),
        date,
        from: fromNorm,
        to: toNorm,
      },
    });
  };

  const runSearch = async () => {
    Keyboard.dismiss();
    if (!from.trim() || !to.trim()) {
      Alert.alert("Almost there", "Choose origin and destination.");
      return;
    }
    setBusy(true);
    try {
      await openResults(from, to, dateYmd);
    } catch (e) {
      Alert.alert("Search failed", e instanceof Error ? e.message : "Check your connection and API URL.");
    } finally {
      setBusy(false);
    }
  };

  const useRecentTrip = (trip: RecentTrip) => {
    Keyboard.dismiss();
    setFrom(trip.from);
    setTo(trip.to);
    const d = parseYMD(trip.dateYmd);
    const safeDate = d && d >= minDate ? trip.dateYmd : today;
    setDateYmd(safeDate);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <LinearGradient
          colors={["#eef2ff", "#e0e7ff", "#f8fafc"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollInner,
              { paddingTop: 8, paddingBottom: insets.bottom + 16 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SurfaceCard style={styles.card}>
              <AppText variant="title" style={styles.title}>
                Bus tickets
              </AppText>

              <View style={styles.routeCluster}>
                <AppText variant="label" style={styles.fieldLabel}>
                  From
                </AppText>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/location-picker", params: { role: "from" } })
                  }
                  style={({ pressed }) => [styles.cityRow, pressed && { backgroundColor: palette.indigo50 }]}
                >
                  <FontAwesome name="bus" size={16} color={palette.indigo600} style={{ marginRight: 10 }} />
                  <View style={styles.cityTextWrap}>
                    <AppText numberOfLines={2} style={[styles.cityText, !from && styles.placeholder]}>
                      {from.trim() || "Enter origin city"}
                    </AppText>
                  </View>
                  <FontAwesome name="chevron-right" size={12} color={palette.slate400} />
                </Pressable>

                <View style={styles.hairline} />

                <AppText variant="label" style={[styles.fieldLabel, { marginTop: 8 }]}>
                  To
                </AppText>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/location-picker", params: { role: "to" } })
                  }
                  style={({ pressed }) => [styles.cityRow, pressed && { backgroundColor: palette.indigo50 }]}
                >
                  <FontAwesome name="map-marker" size={16} color={palette.indigo600} style={{ marginRight: 10 }} />
                  <View style={styles.cityTextWrap}>
                    <AppText numberOfLines={2} style={[styles.cityText, !to && styles.placeholder]}>
                      {to.trim() || "Enter destination city"}
                    </AppText>
                  </View>
                  <FontAwesome name="chevron-right" size={12} color={palette.slate400} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Swap origin and destination"
                  onPress={() => {
                    swap();
                    setSwapFlipped((v) => !v);
                  }}
                  style={({ pressed }) => [styles.swapFab, pressed && { opacity: 0.9 }]}
                >
                  <View style={styles.swapDoubleArrows} accessibilityElementsHidden>
                    {swapFlipped ? (
                      <>
                        <FontAwesome name="long-arrow-down" size={11} color="#fff" />
                        <FontAwesome name="long-arrow-up" size={11} color="#fff" style={{ marginLeft: 6 }} />
                      </>
                    ) : (
                      <>
                        <FontAwesome name="long-arrow-up" size={11} color="#fff" />
                        <FontAwesome name="long-arrow-down" size={11} color="#fff" style={{ marginLeft: 6 }} />
                      </>
                    )}
                  </View>
                </Pressable>
              </View>

              <Pressable
                onPress={openCalendar}
                style={({ pressed }) => [styles.dateHeader, pressed && { opacity: 0.85 }]}
              >
                <FontAwesome name="calendar" size={15} color={palette.indigo600} style={{ marginRight: 8 }} />
                <AppText variant="label" style={{ flex: 1, color: palette.slate700 }}>
                  Date of journey
                </AppText>
                <AppText variant="caption" style={styles.dateChip}>
                  {formatYMDChip(dateYmd)}
                </AppText>
                <FontAwesome name="chevron-down" size={11} color={palette.indigo500} style={{ marginLeft: 6 }} />
              </Pressable>

              <DateStrip
                selectedYmd={dateYmd}
                onSelectYmd={setDateYmd}
                onOpenCalendar={openCalendar}
                compact
              />

              <View style={styles.quickRow}>
                <Pressable onPress={() => setDateYmd(today)} style={styles.quickChip}>
                  <AppText variant="caption" style={styles.quickChipText}>
                    Today
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => setDateYmd(formatLocalYMD(addDays(new Date(), 1)))}
                  style={styles.quickChip}
                >
                  <AppText variant="caption" style={styles.quickChipText}>
                    Tomorrow
                  </AppText>
                </Pressable>
              </View>

              {recentTrips.length ? (
                <View style={{ marginTop: 10 }}>
                  <AppText variant="label" style={styles.recentLabel}>
                    Recent trips
                  </AppText>
                  <View style={styles.recentWrap}>
                    {recentTrips.map((trip) => (
                      <Pressable
                        key={`${trip.from}-${trip.to}-${trip.dateYmd}`}
                        onPress={() => useRecentTrip(trip)}
                        style={styles.recentChip}
                      >
                        <AppText variant="caption" style={styles.recentMain}>
                          {trip.from} → {trip.to}
                        </AppText>
                        <AppText variant="caption" style={styles.recentDate}>
                          Tap to fill search
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {showDatePicker ? (
                <DateTimePicker
                  value={dateValue}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={minDate}
                  onChange={onDatePicked}
                  themeVariant="light"
                />
              ) : null}
              {Platform.OS === "ios" && showDatePicker ? (
                <PrimaryButton
                  title="Done"
                  variant="outline"
                  onPress={() => setShowDatePicker(false)}
                  style={{ marginTop: 8 }}
                />
              ) : null}

              <PrimaryButton
                title="Search buses"
                variant="filled"
                loading={busy}
                onPress={() => void runSearch()}
                style={{ marginTop: 16 }}
              />
            </SurfaceCard>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  scrollInner: { paddingHorizontal: 14, flexGrow: 1 },
  card: {
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    borderRadius: radii.lg,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: palette.indigo100,
  },
  title: { marginBottom: 14, fontSize: 20, lineHeight: 26 },
  routeCluster: {
    position: "relative",
    marginBottom: 4,
  },
  fieldLabel: { marginBottom: 5, color: palette.slate600, fontSize: 12 },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingVertical: 8,
    paddingRight: 44,
    paddingLeft: 2,
    borderRadius: radii.md,
  },
  cityTextWrap: { flex: 1, paddingRight: 6 },
  cityText: { fontSize: 16, fontFamily: fonts.semibold, color: palette.slate900, lineHeight: 22 },
  placeholder: { color: palette.slate400, fontFamily: fonts.regular },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.slate200,
    marginVertical: 2,
    marginRight: 40,
  },
  swapDoubleArrows: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  swapFab: {
    position: "absolute",
    right: 2,
    top: "50%",
    marginTop: -20,
    width: 36,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.indigo600,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.white,
    elevation: 5,
    shadowColor: palette.indigo900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 2,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  dateChip: {
    color: palette.indigo700,
    fontFamily: fonts.semibold,
    backgroundColor: palette.indigo50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  quickRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  quickChip: {
    backgroundColor: palette.indigo50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: palette.indigo100,
  },
  quickChipText: { color: palette.indigo800, fontFamily: fonts.semibold, fontSize: 11 },
  recentLabel: { color: palette.slate600, marginBottom: 8 },
  recentWrap: { gap: 8 },
  recentChip: {
    borderWidth: 1,
    borderColor: palette.slate200,
    backgroundColor: palette.white,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recentMain: { color: palette.slate800, fontFamily: fonts.semibold },
  recentDate: { color: palette.slate500, marginTop: 2 },
});
