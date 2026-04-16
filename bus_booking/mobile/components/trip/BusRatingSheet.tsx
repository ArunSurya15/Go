import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { fonts, palette, radii } from "@/constants/theme";
import { routesApi } from "@/lib/api";
import type { BusReview } from "@/lib/types";

// ─── colour helpers ──────────────────────────────────────────────────────────

const AMBER = "#f59e0b";
const AMBER_LIGHT = "#fef3c7";
const AMBER_TEXT = "#92400e";
const GREEN_BG = "#166534";
const AMBER_BG = "#92400e";
const ROSE_BG = "#9f1239";

function moodFromAvg(avg: number): { title: string; hint: string } {
  if (avg >= 4.5) return { title: "Standing ovation territory", hint: "Recent trips landed in the top tier." };
  if (avg >= 4) return { title: "Strong traveller trust", hint: "Scores cluster in the happy zone." };
  if (avg >= 3) return { title: "Solid, with nuance", hint: "Experiences vary — worth reading the notes." };
  return { title: "We're listening", hint: "Feedback is helping shape the next rides." };
}

function badgeColour(avg: number) {
  if (avg >= 4) return { bg: GREEN_BG, text: "#fff" };
  if (avg >= 3) return { bg: AMBER_BG, text: "#fff" };
  return { bg: ROSE_BG, text: "#fff" };
}

function reviewAccent(stars: number) {
  if (stars >= 4) return { bar: "#10b981", bg: "#f0fdf4", border: "#86efac", label: "#14532d" };
  if (stars === 3) return { bar: AMBER, bg: "#fffbeb", border: "#fcd34d", label: AMBER_TEXT };
  return { bar: "#f43f5e", bg: "#fff1f2", border: "#fda4af", label: "#881337" };
}

// ─── star histogram ───────────────────────────────────────────────────────────

function starHistogram(items: BusReview[]): [number, number, number, number, number] {
  const c = [0, 0, 0, 0, 0];
  for (const r of items) {
    const s = Math.min(5, Math.max(1, Math.round(r.stars)));
    c[s - 1] += 1;
  }
  return c as [number, number, number, number, number];
}

// ─── insight chips ────────────────────────────────────────────────────────────

function insightChips(avg: number, hist: [number, number, number, number, number]): string[] {
  const total = hist.reduce((a, b) => a + b, 0);
  const chips: string[] = [];
  if (total === 0) { chips.push("Be the first detailed review"); return chips; }
  if (hist[4] / total >= 0.55) chips.push("Heavy on 5★ moments");
  if (avg >= 4.2) chips.push("Comfort & punctuality vibes");
  if (avg >= 3.5 && avg < 4.2) chips.push("Balanced feedback");
  if (hist[0] + hist[1] > total * 0.2) chips.push("Some rough trips noted");
  chips.push("From real completed journeys");
  return [...new Set(chips)].slice(0, 4);
}

// ─── pulse line ───────────────────────────────────────────────────────────────

function pulseLine(avg: number, items: BusReview[]): string {
  const withText = items.filter((r) => r.comment?.trim());
  const snips = withText.slice(0, 3).map((r) => r.comment.trim());
  if (snips.length >= 2)
    return `Recent notes echo themes like "${snips[0].slice(0, 72)}${snips[0].length > 72 ? "…" : ""}" — travellers are sharing real trip texture, not just stars.`;
  if (snips.length === 1)
    return `One recent traveller wrote: "${snips[0].slice(0, 120)}${snips[0].length > 120 ? "…" : ""}" — every story helps the next passenger decide.`;
  const soft = [
    "Stars are rolling in from finished trips — written reviews paint the fuller picture once they land.",
    "This score blends every rating from completed journeys; add your voice after you travel to sharpen the signal.",
    "We surface raw traveller sentiment — no pay-to-win badges, just route-tested feedback.",
  ];
  return soft[Math.floor(avg * 7) % soft.length];
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StarDots({ stars, size = 12 }: { stars: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <AppText
          key={i}
          style={{
            fontSize: size,
            color: i <= Math.round(stars) ? AMBER : palette.slate200,
          }}
        >
          ★
        </AppText>
      ))}
    </View>
  );
}

function ScoreRing({ avg }: { avg: number }) {
  const bc = badgeColour(avg);
  return (
    <View style={[ring.wrap, { backgroundColor: bc.bg }]}>
      <AppText style={[ring.num, { color: bc.text }]}>{avg.toFixed(1)}</AppText>
      <AppText style={[ring.sub, { color: bc.text }]}>/ 5</AppText>
      <StarDots stars={avg} size={10} />
    </View>
  );
}

const ring = StyleSheet.create({
  wrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  num: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36 },
  sub: { fontFamily: fonts.medium, fontSize: 11 },
});

