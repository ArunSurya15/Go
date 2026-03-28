"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes, type Schedule } from "@/lib/api";
import { BUS_FEATURES_FALLBACK, LAYOUT_KIND_LABELS } from "@/lib/bus-features";
import {
  ScheduleFiltersPanel,
  computeFareBounds,
  applyScheduleFilters,
  DEFAULT_FILTERS,
  type ScheduleFilterState,
} from "@/components/schedule-filters";
import {
  Bus,
  MapPin,
  Star,
  ArrowLeft,
  Calendar,
  Search,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function buildSchedulesPath(routeId: string, date: string, from: string, to: string) {
  const q = new URLSearchParams();
  q.set("route_id", routeId);
  q.set("date", date);
  q.set("from", from);
  q.set("to", to);
  return `/schedules?${q.toString()}`;
}

function formatJourneyDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function journeyDayHint(iso: string, todayIso: string, tomorrowIso: string) {
  if (iso === todayIso) return "(Today)";
  if (iso === tomorrowIso) return "(Tomorrow)";
  return "";
}

function isoFromParts(y: number, m0: number, d: number) {
  const mm = String(m0 + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Monday = 0 … Sunday = 6 */
function weekdayMonFirst(d: Date) {
  return (d.getDay() + 6) % 7;
}

function SchedulesDateCalendar({
  selectedIso,
  minIso,
  onSelect,
}: {
  selectedIso: string;
  minIso: string;
  onSelect: (iso: string) => void;
}) {
  const minTime = useMemo(() => new Date(minIso + "T12:00:00").getTime(), [minIso]);

  const [view, setView] = useState(() => {
    const t = new Date(selectedIso + "T12:00:00");
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  useEffect(() => {
    const t = new Date(selectedIso + "T12:00:00");
    setView(new Date(t.getFullYear(), t.getMonth(), 1));
  }, [selectedIso]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const monthLabel = view.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const padStart = weekdayMonFirst(first);
  const prevMonthLast = new Date(year, month, 0).getDate();

  const cells: {
    key: string;
    day: number;
    iso: string | null;
    inMonth: boolean;
    isSunday: boolean;
    disabled: boolean;
  }[] = [];

  for (let i = 0; i < padStart; i++) {
    const day = prevMonthLast - padStart + i + 1;
    const d = new Date(year, month - 1, day);
    const iso = isoFromParts(d.getFullYear(), d.getMonth(), d.getDate());
    const t = new Date(iso + "T12:00:00").getTime();
    cells.push({
      key: `p-${iso}`,
      day,
      iso,
      inMonth: false,
      isSunday: d.getDay() === 0,
      disabled: t < minTime,
    });
  }

  for (let d = 1; d <= lastDay; d++) {
    const iso = isoFromParts(year, month, d);
    const t = new Date(iso + "T12:00:00").getTime();
    const dt = new Date(year, month, d);
    cells.push({
      key: iso,
      day: d,
      iso,
      inMonth: true,
      isSunday: dt.getDay() === 0,
      disabled: t < minTime,
    });
  }

  const rest = (7 - (cells.length % 7)) % 7;
  if (rest > 0) {
    let nextD = 1;
    for (let i = 0; i < rest; i++, nextD++) {
      const d = new Date(year, month + 1, nextD);
      const iso = isoFromParts(d.getFullYear(), d.getMonth(), d.getDate());
      const t = new Date(iso + "T12:00:00").getTime();
      cells.push({
        key: `n-${iso}`,
        day: nextD,
        iso,
        inMonth: false,
        isSunday: d.getDay() === 0,
        disabled: t < minTime,
      });
    }
  }

  const prevMonth = () => setView(new Date(year, month - 1, 1));
  const nextMonth = () => setView(new Date(year, month + 1, 1));

  return (
    <div className="w-[min(100vw-2rem,320px)] rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl dark:border-zinc-200 dark:bg-white dark:text-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-100"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold text-zinc-900">{monthLabel}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-100"
          onClick={nextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-y-1 text-center text-[11px] font-medium text-zinc-500">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((c) => {
          const isSel = c.iso != null && c.iso === selectedIso;
          return (
            <div key={c.key} className="flex h-9 items-center justify-center">
              {c.iso && !c.disabled ? (
                <button
                  type="button"
                  onClick={() => onSelect(c.iso!)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                    !c.inMonth && "text-zinc-400 ring-1 ring-zinc-200",
                    c.inMonth && !isSel && c.isSunday && "text-red-600",
                    c.inMonth && !isSel && !c.isSunday && "text-zinc-900",
                    isSel && "bg-zinc-900 font-medium text-white",
                    !isSel && c.inMonth && "hover:bg-zinc-100"
                  )}
                >
                  {c.day}
                </button>
              ) : (
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm text-zinc-300",
                    c.isSunday && c.inMonth && "text-red-400"
                  )}
                >
                  {c.day}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchedulesTripHeader({
  routeId,
  date,
  from,
  to,
  busCount,
  schedulesLoading,
  onSearch,
}: {
  routeId: string;
  date: string;
  from: string;
  to: string;
  busCount: number | null;
  schedulesLoading: boolean;
  onSearch: () => void;
}) {
  const router = useRouter();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowIso = useMemo(
    () => new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    []
  );

  useEffect(() => {
    if (!datePickerOpen) return;
    const close = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [datePickerOpen]);

  const navigateDate = (next: string) => {
    router.push(buildSchedulesPath(routeId, next, from, to));
    setDatePickerOpen(false);
  };

  const handleSwap = async () => {
    if (!from.trim() || !to.trim()) return;
    setSwapBusy(true);
    setSwapError("");
    try {
      const list = await routes.list(to.trim(), from.trim());
      if (!list.length) {
        setSwapError("No route the other way for these cities.");
        window.setTimeout(() => setSwapError(""), 4000);
        return;
      }
      router.push(
        buildSchedulesPath(String(list[0].id), date, to.trim(), from.trim())
      );
    } finally {
      setSwapBusy(false);
    }
  };

  const hint = journeyDayHint(date, todayIso, tomorrowIso);
  const busLine =
    schedulesLoading || busCount === null ? "Loading buses…" : `${busCount} buses`;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 -ml-2" asChild>
            <Link href="/" aria-label="Back to search">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground truncate">
              {from || "—"} <span className="font-normal text-muted-foreground">→</span>{" "}
              {to || "—"}
            </p>
            <p className="text-sm text-muted-foreground">{busLine}</p>
            {swapError ? (
              <p className="text-xs text-destructive mt-1">{swapError}</p>
            ) : null}
          </div>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground sm:text-right shrink-0">
          {from} to {to} Bus
        </p>
      </div>

      <div className="relative flex flex-col overflow-visible rounded-2xl border border-zinc-200/90 bg-card shadow-md ring-1 ring-zinc-950/[0.04] dark:border-zinc-800 dark:ring-white/[0.06] lg:flex-row lg:items-stretch">
        {/* From | swap on divider | To */}
        <div className="relative flex min-w-0 flex-1 flex-col border-b lg:flex-[2] lg:flex-row lg:items-stretch lg:border-b-0">
          <div className="flex flex-1 items-center gap-3 border-b px-4 py-3.5 lg:border-b-0 lg:border-r lg:pr-10">
            <Bus className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-semibold text-foreground truncate">{from || "—"}</p>
            </div>
          </div>

          <div className="relative z-10 flex justify-center py-2 lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:py-0">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-10 w-10 shrink-0 rounded-full border border-zinc-600 bg-zinc-700 text-white shadow-sm hover:bg-zinc-600 hover:text-white dark:border-zinc-500 dark:bg-zinc-700"
              disabled={swapBusy}
              onClick={() => void handleSwap()}
              aria-label="Swap from and to"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-1 items-center gap-3 border-b px-4 py-3.5 lg:border-b-0 lg:border-r lg:pl-10">
            <Bus className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">To</p>
              <p className="font-semibold text-foreground truncate">{to || "—"}</p>
            </div>
          </div>
        </div>

        {/* Date + pills */}
        <div
          className="relative flex flex-[1.15] min-w-0 flex-col justify-center gap-2 border-b px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3 lg:border-b-0 lg:border-r"
          ref={popoverRef}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:items-center"
            onClick={() => setDatePickerOpen((o) => !o)}
            aria-expanded={datePickerOpen}
            aria-haspopup="dialog"
          >
            <Calendar className="h-5 w-5 shrink-0 text-foreground mt-0.5 sm:mt-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Date of journey</p>
              <p className="font-semibold text-foreground">
                {formatJourneyDate(date)}
                {hint ? (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">{hint}</span>
                ) : null}
              </p>
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => navigateDate(todayIso)}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-full border border-zinc-200/90 bg-zinc-100 px-3 text-xs font-normal text-zinc-600",
                "transition-none hover:border-zinc-200/90 hover:bg-zinc-100 hover:text-zinc-600",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                date === todayIso &&
                  "border-primary/30 bg-primary/15 font-medium text-foreground ring-1 ring-primary/30 hover:border-primary/30 hover:bg-primary/15 hover:text-foreground"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => navigateDate(tomorrowIso)}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-full border border-rose-200/90 bg-rose-100 px-3 text-xs font-bold text-zinc-900",
                "transition-none hover:border-rose-200/90 hover:bg-rose-100 hover:text-zinc-900",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "dark:border-rose-900/60 dark:bg-rose-950/45 dark:text-rose-50 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/45 dark:hover:text-rose-50",
                date === tomorrowIso && "ring-2 ring-rose-300/70 dark:ring-rose-600/60"
              )}
            >
              Tomorrow
            </button>
          </div>

          {datePickerOpen ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 flex justify-center sm:left-auto sm:right-0 sm:justify-end">
              <SchedulesDateCalendar
                selectedIso={date}
                minIso={todayIso}
                onSelect={(iso) => navigateDate(iso)}
              />
            </div>
          ) : null}
        </div>

        {/* Search */}
        <div className="flex items-center justify-center p-2 lg:justify-stretch lg:p-2">
          <Button
            type="button"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-full"
            onClick={onSearch}
            aria-label="Search buses"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/** Star badge: green 4–5, yellow 3 up to (not including) 4, red under 3 */
function ratingBadgeClasses(avg: number) {
  if (avg >= 4) {
    /* Solid forest-green pill, white star + figures — matches typical 4★+ bus-app badges */
    return {
      wrap: "border-0 bg-green-900 text-white shadow-sm ring-1 ring-green-950/30 dark:bg-emerald-950 dark:ring-emerald-900/50",
      star: "fill-white text-white",
      sub: "text-white/90",
    };
  }
  if (avg >= 3) {
    /* Solid amber/orange pill — same pattern as green: white star + text */
    return {
      wrap: "border-0 bg-amber-600 text-white shadow-sm ring-1 ring-amber-800/35 dark:bg-amber-700 dark:ring-amber-900/40",
      star: "fill-white text-white",
      sub: "text-white/90",
    };
  }
  /* Solid red pill — same pattern */
  return {
    wrap: "border-0 bg-red-700 text-white shadow-sm ring-1 ring-red-900/35 dark:bg-red-900 dark:ring-red-950/50",
    star: "fill-white text-white",
    sub: "text-white/90",
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function duration(dep: string, arr: string) {
  const ms = new Date(arr).getTime() - new Date(dep).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function BusRatingBadge({ avg, count }: { avg: number; count: number }) {
  const tier = ratingBadgeClasses(avg);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
        tier.wrap
      )}
    >
      <Star className={cn("h-3.5 w-3.5", tier.star)} aria-hidden />
      {avg.toFixed(1)}
      <span className={cn("font-normal", tier.sub)}>({count})</span>
    </span>
  );
}

const amenityChipVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 420, damping: 26 },
  },
};

function AmenityChips({
  featureIds,
  featureLabel,
  cardIndex,
}: {
  featureIds: string[];
  featureLabel: (id: string) => string;
  cardIndex: number;
}) {
  const shown = featureIds.slice(0, 6);
  const rest = featureIds.length - shown.length;
  return (
    <motion.div
      className="flex flex-wrap gap-1.5"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.06,
            delayChildren: cardIndex * 0.035,
          },
        },
      }}
    >
      {shown.map((fid) => (
        <motion.span
          key={fid}
          variants={amenityChipVariants}
          whileHover={{
            y: -2,
            scale: 1.05,
            transition: { type: "spring", stiffness: 500, damping: 22 },
          }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "relative inline-flex cursor-default items-center overflow-hidden rounded-full border border-sky-300/70",
            "bg-gradient-to-br from-sky-50 via-white to-cyan-50/90 px-2.5 py-1",
            "text-[10px] font-semibold tracking-tight text-sky-950 shadow-sm",
            "ring-1 ring-sky-200/60 ring-offset-0",
            "transition-shadow duration-200 hover:border-primary/40 hover:shadow-md hover:ring-primary/25",
            "dark:border-sky-600/60 dark:from-sky-950/80 dark:via-sky-900/50 dark:to-cyan-950/40",
            "dark:text-sky-50 dark:ring-sky-700/50 dark:hover:border-primary/50"
          )}
        >
          <span className="relative z-10">{featureLabel(fid)}</span>
        </motion.span>
      ))}
      {rest > 0 ? (
        <motion.span
          variants={amenityChipVariants}
          className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/35 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground"
        >
          +{rest} more
        </motion.span>
      ) : null}
    </motion.div>
  );
}

