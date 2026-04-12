import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette, radii } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";

export default function BookHomeScreen() {
  const insets = useSafeAreaInsets();
  const { access } = useAuth();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#312e81", "#4f46e5", "#6366f1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 24 }]}
      >
        <AppText variant="caption" style={styles.eyebrow}>
          e-GO
        </AppText>
        <AppText variant="hero" style={styles.heroTitle}>
          Bus travel, simplified.
        </AppText>
        <AppText variant="subtitle" style={styles.heroSub}>
          Search routes, pick seats, and ride with confidence — built for India, ready to scale.
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

      <View style={[styles.lower, { paddingBottom: insets.bottom + 16 }]}>
        <SurfaceCard style={styles.card}>
          <AppText variant="title" style={styles.cardTitle}>
            What&apos;s next
          </AppText>
          <AppText variant="body" style={styles.cardBody}>
            This app shares your Django API with the website. Upcoming: full search, seat map, Razorpay checkout, and
            tickets in your pocket.
          </AppText>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <AppText variant="caption" style={styles.pillText}>
                Expo + RN
              </AppText>
            </View>
            <View style={styles.pill}>
              <AppText variant="caption" style={styles.pillText}>
                Same backend
              </AppText>
            </View>
          </View>
        </SurfaceCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: { marginBottom: 12 },
  heroSub: { color: "rgba(255,255,255,0.88)", maxWidth: 340 },
  heroActions: { marginTop: 28, gap: 12 },
  secondBtn: { marginTop: 4, shadowOpacity: 0 },
  lower: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  card: { marginTop: 4 },
  cardTitle: { marginBottom: 8 },
  cardBody: { marginBottom: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    backgroundColor: palette.indigo50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  pillText: { color: palette.indigo700 },
});