function DistributionBars({
  hist,
  total,
  onFilter,
  activeFilter,
}: {
  hist: [number, number, number, number, number];
  total: number;
  onFilter: (s: 1 | 2 | 3 | 4 | 5) => void;
  activeFilter: StarFilter;
}) {
  const maxVal = Math.max(1, ...hist);
  return (
    <View style={bars.wrap}>
      {([5, 4, 3, 2, 1] as const).map((star) => {
        const count = hist[star - 1];
        const pct = (count / maxVal) * 100;
        const isActive = activeFilter === star;
        return (
          <Pressable
            key={star}
            onPress={() => onFilter(star)}
            style={[bars.row, isActive && bars.rowActive]}
          >
            <AppText variant="caption" style={bars.starLabel}>
              {star}★
            </AppText>
            <View style={bars.track}>
              <View style={[bars.fill, { width: `${pct}%` }]} />
            </View>
            <AppText variant="caption" style={bars.count}>
              {count}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const bars = StyleSheet.create({
  wrap: { gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  rowActive: { backgroundColor: palette.indigo50 },
  starLabel: { width: 26, color: palette.slate500, textAlign: "right" },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: palette.slate100,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: AMBER,
    borderRadius: radii.full,
  },
  count: { width: 22, textAlign: "right", color: palette.slate500 },
});

type StarFilter = "all" | 1 | 2 | 3 | 4 | 5;

// ─── main sheet ───────────────────────────────────────────────────────────────

type Props = {
  busId: number;
  avg: number;
  count: number;
  visible: boolean;
  onClose: () => void;
};

export function BusRatingSheet({ busId, avg, count, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<BusReview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [starFilter, setStarFilter] = useState<StarFilter>("all");

  useEffect(() => {
    if (!visible) {
      setItems(null);
      setError("");
      setStarFilter("all");
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    routesApi
      .busReviews(busId)
      .then((data) => { if (alive) setItems(Array.isArray(data) ? data : []); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Could not load reviews."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible, busId]);

  const hist = useMemo(() => starHistogram(items ?? []), [items]);
  const mood = useMemo(() => moodFromAvg(avg), [avg]);
  const chips = useMemo(() => insightChips(avg, hist), [avg, hist]);
  const story = useMemo(() => pulseLine(avg, items ?? []), [avg, items]);
  const writtenCount = useMemo(() => items?.filter((r) => r.comment?.trim()).length ?? 0, [items]);
  const filtered = useMemo(() => {
    if (!items) return [];
    if (starFilter === "all") return items;
    return items.filter((r) => Math.round(r.stars) === starFilter);
  }, [items, starFilter]);

  const histNote =
    items && count > items.length
      ? `Bars show ${items.length} most recent of ${count} total ratings.`
      : items && items.length > 0
        ? "Distribution from loaded reviews."
        : null;

  const handleStarFilter = (s: 1 | 2 | 3 | 4 | 5) => {
    setStarFilter((prev) => (prev === s ? "all" : s));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={sh.backdrop} onPress={onClose} />
      <View style={[sh.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* handle */}
        <View style={sh.handle} />

        {/* header */}
        <View style={sh.header}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" style={sh.eyebrow}>
              Trip echo
            </AppText>
            <AppText variant="title" style={sh.title}>
              What riders left behind
            </AppText>
            <AppText variant="caption" style={sh.hint}>
              {mood.hint}
            </AppText>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={sh.closeBtn}>
            <AppText style={sh.closeBtnText}>✕</AppText>
          </Pressable>
        </View>

        <View style={sh.moodChip}>
          <AppText variant="caption" style={sh.moodChipText}>
            ✦ {mood.title}
          </AppText>
        </View>

        {/* body */}
        {loading ? (
          <View style={sh.loadWrap}>
            <ActivityIndicator color={palette.indigo600} />
            <AppText variant="caption" style={{ color: palette.slate500, marginTop: 10 }}>
              Tuning into reviews…
            </AppText>
          </View>
        ) : error ? (
          <View style={sh.loadWrap}>
            <AppText variant="body" style={{ color: palette.rose500, textAlign: "center" }}>
              {error}
            </AppText>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={sh.scrollContent}
          >
            {/* score + stars */}
            <View style={sh.scoreRow}>
              <ScoreRing avg={avg} />
              <View style={{ flex: 1 }}>
                <AppText variant="label" style={{ marginBottom: 2 }}>
                  Overall signal
                </AppText>
                <AppText variant="caption" style={{ color: palette.slate500 }}>
                  {count} rating{count === 1 ? "" : "s"} from finished trips
                  {writtenCount > 0 ? ` · ${writtenCount} with notes` : ""}
                </AppText>
                <StarDots stars={avg} size={14} />
              </View>
            </View>

            {/* distribution bars */}
            {items && items.length > 0 ? (
              <View style={sh.section}>
                <AppText variant="caption" style={sh.sectionLabel}>
                  Star spread — tap a row to filter
                </AppText>
                <DistributionBars
                  hist={hist}
                  total={items.length}
                  onFilter={handleStarFilter}
                  activeFilter={starFilter}
                />
                {histNote ? (
                  <AppText variant="caption" style={{ color: palette.slate400, marginTop: 6 }}>
                    {histNote}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {/* insight chips */}
            <View style={sh.section}>
              <View style={sh.chipRow}>
                {chips.map((c) => (
                  <View key={c} style={sh.chip}>
                    <AppText variant="caption" style={sh.chipText}>
                      {c}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>

            {/* pulse */}
            <View style={[sh.section, sh.pulseBox]}>
              <AppText variant="caption" style={sh.pulseEye}>
                ❝ The pulse
              </AppText>
              <AppText variant="body" style={sh.pulseText}>
                {story}
              </AppText>
            </View>

            {/* star filter pills */}
            <View style={sh.section}>
              <AppText variant="caption" style={sh.sectionLabel}>
                Refine reviews
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(["all", 5, 4, 3, 2, 1] as const).map((f) => (
                  <Pressable
                    key={String(f)}
                    onPress={() => setStarFilter((prev) => (prev === f ? "all" : f))}
                    style={[sh.pill, starFilter === f && sh.pillActive]}
                  >
                    <AppText
                      variant="caption"
                      style={[sh.pillText, starFilter === f && sh.pillTextActive]}
                    >
                      {f === "all" ? "All" : `${f}★`}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* review list */}
            {!items || items.length === 0 ? (
              <View style={sh.emptyBox}>
                <AppText variant="body" style={{ color: palette.slate500, textAlign: "center" }}>
                  No written reviews yet. Star-only ratings still shape the overall score — add a
                  line after your trip to help the next traveller.
                </AppText>
              </View>
            ) : filtered.length === 0 ? (
              <View style={sh.emptyBox}>
                <AppText variant="body" style={{ color: palette.slate500, textAlign: "center" }}>
                  Nothing in this star bucket.
                </AppText>
              </View>
            ) : (
              <View style={sh.section}>
                {filtered.map((r) => {
                  const ac = reviewAccent(r.stars);
                  return (
                    <View
                      key={r.id}
                      style={[sh.reviewCard, { backgroundColor: ac.bg, borderColor: ac.border, borderLeftColor: ac.bar }]}
                    >
                      <View style={sh.reviewTop}>
                        <View style={[sh.starsBadge, { backgroundColor: `${ac.bar}22` }]}>
                          <AppText variant="caption" style={[sh.starsBadgeText, { color: ac.label }]}>
                            ★ {r.stars.toFixed(1)}
                          </AppText>
                        </View>
                        <AppText variant="caption" style={sh.reviewDate}>
                          {new Date(r.created_at).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </AppText>
                      </View>
                      <AppText variant="caption" style={sh.reviewAuthor}>
                        {r.reviewer_label}
                      </AppText>
                      <StarDots stars={r.stars} size={11} />
                      {r.comment?.trim() ? (
                        <AppText variant="body" style={sh.reviewComment}>
                          {r.comment.trim()}
                        </AppText>
                      ) : (
                        <AppText variant="caption" style={sh.reviewNoComment}>
                          Star rating only
                        </AppText>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)" },
  sheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "90%",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: palette.slate200,
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  eyebrow: {
    color: palette.indigo600,
    fontFamily: fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: { fontSize: 20, marginBottom: 4 },
  hint: { color: palette.slate500 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: palette.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontFamily: fonts.bold, color: palette.slate600, fontSize: 14 },
  moodChip: {
    alignSelf: "flex-start",
    backgroundColor: palette.indigo50,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  moodChipText: { color: palette.indigo700, fontFamily: fonts.semibold },
  loadWrap: { height: 180, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: 24 },
  scoreRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  section: { marginTop: 20 },
  sectionLabel: {
    color: palette.slate400,
    fontFamily: fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: palette.indigo50,
    borderWidth: 1,
    borderColor: palette.indigo200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  chipText: { color: palette.indigo700, fontFamily: fonts.medium },
  pulseBox: {
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: radii.md,
    padding: 14,
    marginTop: 16,
  },
  pulseEye: {
    color: "#7c3aed",
    fontFamily: fonts.semibold,
    marginBottom: 6,
  },
  pulseText: { color: palette.slate700, lineHeight: 20 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: palette.slate100,
  },
  pillActive: { backgroundColor: palette.indigo600 },
  pillText: { color: palette.slate600, fontFamily: fonts.medium },
  pillTextActive: { color: palette.white, fontFamily: fonts.semibold },
  emptyBox: {
    marginTop: 20,
    padding: 20,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.slate200,
    alignItems: "center",
  },
  reviewCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
    gap: 4,
  },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  starsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  starsBadgeText: { fontFamily: fonts.bold },
  reviewDate: { color: palette.slate400 },
  reviewAuthor: { color: palette.slate700, fontFamily: fonts.semibold, marginBottom: 2 },
  reviewComment: { color: palette.slate800, marginTop: 6, lineHeight: 20 },
  reviewNoComment: { color: palette.slate400, fontStyle: "italic", marginTop: 4 },
});
