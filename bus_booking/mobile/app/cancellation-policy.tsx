import { ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette, radii } from "@/constants/theme";

export default function CancellationPolicyScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <AppText variant="title" style={{ marginBottom: 8 }}>Cancellation & Refund</AppText>
      <AppText variant="body" style={{ color: palette.slate600, marginBottom: 14 }}>
        Cancel directly from My Trips. Refund depends on how early you cancel before departure.
      </AppText>

      <View style={styles.tierGrid}>
        <Tier title="24h+ before departure" pct="100% refund" bg="#dcfce7" fg="#166534" />
        <Tier title="6-24h before departure" pct="50% refund" bg="#fef3c7" fg="#92400e" />
        <Tier title="Less than 6h" pct="No refund" bg="#fee2e2" fg="#991b1b" />
      </View>

      <SurfaceCard style={{ marginTop: 12 }}>
        <AppText variant="label" style={styles.head}>How refunds work</AppText>
        <Bullet text="Refund goes to original payment method (UPI/card/netbanking)." />
        <Bullet text="Convenience fee and GST are non-refundable unless required by law." />
        <Bullet text="If operator cancels the trip, full fare refund is processed." />
        <Bullet text="Typical refund timeline: 5-7 business days, bank dependent." />
      </SurfaceCard>
    </ScrollView>
  );
}

function Tier({ title, pct, bg, fg }: { title: string; pct: string; bg: string; fg: string }) {
  return (
    <View style={[styles.tierCard, { backgroundColor: bg }]}>
      <AppText variant="caption" style={{ color: fg }}>{title}</AppText>
      <AppText variant="label" style={{ color: fg }}>{pct}</AppText>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.dot} />
      <AppText variant="body" style={{ color: palette.slate700, flex: 1 }}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  tierGrid: { gap: 8 },
  tierCard: { borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: "rgba(15,23,42,0.06)" },
  head: { marginBottom: 8, color: palette.slate700 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: palette.indigo500 },
});

