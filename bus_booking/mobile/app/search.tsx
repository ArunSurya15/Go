import { router } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { fonts, palette, radii } from "@/constants/theme";

export default function SearchScreen() {
  return (
      <View style={styles.root}>
        <SurfaceCard>
          <AppText variant="title" style={{ marginBottom: 8 }}>
            Route search
          </AppText>
          <AppText variant="body" style={{ marginBottom: 20 }}>
            This screen is a styled shell. Next step: wire to `/api/routes/` and schedules like the website home page.
          </AppText>

          <AppText variant="label" style={styles.label}>
            From
          </AppText>
          <TextInput
            editable={false}
            placeholder="City or stop"
            placeholderTextColor={palette.slate500}
            style={styles.input}
          />

          <AppText variant="label" style={[styles.label, { marginTop: 14 }]}>
            To
          </AppText>
          <TextInput
            editable={false}
            placeholder="City or stop"
            placeholderTextColor={palette.slate500}
            style={styles.input}
          />

          <AppText variant="label" style={[styles.label, { marginTop: 14 }]}>
            Date
          </AppText>
          <TextInput
            editable={false}
            placeholder="Pick travel date"
            placeholderTextColor={palette.slate500}
            style={styles.input}
          />

          <PrimaryButton title="Search buses" disabled style={{ marginTop: 22 }} />
          <PrimaryButton title="Close" variant="outline" onPress={() => router.back()} style={{ marginTop: 12 }} />
        </SurfaceCard>
      </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.slate50, padding: 20, justifyContent: "flex-start", paddingTop: 16 },
  label: { marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: palette.slate200,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    backgroundColor: palette.slate100,
    color: palette.slate600,
  },
});
