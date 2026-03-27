"use client";

import { useMemo, type ReactNode } from "react";
import {
  Armchair,
  Bath,
  BedDouble,
  Bus,
  Clapperboard,
  Cookie,
  Droplets,
  IndianRupee,
  Lamp,
  LayoutGrid,
  MapPinned,
  Moon,
  PlugZap,
  Sheet,
  Snowflake,
  Sofa,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Wifi,
} from "lucide-react";
import type { Schedule, BusFeatureDef } from "@/lib/api";
import { LAYOUT_KIND_LABELS } from "@/lib/bus-features";
import { cn } from "@/lib/utils";

/** Lucide icons: crisp at any size, inherit `currentColor` for selected chips — preferable to PNG for dense UI */
const chipIcon = {
  size: 22,
  strokeWidth: 1.75,
  className: "shrink-0 opacity-90",
  "aria-hidden": true,
} as const;

const headingIcon = {
  size: 18,
  strokeWidth: 1.75,
  className: "shrink-0 opacity-80",
  "aria-hidden": true,
} as const;

function featureIcon(id: string): ReactNode {
  switch (id) {
    case "ac":
      return <Snowflake {...chipIcon} />;
    case "wifi":
      return <Wifi {...chipIcon} />;
    case "water":
      return <Droplets {...chipIcon} />;
    case "charging":
      return <PlugZap {...chipIcon} />;
    case "blanket":
      return <Sheet {...chipIcon} />;
    case "toilet":
      return <Bath {...chipIcon} />;
    case "entertainment":
      return <Clapperboard {...chipIcon} />;
    case "live_tracking":
      return <MapPinned {...chipIcon} />;
    case "reading_lamp":
      return <Lamp {...chipIcon} />;
    case "snacks":
      return <Cookie {...chipIcon} />;
    default:
      return <Sparkles {...chipIcon} />;
  }
}

function timeIcon(id: string): ReactNode {
  switch (id) {
    case "before10":
      return <Sunrise {...chipIcon} />;
    case "10to17":
      return <Sun {...chipIcon} />;
    case "17to23":
      return <Sunset {...chipIcon} />;
    case "after23":
      return <Moon {...chipIcon} />;
    default:
      return <Sun {...chipIcon} />;
  }
}

function layoutIcon(id: string): ReactNode {
  switch (id) {
    case "seater":
      return <Armchair {...chipIcon} />;
    case "sleeper":
      return <BedDouble {...chipIcon} />;
    case "semi":
      return <Sofa {...chipIcon} />;
    case "mixed":
      return <LayoutGrid {...chipIcon} />;
    default:
      return <Armchair {...chipIcon} />;
  }
}

export type ScheduleFilterState = {
  priceMin: number;
  priceMax: number;
  timeBuckets: Set<string>;
  layoutKinds: Set<string>;
  requiredFeatures: Set<string>;
};

export const DEFAULT_FILTERS: ScheduleFilterState = {
  priceMin: 0,
  priceMax: 100000,
  timeBuckets: new Set(),
  layoutKinds: new Set(),
  requiredFeatures: new Set(),
};

export function departureHourBucket(iso: string): string {
  const h = new Date(iso).getHours();
  if (h < 10) return "before10";
  if (h < 17) return "10to17";
  if (h < 23) return "17to23";
  return "after23";
}

const TIME_OPTIONS = [
  { id: "before10", label: "Before 10 AM" },
  { id: "10to17", label: "10 AM – 5 PM" },
  { id: "17to23", label: "5 PM – 11 PM" },
  { id: "after23", label: "After 11 PM" },
] as const;

const LAYOUT_OPTIONS = [
  { id: "seater", label: LAYOUT_KIND_LABELS.seater },
  { id: "sleeper", label: LAYOUT_KIND_LABELS.sleeper },
  { id: "semi", label: LAYOUT_KIND_LABELS.semi },
  { id: "mixed", label: LAYOUT_KIND_LABELS.mixed },
] as const;

