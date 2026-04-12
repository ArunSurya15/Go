import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { fonts } from "@/constants/theme";

type Props = {
  name: string;
  query: string;
  style?: StyleProp<TextStyle>;
};

/** Bold substring match (case-insensitive), redBus-style. */
export function HighlightCity({ name, query, style }: Props) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return <Text style={[styles.base, style]}>{name}</Text>;
  }
  const lower = name.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) {
    return <Text style={[styles.base, style]}>{name}</Text>;
  }
  return (
    <Text style={[styles.base, style]}>
      <Text>{name.slice(0, idx)}</Text>
      <Text style={styles.bold}>{name.slice(idx, idx + q.length)}</Text>
      <Text>{name.slice(idx + q.length)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { fontSize: 16, fontFamily: fonts.medium, color: "#0f172a" },
  bold: { fontFamily: fonts.bold, color: "#4f46e5" },
});
