"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Filter, MessageSquareQuote, Sparkles, Star, X } from "lucide-react";
import { routes, type BusReviewItem } from "@/lib/api";
import { cn } from "@/lib/utils";

function ratingBadgeTier(avg: number) {
  if (avg >= 4) {
    return {
      wrap: "border-0 bg-green-900 text-white shadow-sm ring-1 ring-green-950/30 dark:bg-emerald-950 dark:ring-emerald-900/50",
      star: "fill-white text-white",
      sub: "text-white/90",
    };
  }
  if (avg >= 3) {
    return {
      wrap: "border-0 bg-amber-600 text-white shadow-sm ring-1 ring-amber-800/35 dark:bg-amber-700 dark:ring-amber-900/40",
      star: "fill-white text-white",
      sub: "text-white/90",
    };
  }
  return {
    wrap: "border-0 bg-red-700 text-white shadow-sm ring-1 ring-red-900/35 dark:bg-red-900 dark:ring-red-950/50",
    star: "fill-white text-white",
    sub: "text-white/90",
  };
}

function moodFromAvg(avg: number): { title: string; hint: string; accent: string } {
  if (avg >= 4.5) {
    return {
      title: "Standing ovation territory",
      hint: "Recent trips landed in the top tier.",
      accent: "from-emerald-500/20 to-teal-500/10",
    };
  }
  if (avg >= 4) {
    return {
      title: "Strong traveller trust",
      hint: "Scores cluster in the happy zone.",
      accent: "from-sky-500/20 to-cyan-500/10",
    };
  }
  if (avg >= 3) {
    return {
      title: "Solid, with nuance",
      hint: "Experiences vary — worth reading the notes.",
      accent: "from-amber-500/20 to-orange-500/10",
    };
  }
  return {
    title: "We’re listening",
    hint: "Feedback is helping shape the next rides.",
    accent: "from-rose-500/15 to-orange-500/10",
  };
}

/** Count index 0 = 1★ … index 4 = 5★ */
function starHistogram(items: BusReviewItem[]): [number, number, number, number, number] {
  const c = [0, 0, 0, 0, 0];
  for (const r of items) {
    const s = Math.min(5, Math.max(1, Math.round(r.stars)));
    c[s - 1] += 1;
  }
  return [c[0], c[1], c[2], c[3], c[4]];
}

function insightChips(avg: number, hist: [number, number, number, number, number]): string[] {
  const total = hist.reduce((a, b) => a + b, 0);
  const five = hist[4];
  const chips: string[] = [];
  if (total === 0) {
    chips.push("Be the first detailed review");
    return chips;
  }
  if (five / total >= 0.55) chips.push("Heavy on 5★ moments");
  if (avg >= 4.2) chips.push("Comfort & punctuality vibes");
  if (avg >= 3.5 && avg < 4.2) chips.push("Balanced feedback");
  if (hist[0] + hist[1] > total * 0.2) chips.push("Some rough trips noted");
  chips.push("From real completed journeys");
  return [...new Set(chips)].slice(0, 4);
}

function pulseLine(avg: number, items: BusReviewItem[]): string {
  const withText = items.filter((r) => r.comment?.trim());
  const snippets = withText.slice(0, 3).map((r) => r.comment.trim());
  if (snippets.length >= 2) {
    return `Recent notes echo themes like “${snippets[0].slice(0, 72)}${snippets[0].length > 72 ? "…" : ""}” — travellers are sharing real trip texture, not just stars.`;
  }
  if (snippets.length === 1) {
    return `One recent traveller wrote: “${snippets[0].slice(0, 120)}${snippets[0].length > 120 ? "…" : ""}” — every story helps the next passenger decide.`;
  }
  const soft = [
    "Stars are rolling in from finished trips — written reviews paint the fuller picture once they land.",
    "This score blends every rating from completed journeys; add your voice after you travel to sharpen the signal.",
    "We surface raw traveller sentiment — no pay-to-win badges, just route-tested feedback.",
  ];
  return soft[Math.floor(avg * 7) % soft.length];
}