/** Selected chip: primary blue, white text — matches default `Button` / board-drop CTA */
const chipSelected =
  "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-primary/30";
const chipIdle =
  "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5";

export function computeFareBounds(schedules: Schedule[]): { min: number; max: number } {
  if (schedules.length === 0) return { min: 0, max: 10000 };
  const fares = schedules.map((s) => Number(s.fare) || 0);
  return { min: Math.floor(Math.min(...fares)), max: Math.ceil(Math.max(...fares)) };
}

export function applyScheduleFilters(schedules: Schedule[], f: ScheduleFilterState): Schedule[] {
  return schedules.filter((s) => {
    const fare = Number(s.fare) || 0;
    if (fare < f.priceMin || fare > f.priceMax) return false;

    if (f.timeBuckets.size > 0) {
      const b = departureHourBucket(s.departure_dt);
      if (!f.timeBuckets.has(b)) return false;
    }

    const lk = s.bus.layout_kind || "mixed";
    if (f.layoutKinds.size > 0 && !f.layoutKinds.has(lk)) return false;

    if (f.requiredFeatures.size > 0) {
      const busFeats = new Set(s.bus.features || []);
      for (const req of f.requiredFeatures) {
        if (!busFeats.has(req)) return false;
      }
    }
    return true;
  });
}

type DualPriceRangeProps = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
};

function DualPriceRange({ min, max, valueMin, valueMax, onChangeMin, onChangeMax }: DualPriceRangeProps) {
  const span = Math.max(max - min, 1);
  const leftPct = ((valueMin - min) / span) * 100;
  const widthPct = ((valueMax - valueMin) / span) * 100;
  /* Max handle slightly above min so both stay draggable when thumbs meet */
  const minZ = 20;
  const maxZ = 25;

  return (
    <div className="relative h-10 w-full flex items-center touch-none">
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted" />
      <div
        className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0)}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={valueMin}
        aria-label="Minimum price"
        onChange={(e) => {
          const v = Number(e.target.value);
          onChangeMin(Math.min(v, valueMax));
        }}
        className={cn(
          "price-range-input pointer-events-none absolute left-0 right-0 top-1/2 w-full -translate-y-1/2 appearance-none bg-transparent p-0",
          /* Fixed height so the native track sits on the same line as our custom track */
          "h-8",
          "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
          /* Thumb taller than track: WebKit needs negative margin to center thumb on track */
          "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-primary/30",
          "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
          "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary",
          "[&::-moz-range-thumb]:shadow-md"
        )}
        style={{ zIndex: minZ }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={valueMax}
        aria-label="Maximum price"
        onChange={(e) => {
          const v = Number(e.target.value);
          onChangeMax(Math.max(v, valueMin));
        }}
        className={cn(
          "price-range-input pointer-events-none absolute left-0 right-0 top-1/2 w-full -translate-y-1/2 appearance-none bg-transparent p-0",
          "h-8",
          "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-primary/30",
          "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
          "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary",
          "[&::-moz-range-thumb]:shadow-md"
        )}
        style={{ zIndex: maxZ }}
      />
    </div>
  );
}

type Props = {
  schedules: Schedule[];
  featureCatalog: BusFeatureDef[];
  filters: ScheduleFilterState;
  onChange: (next: ScheduleFilterState) => void;
};

