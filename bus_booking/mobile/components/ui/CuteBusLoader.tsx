import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { fonts, palette, radii } from "@/constants/theme";
import { AppText } from "@/components/ui/AppText";

type Props = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function CuteBusLoader({
  title = "Finding your best buses...",
  subtitle = "Checking routes, offers, and seats",
  compact = false,
}: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const road = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const roadLoop = Animated.loop(
      Animated.timing(road, {
        toValue: 1,
        duration: 950,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sparkle, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    bobLoop.start();
    roadLoop.start();
    sparkleLoop.start();
    return () => {
      bobLoop.stop();
      roadLoop.stop();
      sparkleLoop.stop();
      bob.setValue(0);
      road.setValue(0);
      sparkle.setValue(0);
    };
  }, [bob, road, sparkle]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const roadX = road.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const sparkleOpacity = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Animated.View style={[styles.busWrap, { transform: [{ translateY: bobY }] }]}>
        <FontAwesome name="bus" size={compact ? 34 : 40} color={palette.indigo600} />
        <Animated.View style={[styles.spark, { opacity: sparkleOpacity }]}>
          <FontAwesome name="star" size={10} color="#f59e0b" />
        </Animated.View>
      </Animated.View>

      <View style={styles.roadClip}>
        <Animated.View style={[styles.roadLane, { transform: [{ translateX: roadX }] }]} />
      </View>

      <AppText style={styles.title}>{title}</AppText>
      {!compact ? <AppText variant="caption" style={styles.subtitle}>{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  wrapCompact: { paddingHorizontal: 12 },
  busWrap: { position: "relative" },
  spark: { position: "absolute", right: -10, top: -2 },
  roadClip: {
    marginTop: 8,
    width: 116,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: palette.slate200,
    overflow: "hidden",
  },
  roadLane: {
    width: 140,
    height: 6,
    backgroundColor: palette.indigo200,
    borderRadius: radii.full,
  },
  title: {
    marginTop: 12,
    color: palette.slate700,
    fontFamily: fonts.semibold,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 4,
    color: palette.slate500,
    textAlign: "center",
  },
});

