import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/**
 * Steering marker for the seat map header.
 *
 * The same SVG as the web app would require `react-native-svg`, but resolving that package
 * on Expo SDK 54 + RN 0.81 currently hits Metro/codegen issues (`fabric/*NativeComponent`).
 * This uses the vector icon set until a native-safe SVG path is in place.
 */
export function SteeringWheelIcon({
  size = 30,
  color = "#94a3b8",
}: {
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name="steering" size={size} color={color} />;
}