export function ScheduleFiltersPanel({ schedules, featureCatalog, filters, onChange }: Props) {
  const bounds = useMemo(() => computeFareBounds(schedules), [schedules]);

  const setFilters = (patch: Partial<ScheduleFilterState>) => {
    onChange({ ...filters, ...patch });
  };

  const toggleInSet = <T extends string>(
    key: "timeBuckets" | "layoutKinds" | "requiredFeatures",
    id: T,
    set: Set<T>
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFilters({ [key]: next } as Partial<ScheduleFilterState>);
  };

  const clearAll = () => {
    onChange({
      priceMin: bounds.min,
      priceMax: bounds.max,
      timeBuckets: new Set(),
      layoutKinds: new Set(),
      requiredFeatures: new Set(),
    });
  };

  const activeCount =
    filters.timeBuckets.size +
    filters.layoutKinds.size +
    filters.requiredFeatures.size +
    (schedules.length > 0 && (filters.priceMin > bounds.min || filters.priceMax < bounds.max) ? 1 : 0);

  const sameFare = bounds.min === bounds.max;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-primary/25 bg-card text-card-foreground",
        "shadow-[0_10px_50px_-14px_hsl(var(--primary)/0.22)] dark:border-primary/35 dark:shadow-[0_12px_50px_-12px_hsl(var(--primary)/0.35)]",
        "ring-1 ring-primary/15",
        "before:pointer-events-none before:absolute before:inset-y-3 before:left-0 before:z-10 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-primary before:to-primary/50"
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-primary/10 bg-gradient-to-r from-primary/[0.09] via-primary/[0.04] to-transparent px-4 py-3.5 pl-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner shadow-primary/10 ring-1 ring-primary/20"
            aria-hidden
          >
            <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Filters</h2>
            <p className="text-[10px] text-muted-foreground">Narrow by price, time & amenities</p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="shrink-0 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-0 divide-y divide-border/70 p-4 sm:p-5">
        {/* Price — single track, two handles */}
        <section className="pb-5 pt-0 first:pt-0">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <IndianRupee {...headingIcon} />
            Price range
          </h3>
          {sameFare ? (
            <p className="text-sm tabular-nums font-medium text-foreground">₹{bounds.min}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <DualPriceRange
                min={bounds.min}
                max={bounds.max}
                valueMin={filters.priceMin}
                valueMax={filters.priceMax}
                onChangeMin={(v) => setFilters({ priceMin: v })}
                onChangeMax={(v) => setFilters({ priceMax: v })}
              />
              <div className="flex justify-between text-xs font-medium text-foreground tabular-nums">
                <span>₹{filters.priceMin}</span>
                <span>₹{filters.priceMax}</span>
              </div>
            </div>
          )}
        </section>

        {/* Departure time */}
        <section className="py-5">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sun {...headingIcon} />
            Departure time
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleInSet("timeBuckets", t.id, filters.timeBuckets)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-[11px] font-semibold transition-all flex flex-col items-center justify-center gap-1.5 min-h-[64px] text-center leading-tight",
                  filters.timeBuckets.has(t.id) ? chipSelected : chipIdle
                )}
              >
                {timeIcon(t.id)}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Bus type */}
        <section className="py-5">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Bus {...headingIcon} />
            Bus type
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {LAYOUT_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleInSet("layoutKinds", t.id, filters.layoutKinds)}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1.5 min-h-[72px] text-center leading-tight",
                  filters.layoutKinds.has(t.id) ? chipSelected : chipIdle
                )}
              >
                {layoutIcon(t.id)}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Amenities — same selectable tile style as bus type */}
        <section className="pb-0 pt-5">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles {...headingIcon} />
            Amenities
          </h3>
          <p className="text-[10px] text-muted-foreground mb-2">
            Show buses that include <span className="font-medium text-foreground">all</span> selected
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {featureCatalog.map((feat) => {
              const on = filters.requiredFeatures.has(feat.id);
              return (
                <button
                  key={feat.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleInSet("requiredFeatures", feat.id, filters.requiredFeatures)}
                  className={cn(
                    "rounded-xl border px-2 py-2.5 text-[11px] font-semibold leading-snug transition-all min-h-[72px] flex flex-col items-center justify-center gap-1.5 text-center",
                    on ? chipSelected : chipIdle
                  )}
                >
                  {featureIcon(feat.id)}
                  <span>{feat.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {activeCount > 0 && (
          <div className="flex items-center justify-center pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/25">
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {activeCount}
              </span>
              active filter{activeCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
