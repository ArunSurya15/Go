import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, View } from "react-native";

import { fonts, palette, radii } from "@/constants/theme";
import { AppText } from "@/components/ui/AppText";

type ProblemAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
};

type Props = {
  eyebrow?: string;
  title: string;
  highlight?: string;
  description: string;
  primaryAction?: ProblemAction;
  secondaryAction?: ProblemAction;
};

export function AppProblemState({
  eyebrow = "Page not found",
  title,
  highlight,
  description,
  primaryAction,
  secondaryAction,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.illus}>
        <MaterialCommunityIcons name="bus-alert" size={70} color={palette.indigo500} />
      </View>

      <AppText variant="caption" style={styles.eyebrow}>
        {eyebrow}
      </AppText>
      <AppText style={styles.titleBase}>
        {title}
        {highlight ? <AppText style={styles.titleHighlight}> {highlight}</AppText> : null}
      </AppText>
      <AppText variant="body" style={styles.desc}>
        {description}
      </AppText>

      <View style={styles.actions}>
        {primaryAction ? (
          <Pressable onPress={primaryAction.onPress} style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}>
            <AppText style={styles.btnPrimaryText}>{primaryAction.label}</AppText>
          </Pressable>
        ) : null}
        {secondaryAction ? (
          <Pressable onPress={secondaryAction.onPress} style={({ pressed }) => [styles.btnOutline, pressed && styles.btnPressed]}>
            <AppText style={styles.btnOutlineText}>{secondaryAction.label}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center", paddingHorizontal: 14, paddingVertical: 16 },
  illus: {
    width: 170,
    height: 124,
    borderRadius: 24,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#6366f1",
    marginBottom: 8,
    fontFamily: fonts.bold,
  },
  titleBase: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 38, color: "#0f172a", textAlign: "center", marginBottom: 10 },
  titleHighlight: { color: "#4f46e5", fontFamily: fonts.bold },
  desc: { color: palette.slate600, textAlign: "center", lineHeight: 22, maxWidth: 320 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#4f46e5", borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 10 },
  btnPrimaryText: { color: "#fff", fontFamily: fonts.semibold },
  btnOutline: {
    backgroundColor: palette.white,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.slate200,
  },
  btnOutlineText: { color: palette.slate700, fontFamily: fonts.medium },
  btnPressed: { opacity: 0.86 },
});
