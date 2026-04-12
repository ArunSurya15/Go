import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

import { AppText } from "@/components/ui/AppText";
import { fonts, palette, radii, shadows } from "@/constants/theme";

type Props = Omit<PressableProps, "style" | "children"> & {
  title: string;
  loading?: boolean;
  variant?: "filled" | "outline" | "ghostOnDark";
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  title,
  loading,
  variant = "filled",
  disabled,
  style,
  ...rest
}: Props) {
  const isOutline = variant === "outline";
  const isGhost = variant === "ghostOnDark";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        variant === "filled" && styles.filled,
        isOutline && styles.outline,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        StyleSheet.flatten(style),
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={isOutline || isGhost ? palette.indigo600 : palette.white} />
        ) : (
          <AppText
            style={[
              styles.label,
              isOutline && styles.labelOutline,
              isGhost && styles.labelGhost,
            ]}
          >
            {title}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    overflow: "hidden",
    ...shadows.soft,
  },
  filled: {
    backgroundColor: palette.indigo600,
  },
  outline: {
    backgroundColor: palette.white,
    borderWidth: 1.5,
    borderColor: palette.indigo200,
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: palette.white,
  },
  labelOutline: {
    color: palette.indigo700,
  },
  labelGhost: {
    color: palette.white,
  },
});
