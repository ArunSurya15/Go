import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { fonts, palette, radii } from "@/constants/theme";
import type { RoutePatternStop } from "@/lib/types";

type Props = {
  stops: RoutePatternStop[];
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
};

function dotColor(role: "start" | "via" | "end") {
  if (role === "start") return "#ef4444"; // red
  if (role === "end") return "#22c55e";   // green
  return "#3b82f6";                       // blue (via)
}

function stopRole(idx: number, total: number): "start" | "via" | "end" {
  if (idx === 0) return "start";
  if (idx === total - 1) return "end";
  return "via";
}

export function RouteStopTimeline({ stops, from, to, departureTime, arrivalTime }: Props) {
  const sorted = [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (sorted.length < 2) return null;

  return (
    <View style={styles.wrap}>
      {sorted.map((stop, idx) => {
        const role = stopRole(idx, sorted.length);
        const dot = dotColor(role);
        const isFirst = idx === 0;
        const isLast = idx === sorted.length - 1;
        const displayName =
          isFirst ? (from.trim() || stop.name) : isLast ? (to.trim() || stop.name) : stop.name;
        const timeHint = isFirst ? departureTime : isLast ? arrivalTime : null;

        return (
          <View key={`${stop.order}-${stop.name}`} style={styles.row}>
            {/* spine */}
            <View style={styles.spineCol}>
              {!isFirst ? <View style={[styles.lineSegTop, { backgroundColor: dot }]} /> : <View style={styles.lineSegTop} />}
              <View style={[styles.dot, { backgroundColor: dot, borderColor: `${dot}55` }]} />
              {!isLast ? <View style={[styles.lineSegBottom, { backgroundColor: "#cbd5e1" }]} /> : null}
            </View>

            {/* label */}
            <View style={styles.labelCol}>
              <View style={styles.labelRow}>
                <AppText
                  variant={role !== "via" ? "body" : "caption"}
                  style={[
                    styles.stopName,
                    role === "start" && styles.stopStart,
                    role === "end" && styles.stopEnd,
                  ]}
                  numberOfLines={2}
                >
                  {displayName}
                </AppText>
                {timeHint ? (
                  <AppText variant="caption" style={[styles.timeHint, { color: dot }]}>
                    {timeHint}
                  </AppText>
                ) : null}
              </View>
              {role === "via" ? (
                <AppText variant="caption" style={styles.viaHint}>
                  via stop
                </AppText>
              ) : role === "start" ? (
                <AppText variant="caption" style={styles.roleBadge}>
                  Departure
                </AppText>
              ) : (
                <AppText variant="caption" style={styles.roleBadge}>
                  Destination
                </AppText>
              )}
            </View>
          </View>
        );
      })}

      <AppText variant="caption" style={styles.footnote}>
        {sorted.length} stop{sorted.length === 1 ? "" : "s"} in journey order.
        Intermediate stop times are not shown (only departure & arrival are confirmed).
      </AppText>
    </View>
  );
}

const DOT_SIZE = 14;
const LINE_W = 2;

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: "row", alignItems: "stretch", minHeight: 48 },
  spineCol: { width: 28, alignItems: "center" },
  lineSegTop: {
    flex: 1,
    width: LINE_W,
    backgroundColor: "#cbd5e1",
    maxHeight: 12,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    marginVertical: 2,
  },
  lineSegBottom: {
    flex: 1,
    width: LINE_W,
    minHeight: 14,
  },
  labelCol: { flex: 1, paddingLeft: 8, paddingBottom: 10, paddingTop: 4 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  stopName: { flex: 1, color: palette.slate800, lineHeight: 20 },
  stopStart: { fontFamily: fonts.bold, color: "#b91c1c" },
  stopEnd: { fontFamily: fonts.bold, color: "#15803d" },
  timeHint: { fontFamily: fonts.semibold, fontSize: 12, flexShrink: 0 },
  viaHint: { color: palette.slate400, marginTop: 1 },
  roleBadge: { color: palette.slate500, marginTop: 1 },
  footnote: { color: palette.slate400, marginTop: 8, lineHeight: 18 },
});
