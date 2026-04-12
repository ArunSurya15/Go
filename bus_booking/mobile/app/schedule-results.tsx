import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScheduleTripCard } from "@/components/schedule/ScheduleTripCard";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette } from "@/constants/theme";
import { formatYMDChip } from "@/lib/date";
import { paramOne } from "@/lib/router-params";
import { routesApi } from "@/lib/api";
import type { Schedule } from "@/lib/types";

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
      {err ? (
        <SurfaceCard style={{ marginBottom: 12 }}>
          <AppText variant="body" style={{ color: palette.rose500, marginBottom: 12 }}>
            {err}
          </AppText>
          <PrimaryButton title="Try again" onPress={() => void load()} />
        </SurfaceCard>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={rows.length === 0 ? styles.centerList : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.indigo600} />}
        ListEmptyComponent={
          !err ? (
            <SurfaceCard>
              <AppText variant="title" style={{ marginBottom: 8 }}>
                No buses that day
              </AppText>
              <AppText variant="body" style={{ marginBottom: 16 }}>
                Try another date or route — operators add trips often.
              </AppText>
              <PrimaryButton title="Edit search" variant="outline" onPress={() => router.back()} />
            </SurfaceCard>
          ) : null
        }
        renderItem={({ item }) => <ScheduleTripCard schedule={item} onPress={() => openDetail(item)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  centerList: { flexGrow: 1, justifyContent: "center", paddingVertical: 40 },
  list: { paddingBottom: 24 },
  dateHint: { color: palette.slate500, marginBottom: 10, marginLeft: 4 },
});