function ScoreRing({ avg }: { avg: number }) {
  const pct = Math.min(1, Math.max(0, avg / 5));
  const circ = 2 * Math.PI * 38;
  const dash = pct * circ;
  return (
    <div className="relative mx-auto shrink-0">
      <svg width="112" height="112" viewBox="0 0 100 100" className="-rotate-90 text-muted/25" aria-hidden>
        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="url(#tripEchoScoreGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-[stroke-dasharray] duration-500 ease-out"
        />
        <defs>
          <linearGradient id="tripEchoScoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(251 191 36)" />
            <stop offset="100%" stopColor="rgb(234 88 12)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{avg.toFixed(1)}</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">out of 5</span>
      </div>
    </div>
  );
}

function DistributionBars({
  hist,
  maxVal,
}: {
  hist: [number, number, number, number, number];
  maxVal: number;
}) {
  const rows = [5, 4, 3, 2, 1].map((star) => {
    const count = hist[star - 1];
    const w = maxVal > 0 ? (count / maxVal) * 100 : 0;
    return { star, count, w };
  });
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Star spread</p>
      <div className="space-y-1.5">
        {rows.map(({ star, count, w }) => (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-8 tabular-nums text-muted-foreground">{star}★</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                style={{ width: `${w}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type StarFilter = "all" | 1 | 2 | 3 | 4 | 5;

export function BusRatingReviewsTrigger({
  busId,
  avg,
  count,
}: {
  busId: number;
  avg: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BusReviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [starFilter, setStarFilter] = useState<StarFilter>("all");
  const tier = ratingBadgeTier(avg);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    routes
      .busReviews(busId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load reviews.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, busId]);

  useEffect(() => {
    if (!open) {
      setItems(null);
      setError("");
      setStarFilter("all");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hist = useMemo(() => starHistogram(items ?? []), [items]);
  const maxHist = useMemo(() => Math.max(1, ...hist), [hist]);
  const mood = useMemo(() => moodFromAvg(avg), [avg]);
  const chips = useMemo(() => insightChips(avg, hist), [avg, hist]);
  const story = useMemo(() => pulseLine(avg, items ?? []), [avg, items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (starFilter === "all") return items;
    return items.filter((r) => Math.round(r.stars) === starFilter);
  }, [items, starFilter]);

  const writtenCount = items?.filter((r) => r.comment?.trim()).length ?? 0;
  const histNote =
    items && count > items.length
      ? `Bars use your ${items.length} most recent ratings — ${count} total on file.`
      : items && items.length > 0
        ? "Distribution from loaded reviews."
        : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-opacity hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          tier.wrap
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Star className={cn("h-3.5 w-3.5", tier.star)} aria-hidden />
        {avg.toFixed(1)}
        <span className={cn("font-normal", tier.sub)}>({count})</span>
        <span className="sr-only">, open passenger reviews</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="bus-reviews-title"
                className="flex max-h-[min(92vh,40rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[min(90vh,44rem)] sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={cn(
                    "relative border-b border-border/80 bg-gradient-to-br px-4 py-4 sm:px-6 sm:py-5",
                    mood.accent
                  )}
                >
                  <div className="pointer-events-none absolute right-4 top-4 opacity-[0.07] sm:right-6">
                    <MessageSquareQuote className="h-24 w-24 rotate-12 text-foreground" aria-hidden />
                  </div>
                  <div className="flex items-start justify-between gap-3 pr-10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Trip echo</p>
                      <h2 id="bus-reviews-title" className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                        What riders left behind
                      </h2>
                      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{mood.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-4 sm:top-4"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur-sm dark:bg-background/40">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                    {mood.title}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {loading ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Tuning into reviews…</p>
                  ) : error ? (
                    <p className="px-4 py-8 text-sm text-destructive sm:px-6">{error}</p>
                  ) : (
                    <div className="grid gap-6 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-8 sm:p-6">
                      <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <ScoreRing avg={avg} />
                          <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
                            <p className="text-sm font-medium text-foreground">Overall signal</p>
                            <p className="text-xs text-muted-foreground">
                              {count} rating{count === 1 ? "" : "s"} from finished trips
                              {writtenCount > 0 ? ` · ${writtenCount} with notes` : ""}
                            </p>
                            <div className="flex justify-center gap-0.5 pt-1 sm:justify-start" aria-hidden>
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "h-4 w-4",
                                    i < Math.round(avg)
                                      ? "fill-amber-400 text-amber-500"
                                      : "fill-muted/25 text-muted-foreground/35"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {items && items.length > 0 ? (
                          <DistributionBars hist={hist} maxVal={maxHist} />
                        ) : (
                          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                            Star bars appear once we have ratings in the feed — the score above still reflects
                            everyone who rated this bus.
                          </p>
                        )}
                        {histNote ? (
                          <p className="text-[10px] leading-snug text-muted-foreground">{histNote}</p>
                        ) : null}

                        <div className="flex flex-wrap gap-1.5">
                          {chips.map((c) => (
                            <span
                              key={c}
                              className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary"
                            >
                              {c}
                            </span>
                          ))}
                        </div>

                        <div className="rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-background p-3 text-sm leading-relaxed text-foreground dark:border-violet-900/50 dark:from-violet-950/40 dark:to-background">
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
                            The pulse (plain-language)
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">{story}</p>
                        </div>
                      </div>

                      <div className="min-h-0 min-w-0 border-t border-border/60 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Refine
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(["all", 5, 4, 3, 2, 1] as const).map((f) => (
                              <button
                                key={String(f)}
                                type="button"
                                onClick={() => setStarFilter(f)}
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                                  starFilter === f
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {f === "all" ? "All" : `${f}★`}
                              </button>
                            ))}
                          </div>
                        </div>

                        {!items || items.length === 0 ? (
                          <p className="py-6 text-sm leading-relaxed text-muted-foreground">
                            No written reviews yet. Star-only ratings still shape the overall score — add a line
                            after your trip to help the next traveller.
                          </p>
                        ) : filtered.length === 0 ? (
                          <p className="py-6 text-sm text-muted-foreground">Nothing in this star bucket.</p>
                        ) : (
                          <ul className="space-y-3 pr-1">
                            {filtered.map((r) => (
                              <li
                                key={r.id}
                                className={cn(
                                  "rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 dark:bg-muted/15",
                                  r.stars >= 4 && "border-l-4 border-l-emerald-500/80",
                                  r.stars === 3 && "border-l-4 border-l-amber-500/70",
                                  r.stars <= 2 && "border-l-4 border-l-rose-500/70"
                                )}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                                      r.stars >= 4 && "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200",
                                      r.stars === 3 && "bg-amber-600/15 text-amber-900 dark:text-amber-200",
                                      r.stars <= 2 && "bg-rose-600/15 text-rose-900 dark:text-rose-200"
                                    )}
                                  >
                                    <Star className="h-3 w-3 fill-current" aria-hidden />
                                    {r.stars.toFixed(1)}
                                  </span>
                                  <time
                                    className="text-[11px] tabular-nums text-muted-foreground"
                                    dateTime={r.created_at}
                                  >
                                    {new Date(r.created_at).toLocaleDateString(undefined, {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </time>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-foreground">{r.reviewer_label}</p>
                                <div className="mt-1 flex gap-0.5" aria-label={`${r.stars} out of 5 stars`}>
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        "h-3 w-3",
                                        i < r.stars
                                          ? "fill-amber-400 text-amber-500"
                                          : "fill-muted/25 text-muted-foreground/35"
                                      )}
                                      aria-hidden
                                    />
                                  ))}
                                </div>
                                {r.comment ? (
                                  <p className="mt-2 text-sm leading-snug text-foreground/90">{r.comment}</p>
                                ) : (
                                  <p className="mt-1.5 text-xs italic text-muted-foreground">Star rating only</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
