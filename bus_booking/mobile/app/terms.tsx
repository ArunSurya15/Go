import { ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { palette } from "@/constants/theme";

export default function TermsScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <AppText variant="title" style={{ marginBottom: 8 }}>Terms & Conditions</AppText>
      <AppText variant="body" style={{ color: palette.slate600, marginBottom: 14 }}>
        e-GO is a booking platform. Bus operations are provided by partner operators.
      </AppText>

      <SurfaceCard style={{ marginBottom: 12 }}>
        <Section title="Platform role" lines={[
          "e-GO issues booking confirmations and supports payment and refunds.",
          "Bus punctuality, route changes, and onboard service are operator-managed.",
          "Passenger should carry valid ID and arrive early at boarding point.",
        ]} />
      </SurfaceCard>

      <SurfaceCard style={{ marginBottom: 12 }}>
        <Section title="Booking and travel" lines={[
          "Tickets are non-transferable unless explicitly allowed by policy.",
          "Seat/layout changes can happen if operator updates vehicle assignment.",
          "Disputes are handled through e-GO support workflow and applicable law.",
        ]} />
      </SurfaceCard>

      <SurfaceCard>
        <Section title="Payments & refunds" lines={[
          "Refund timelines depend on bank/payment rail processing.",
          "Cancellation windows and refund percentages are defined in Cancellation Policy.",
          "By paying, you consent to these terms and data usage for booking fulfillment.",
        ]} />
      </SurfaceCard>
    </ScrollView>
  );
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  return (
    <View>
      <AppText variant="label" style={{ color: palette.slate700, marginBottom: 8 }}>{title}</AppText>
      {lines.map((line) => (
        <View key={line} style={styles.row}>
          <View style={styles.dot} />
          <AppText variant="body" style={{ color: palette.slate700, flex: 1 }}>{line}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: palette.indigo500 },
});

