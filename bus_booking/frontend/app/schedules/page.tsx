"use client";

import { useEffect, useState, useMemo } from "react";
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function duration(dep: string, arr: string) {
  const ms = new Date(arr).getTime() - new Date(dep).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function SchedulesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
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

  useEffect(() => {
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

  const filteredSchedules = useMemo(
    () => applyScheduleFilters(schedules, filters),
    [schedules, filters]
  );

  const featureLabel = (id: string) => featureCatalog.find((f) => f.id === id)?.label ?? id;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Loading buses…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-card rounded-lg border"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">From</span>
          <span className="font-semibold">{from || "—"}</span>
        </div>
        <span className="text-muted-foreground">→</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">To</span>
          <span className="font-semibold">{to || "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm ml-auto">
          <span className="text-muted-foreground">Date</span>
          <span className="font-medium">{date}</span>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push("/")}>
          Change search
        </Button>
      </motion.div>

      {error && schedules.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 mb-4 dark:bg-amber-950/30 dark:border-amber-900">
          <p className="text-amber-900 dark:text-amber-200 font-medium">Error</p>
          <p className="text-amber-800 dark:text-amber-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        {schedules.length > 0 && (
          <div className="lg:sticky lg:top-4 lg:self-start">
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
                className="text-muted-foreground text-center py-12 rounded-lg border border-dashed"
              >
                No buses match your filters. Try clearing filters or relaxing amenities.
              </motion.p>
            ) : filteredSchedules.length === 0 && !schedules.length ? (
              <motion.p key="empty" className="text-muted-foreground text-center py-12">
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
                    <Card className="group overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_14px_40px_-10px_hsl(var(--primary)/0.2)] hover:bg-primary/[0.03] dark:hover:bg-primary/[0.07] dark:hover:shadow-[0_14px_40px_-10px_hsl(var(--primary)/0.25)]">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4 sm:p-5">
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="font-semibold text-foreground">
                              {s.bus.operator_name || "Bus"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium rounded-full bg-muted px-2.5 py-0.5">
                                {layoutLabel}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {s.bus.capacity} seats · {s.bus.registration_no}
                              </span>
                            </div>
                            {feats.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {feats.slice(0, 6).map((fid) => (
                                  <span
                                    key={fid}
                                    className="text-[10px] rounded-md border border-border bg-background px-1.5 py-0.5 text-muted-foreground"
                                  >
                                    {featureLabel(fid)}
                                  </span>
                                ))}
                                {feats.length > 6 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{feats.length - 6} more
                                  </span>
                                )}
                              </div>
                            )}
                            {s.bus.extras_note && (
                              <p className="text-xs text-muted-foreground italic line-clamp-2">
                                {s.bus.extras_note}
                              </p>
                            )}
                            <div className="flex flex-wrap items-baseline gap-2 text-sm pt-1">
                              <span className="font-mono font-medium">{formatTime(s.departure_dt)}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-mono font-medium">{formatTime(s.arrival_dt)}</span>
                              <span className="text-muted-foreground text-xs">
                                {duration(s.departure_dt, s.arrival_dt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex sm:flex-col sm:items-end justify-between sm:justify-center gap-3">
                            <div className="text-right">
                              <p className="text-xl font-bold text-foreground">₹{s.fare}</p>
                              <p className="text-xs text-muted-foreground">Onwards</p>
                            </div>
                            <Button asChild className="shrink-0">
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
    </div>
  );
}