export default function SchedulesPage() {
  const searchParams = useSearchParams();
  const routeId = searchParams.get("route_id");
  const date = searchParams.get("date");
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<ScheduleFilterState>(DEFAULT_FILTERS);
  const [featureCatalog, setFeatureCatalog] = useState(BUS_FEATURES_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    routes
      .busFeatures()
      .then((r) => {
        if (!cancelled && r.features?.length) setFeatureCatalog(r.features);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSchedules = useCallback(() => {
    if (!routeId || !date) {
      setError("Missing route or date.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    routes
      .schedules(Number(routeId), date)
      .then((s) => {
        setSchedules(s);
        if (s.length === 0) {
          setError(`No buses found for ${from} → ${to} on ${date}.`);
        }
        if (s.length > 0) {
          const b = computeFareBounds(s);
          setFilters({
            priceMin: b.min,
            priceMax: b.max,
            timeBuckets: new Set(),
            layoutKinds: new Set(),
            requiredFeatures: new Set(),
          });
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load schedules.");
      })
      .finally(() => setLoading(false));
  }, [routeId, date, from, to]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const filteredSchedules = useMemo(
    () => applyScheduleFilters(schedules, filters),
    [schedules, filters]
  );

  const featureLabel = (id: string) => featureCatalog.find((f) => f.id === id)?.label ?? id;

  const hasQuery = Boolean(routeId && date);

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-neutral-100 dark:bg-neutral-950">
      <div className="container mx-auto max-w-6xl px-4 py-6">
      {hasQuery && routeId && date ? (
        <SchedulesTripHeader
          routeId={routeId}
          date={date}
          from={from}
          to={to}
          busCount={loading ? null : schedules.length}
          schedulesLoading={loading}
          onSearch={loadSchedules}
        />
      ) : (
        <div className="mb-6 rounded-xl border border-zinc-200/90 bg-card p-6 text-center shadow-md ring-1 ring-zinc-950/[0.04] dark:border-zinc-800 dark:ring-white/[0.05]">
          <p className="text-muted-foreground mb-3">Add a route and date from the home search to see schedules.</p>
          <Button asChild variant="outline">
            <Link href="/">Back to search</Link>
          </Button>
        </div>
      )}

      {hasQuery && loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading buses…</div>
      ) : null}

      {hasQuery && !loading && (
        <>
      {error && schedules.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 mb-4 dark:bg-amber-950/30 dark:border-amber-900">
          <p className="text-amber-900 dark:text-amber-200 font-medium">Error</p>
          <p className="text-amber-800 dark:text-amber-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] gap-8 items-start">
        {schedules.length > 0 && (
          <div className="lg:sticky lg:top-4 lg:z-10 lg:self-start">
            <ScheduleFiltersPanel
              schedules={schedules}
              featureCatalog={featureCatalog}
              filters={filters}
              onChange={setFilters}
            />
          </div>
        )}

        <div className="space-y-4 min-w-0">
          {schedules.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing <strong className="text-foreground">{filteredSchedules.length}</strong> of{" "}
              {schedules.length} buses
            </p>
          )}

          <AnimatePresence mode="wait">
            {filteredSchedules.length === 0 && schedules.length > 0 ? (
              <motion.p
                key="no-match"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-dashed border-zinc-300/80 bg-card py-12 text-center text-muted-foreground shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40"
              >
                No buses match your filters. Try clearing filters or relaxing amenities.
              </motion.p>
            ) : filteredSchedules.length === 0 && !schedules.length ? (
              <motion.p
                key="empty"
                className="rounded-xl border border-zinc-200/80 bg-card py-12 text-center text-muted-foreground shadow-sm ring-1 ring-zinc-950/[0.04] dark:border-zinc-800 dark:bg-zinc-900/50 dark:ring-white/[0.05]"
              >
                No buses found for this date.
              </motion.p>
            ) : (
              filteredSchedules.map((s, i) => {
                const lk = s.bus.layout_kind || "mixed";
                const layoutLabel = LAYOUT_KIND_LABELS[lk] ?? lk;
                const feats = s.bus.features || [];
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="group relative overflow-hidden rounded-xl border border-zinc-200/95 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_16px_-4px_rgba(0,0,0,0.12),0_14px_36px_-8px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.04] transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-zinc-300/90 hover:bg-white hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_10px_24px_-4px_rgba(0,0,0,0.16),0_22px_48px_-10px_rgba(0,0,0,0.18)] dark:border-zinc-800 dark:bg-zinc-900/60 dark:ring-white/[0.06] dark:shadow-[0_4px_14px_-2px_rgba(0,0,0,0.5),0_12px_32px_-6px_rgba(0,0,0,0.45)] dark:hover:border-zinc-600 dark:hover:bg-zinc-900/60 dark:hover:shadow-[0_6px_18px_-2px_rgba(0,0,0,0.55),0_16px_40px_-8px_rgba(0,0,0,0.5)]">
                      {s.operator_promo_title ? (
                        <div
                          className="absolute right-0 top-0 z-10 max-w-[55%] rounded-bl-lg bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 py-1 text-[10px] font-bold leading-tight text-amber-950 shadow-sm sm:max-w-[45%] sm:text-[11px]"
                          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 8% 100%, 0 70%)" }}
                        >
                          {s.operator_promo_title}
                        </div>
                      ) : null}
                      <CardContent className="p-0">
                        <div className="p-4 sm:p-5 pr-2 sm:pr-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-2 pr-1">
                              <p className="font-semibold text-foreground flex flex-wrap items-center gap-1.5">
                                <span>{s.bus.operator_name || "Bus"}</span>
                                <span className="inline-flex items-center gap-0 text-primary" title="Tracked route">
                                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                                  <Bus className="h-3.5 w-3.5 -ml-0.5" aria-hidden />
                                </span>
                              </p>
                              {s.bus.service_name ? (
                                <p className="text-xs text-muted-foreground">{s.bus.service_name}</p>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium rounded-full bg-muted px-2.5 py-0.5">
                                  {layoutLabel}
                                </span>
                                {(s.bus.rating_count ?? 0) > 0 && s.bus.rating_avg != null ? (
                                  <BusRatingBadge
                                    avg={Number(s.bus.rating_avg)}
                                    count={s.bus.rating_count ?? 0}
                                  />
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-1 flex-col gap-1 sm:items-center sm:text-center lg:max-w-[200px]">
                              <p className="text-base font-bold tabular-nums tracking-tight text-foreground">
                                {formatTime(s.departure_dt)}{" "}
                                <span className="font-normal text-muted-foreground">—</span>{" "}
                                {formatTime(s.arrival_dt)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {duration(s.departure_dt, s.arrival_dt)} · {s.bus.capacity} seats
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 text-right lg:min-w-[120px]">
                              {s.fare_original &&
                              Number(s.fare_original) > Number(s.fare) ? (
                                <p className="text-xs text-muted-foreground line-through tabular-nums">
                                  ₹{s.fare_original}
                                </p>
                              ) : null}
                              <p className="text-lg font-bold tabular-nums text-foreground">₹{s.fare}</p>
                              <p className="text-xs text-muted-foreground">Onwards</p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-border px-4 py-3 sm:px-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0 space-y-2">
                              {feats.length > 0 && (
                                <AmenityChips
                                  featureIds={feats}
                                  featureLabel={featureLabel}
                                  cardIndex={i}
                                />
                              )}
                              {s.platform_promo_line ? (
                                <p className="inline-flex max-w-full rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-medium text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">
                                  {s.platform_promo_line}
                                </p>
                              ) : null}
                              {s.bus.extras_note ? (
                                <p className="text-xs text-muted-foreground italic line-clamp-2">
                                  {s.bus.extras_note}
                                </p>
                              ) : null}
                            </div>
                            <Button asChild className="shrink-0 w-full sm:w-auto">
                              <Link
                                href={`/book/select-seats?schedule_id=${s.id}&date=${date}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&fare=${s.fare}`}
                              >
                                View seats
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
        </>
      )}
      </div>
    </div>
  );
}
