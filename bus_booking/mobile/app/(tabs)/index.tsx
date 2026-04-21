import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";
import { formatLocalYMD } from "@/lib/date";
import { bookingApi, routesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COIN_RULES, computeCoinWallet } from "@/lib/coins";
import { useSearchDraft } from "@/lib/search-draft-context";

const SUGGESTED = [
  { label: "Bengaluru → Chennai", from: "Bangalore", to: "Chennai" },
  { label: "Hyderabad → Bengaluru", from: "Hyderabad", to: "Bangalore" },
  { label: "Mumbai → Pune", from: "Mumbai", to: "Pune" },
  { label: "Delhi → Jaipur", from: "Delhi", to: "Jaipur" },
];

export default function BookHomeScreen() {
  const insets = useSafeAreaInsets();
  const { access, getValidToken } = useAuth();
  const { setFrom, setTo } = useSearchDraft();
  const [chipBusy, setChipBusy] = useState<string | null>(null);
  const [coinEarned, setCoinEarned] = useState(0);
  const [coinValue, setCoinValue] = useState(0);

  const loadCoins = useCallback(async () => {
    if (!access) {
      setCoinEarned(0);
      setCoinValue(0);
      return;
    }
    try {
      const token = await getValidToken();
      if (!token) return;
      const rows = await bookingApi.list(token);
      const wallet = computeCoinWallet(rows);
      setCoinEarned(wallet.earned);
      setCoinValue(wallet.redeemableRupees);
    } catch {
      // keep home resilient
    }
  }, [access, getValidToken]);

  useFocusEffect(
    useCallback(() => {
      void loadCoins();
    }, [loadCoins])
  );

  const openSuggested = async (fromCity: string, toCity: string, label: string) => {
    setChipBusy(label);
    try {
      const list = await routesApi.list(fromCity, toCity);
      if (!list.length) {
        Alert.alert("No route", `Try opening search and typing a nearby city for ${label}.`);
        return;
      }
      setFrom(fromCity);
      setTo(toCity);
      const date = formatLocalYMD(new Date());
      router.push({
        pathname: "/schedule-results",
        params: {
          routeId: String(list[0].id),
          date,
          from: fromCity,
          to: toCity,
        },
      });
    } catch (e) {
      Alert.alert("Could not search", e instanceof Error ? e.message : "Try again.");
    } finally {
      setChipBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
      >
        <LinearGradient
          colors={["#1e1b4b", "#4f46e5", "#7c3aed"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 28 }]}
        >
          <View style={styles.heroGlow} />
          <AppText variant="caption" style={styles.eyebrow}>
            e-GO
          </AppText>
          <AppText variant="hero" style={styles.heroTitle}>
            Go farther,{"\n"}feel lighter.
          </AppText>
          <AppText variant="subtitle" style={styles.heroSub}>
            AC sleeper, seater, and Volvo-class buses from trusted operators — search once, ride easy.
          </AppText>
          <View style={styles.heroActions}>
            <PrimaryButton title="Find buses" onPress={() => router.push("/search")} />
            {!access ? (
              <PrimaryButton
                title="Sign in"
                variant="ghostOnDark"
                onPress={() => router.push("/login")}
                style={styles.secondBtn}
              />
            ) : null}
          </View>
        </LinearGradient>

        <View style={[styles.floatWrap, { marginTop: -32 }]}>
          <BlurView
            intensity={Platform.OS === "ios" ? 55 : 40}
            tint="light"
            style={styles.blurCard}
          >
            <View style={styles.blurInner}>
              <AppText variant="label" style={styles.floatTitle}>
                Book in seconds
              </AppText>
              <AppText variant="body" style={styles.floatBody}>
                Search by city, compare fares, and lock seats with the same account as our website.
              </AppText>
              <PrimaryButton title="Start search" onPress={() => router.push("/search")} />
            </View>
          </BlurView>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Quick access" subtitle="Jump where you need" />
          <View style={styles.quickRow}>
            <QuickAction title="Home" icon="home" active onPress={() => router.push("/(tabs)")} />
            <QuickAction title="My trips" icon="ticket" onPress={() => router.push("/(tabs)/bookings")} />
            <QuickAction title="My account" icon="user" onPress={() => router.push("/(tabs)/account")} />
          </View>
        </View>

        <View style={styles.section}>
          <SurfaceCard style={styles.coinCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="label" style={{ color: palette.indigo800 }}>e-GO Coins</AppText>
                <AppText variant="title" style={{ fontSize: 24, lineHeight: 30, marginTop: 2 }}>
                  {coinEarned} coins
                </AppText>
                <AppText variant="caption" style={{ color: palette.slate600, marginTop: 2 }}>
                  Redeemable value: ₹{coinValue}
                </AppText>
              </View>
              <View style={styles.coinBadge}>
                <AppText variant="label" style={{ color: palette.indigo700 }}>₹1 = 1 coin</AppText>
              </View>
            </View>
            <AppText variant="caption" style={{ color: palette.slate500, marginTop: 10 }}>
              Earn rule: {COIN_RULES.earnPer100Rupees} coin per ₹100 (minimum {COIN_RULES.minCoinsPerTrip} coins per confirmed trip). You can use coins for up to {Math.round(COIN_RULES.maxRedeemPct * 100)}% of a booking.
            </AppText>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Popular routes" subtitle="One tap — picks today’s date" />
          <View style={styles.chipWrap}>
            {SUGGESTED.map((s) => (
              <Pressable
                key={s.label}
                disabled={chipBusy !== null}
                onPress={() => void openSuggested(s.from, s.to, s.label)}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && { opacity: 0.88 },
                  chipBusy === s.label && { opacity: 0.6 },
                ]}
              >
                <AppText variant="caption" style={styles.chipText}>
                  {chipBusy === s.label ? "…" : s.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SurfaceCard style={styles.trustCard}>
            <AppText variant="title" style={{ marginBottom: 8 }}>
              Made for daily India
            </AppText>
            <AppText variant="body" style={{ color: palette.slate600, marginBottom: 14 }}>
              Clear timings, honest fares, and GST-ready invoices. Your trips tab syncs with the web — sign in on
              both.
            </AppText>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <AppText variant="caption" style={styles.pillText}>
                  Live schedules
                </AppText>
              </View>
              <View style={styles.pill}>
                <AppText variant="caption" style={styles.pillText}>
                  Secure checkout soon
                </AppText>
              </View>
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: "hidden",
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  eyebrow: {
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  heroTitle: { marginBottom: 14, lineHeight: 40 },
  heroSub: { color: "rgba(255,255,255,0.9)", maxWidth: 340, lineHeight: 22 },
  heroActions: { marginTop: 28, gap: 12 },
  secondBtn: { marginTop: 4, shadowOpacity: 0 },
  floatWrap: { paddingHorizontal: 20, zIndex: 3 },
  blurCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  blurInner: {
    padding: 20,
    backgroundColor: Platform.OS === "android" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)",
  },
  floatTitle: { fontSize: 16, marginBottom: 8, color: palette.indigo900 },
  floatBody: { marginBottom: 18, color: palette.slate700, lineHeight: 22 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  quickRow: { flexDirection: "row", gap: 10 },
  coinCard: { marginTop: 4, borderColor: palette.indigo100, backgroundColor: "#f8faff" },
  coinBadge: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: palette.indigo200,
    backgroundColor: palette.indigo50,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate200,
    ...{
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  },
  chipText: { color: palette.slate800, fontFamily: fonts.semibold, fontSize: 12 },
  trustCard: { marginTop: 4 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    backgroundColor: palette.indigo50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  pillText: { color: palette.indigo800, fontFamily: fonts.medium },
});

function QuickAction({
  title,
  icon,
  onPress,
  active,
}: {
  title: string;
  icon: "home" | "ticket" | "user";
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[stylesQa.base, active && stylesQa.active]}>
      <AppText variant="caption" style={[stylesQa.icon, active && stylesQa.iconOn]}>
        {icon === "home" ? "⌂" : icon === "ticket" ? "🎟" : "👤"}
      </AppText>
      <AppText variant="caption" style={[stylesQa.txt, active && stylesQa.txtOn]}>
        {title}
      </AppText>
    </Pressable>
  );
}

const stylesQa = StyleSheet.create({
  base: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate200,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  active: { borderColor: palette.indigo300, backgroundColor: palette.indigo50 },
  icon: { color: palette.slate500, fontSize: 14, lineHeight: 16 },
  iconOn: { color: palette.indigo700 },
  txt: { color: palette.slate700, fontFamily: fonts.medium },
  txtOn: { color: palette.indigo700, fontFamily: fonts.semibold },
});
