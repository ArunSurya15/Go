import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette, radii } from "@/constants/theme";
import { bookingApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { BookingListItem } from "@/lib/types";

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function BookingsScreen() {
  const { access, getValidToken } = useAuth();
  const [rows, setRows] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!access) {
      setRows([]);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const token = await getValidToken();
      if (!token) {
        setRows([]);
        return;
      }
      const data = await bookingApi.list(token);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load bookings.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [access, getValidToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!access) {
    return (
      <View style={styles.center}>
        <SurfaceCard style={styles.emptyCard}>
          <AppText variant="title" style={{ marginBottom: 8 }}>
            Sign in to see trips
          </AppText>
          <AppText variant="body" style={{ marginBottom: 20 }}>
            Your upcoming and past bookings from the website appear here once you&apos;re logged in.
          </AppText>
          <PrimaryButton title="Sign in" onPress={() => router.push("/login")} />
        </SurfaceCard>
      </View>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.indigo600} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {err ? (
        <AppText variant="body" style={styles.err}>
          {err}
        </AppText>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={rows.length === 0 ? styles.center : styles.list}
        refreshing={loading}
        onRefresh={() => void load()}
        ListEmptyComponent={
          <SurfaceCard>
            <AppText variant="subtitle">No bookings yet</AppText>
            <AppText variant="body" style={{ marginTop: 8 }}>
              When you book on e-GO, your trips show up here.
            </AppText>
            <PrimaryButton title="Find buses" onPress={() => router.push("/search")} style={{ marginTop: 20 }} />
          </SurfaceCard>
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}>
            <SurfaceCard style={styles.card}>
              <View style={styles.rowTop}>
                <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
                  {item.schedule.route.origin} → {item.schedule.route.destination}
                </AppText>
                <View style={[styles.badge, item.status === "CONFIRMED" ? styles.badgeOk : styles.badgeMuted]}>
                  <AppText
                    variant="caption"
                    style={[styles.badgeText, item.status === "CONFIRMED" && styles.badgeTextOk]}
                  >
                    {item.status}
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" style={{ marginTop: 6 }}>
                {fmtWhen(item.schedule.departure_dt)}
              </AppText>
              <AppText variant="body" style={{ marginTop: 10 }}>
                Seats: {item.seats.join(", ")} · ₹{item.amount}
              </AppText>
            </SurfaceCard>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "stretch", padding: 20 },
  list: { paddingBottom: 24, gap: 12 },
  row: {},
  card: { paddingVertical: 16 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  badgeOk: { backgroundColor: "#d1fae5" },
  badgeMuted: { backgroundColor: palette.slate100 },
  badgeText: { color: palette.slate700, textTransform: "capitalize" },
  badgeTextOk: { color: "#065f46" },
  err: { color: palette.rose500, marginBottom: 8, textAlign: "center" },
  emptyCard: { maxWidth: 400, alignSelf: "center" },
});
