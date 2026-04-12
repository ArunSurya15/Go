import { StyleSheet, Text, type TextProps } from "react-native";

import { fonts } from "@/constants/theme";

type Variant = "hero" | "title" | "subtitle" | "body" | "caption" | "label";

export function AppText({
  variant = "body",
  style,
  ...rest
}: TextProps & { variant?: Variant }) {
  return <Text style={[styles.base, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    color: "#0f172a",
    fontFamily: fonts.regular,
  },
  hero: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: "#ffffff",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: "#0f172a",
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: "#475569",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: "#64748b",
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: "#334155",
  },
});
