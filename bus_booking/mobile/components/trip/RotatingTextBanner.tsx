import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { fonts, palette, radii } from "@/constants/theme";

type Props = {
  lines: string[];
  intervalMs?: number;
};

export function RotatingTextBanner({ lines, intervalMs = 3600 }: Props) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (lines.length === 0) return;
    if (lines.length === 1) {
      opacity.setValue(1);
      return;
    }
    const run = () => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % lines.length);
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    };
    const t = setInterval(run, intervalMs);
    return () => clearInterval(t);
  }, [lines, intervalMs, opacity]);

  if (lines.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ opacity }}>
        <AppText variant="body" style={styles.text} numberOfLines={2}>
          {lines[index % lines.length]}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: palette.indigo50,
    borderWidth: 1,
    borderColor: palette.indigo200,
    minHeight: 52,
    justifyContent: "center",
  },
  text: {
    color: palette.indigo900,
    fontFamily: fonts.medium,
  },
});
