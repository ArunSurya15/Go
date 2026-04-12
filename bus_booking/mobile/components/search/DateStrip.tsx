import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { AppText } from "@/components/ui/AppText";
import { addDays, formatLocalYMD } from "@/lib/date";
import { fonts, palette, radii } from "@/constants/theme";

type Props = {
  selectedYmd: string;
  onSelectYmd: (ymd: string) => void;
  /** Opens system calendar (parent handles platform UI). */
  onOpenCalendar?: () => void;
  compact?: boolean;
};

export function DateStrip({ selectedYmd, onSelectYmd, onOpenCalendar, compact }: Props) {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: compact ? 12 : 16 }, (_, i) => addDays(start, i));
  }, [compact]);

  const chipW = compact ? 52 : 64;
  const pv = compact ? 7 : 10;
  const dayNum = compact ? 17 : 20;

  return (
    <View style={styles.wrap}>
      <View style={[styles.labelRow, compact && { marginBottom: 6 }]}>
        <AppText variant="label" style={[styles.label, compact && styles.labelCompact]}>
          Travel date
        </AppText>
        {onOpenCalendar ? (
          <Pressable onPress={onOpenCalendar} hitSlop={10} style={styles.calHit}>
            <FontAwesome name="calendar" size={compact ? 15 : 16} color={palette.indigo600} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={days}
        keyExtractor={(d) => formatLocalYMD(d)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: compact ? 8 : 10 }} />}
        renderItem={({ item }) => {
          const ymd = formatLocalYMD(item);
          const sel = ymd === selectedYmd;
          const isToday = ymd === formatLocalYMD(new Date());
          return (
            <Pressable
              onPress={() => onSelectYmd(ymd)}
              style={({ pressed }) => [
                styles.chip,
                { width: chipW, paddingVertical: pv },
                sel && styles.chipSelected,
                pressed && !sel && { opacity: 0.88 },
              ]}
            >
              <AppText variant="caption" style={[styles.dow, sel && styles.dowSel, compact && styles.dowSm]}>
                {isToday ? "Today" : item.toLocaleDateString("en-IN", { weekday: "short" })}
              </AppText>
              <AppText style={[styles.dayNum, { fontSize: dayNum }, sel && styles.dayNumSel]}>
                {item.getDate()}
              </AppText>
              <AppText variant="caption" style={[styles.mon, sel && styles.monSel, compact && styles.monSm]}>
                {item.toLocaleDateString("en-IN", { month: "short" })}
              </AppText>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 2 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  label: { marginBottom: 0 },
  labelCompact: { fontSize: 12 },
  calHit: { padding: 4 },
  list: { paddingVertical: 1, paddingRight: 6 },
  chip: {
    paddingHorizontal: 5,
    borderRadius: radii.md,
    backgroundColor: palette.slate100,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: palette.indigo600,
    borderColor: palette.indigo700,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  dow: { fontFamily: fonts.medium, color: palette.slate600, fontSize: 11 },
  dowSm: { fontSize: 10 },
  dowSel: { color: "rgba(255,255,255,0.88)" },
  dayNum: { marginVertical: 1, color: palette.slate900, fontFamily: fonts.bold },
  dayNumSel: { color: palette.white },
  mon: { fontSize: 11, color: palette.slate500 },
  monSm: { fontSize: 10 },
  monSel: { color: "rgba(255,255,255,0.92)" },
});
