import { StyleSheet, View, type ViewProps } from "react-native";

import { palette, radii, shadows } from "@/constants/theme";

export function SurfaceCard({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderRadius: radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.slate100,
    ...shadows.card,
  },
});
