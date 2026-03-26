"use client";

import { useMemo } from "react";
import type { Schedule, BusFeatureDef } from "@/lib/api";
import { LAYOUT_KIND_LABELS } from "@/lib/bus-features";
import { cn } from "@/lib/utils";

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
          "price-range-input pointer-events-none absolute h-10 w-full appearance-none bg-transparent p-0",
          "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-primary/30",
          "[&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent",
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
          "price-range-input pointer-events-none absolute h-10 w-full appearance-none bg-transparent p-0",
          "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-primary/30",
          "[&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent",
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
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-5 p-4">
        {/* Price — single track, two handles */}
        <section>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Price range</h3>
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
        <section>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Departure time</h3>
          <div className="grid grid-cols-2 gap-2">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleInSet("timeBuckets", t.id, filters.timeBuckets)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-left text-[11px] font-semibold transition-all",
                  filters.timeBuckets.has(t.id) ? chipSelected : chipIdle
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Bus type */}
        <section>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Bus type</h3>
          <div className="grid grid-cols-2 gap-2">
            {LAYOUT_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleInSet("layoutKinds", t.id, filters.layoutKinds)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all text-center min-h-[44px] flex items-center justify-center",
                  filters.layoutKinds.has(t.id) ? chipSelected : chipIdle
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Amenities — same selectable tile style as bus type */}
        <section>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Amenities</h3>
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
                    "rounded-xl border px-2.5 py-2.5 text-left text-[11px] font-semibold leading-snug transition-all min-h-[44px] flex items-center justify-center text-center",
                    on ? chipSelected : chipIdle
                  )}
                >
                  {feat.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeCount > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} active
          </p>
        )}
      </div>
    </div>
  );
}
