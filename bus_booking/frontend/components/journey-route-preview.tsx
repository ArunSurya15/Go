"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import {
  controlPointForArc,
  haversineKm,
  projectLngLat,
  resolveCityPoint,
  sampleQuadBezier,
} from "@/lib/journey-route-geo";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface JourneyRoutePreviewProps {
  from: string;
  to: string;
  className?: string;
}

/** Schematic curve when we don't have coordinates for both cities. */
const SCHEMATIC = {
  x0: 14,
  y0: 36,
  x1: 86,
  y1: 36,
  cx: 50,
  cy: 14,
};

export function JourneyRoutePreview({ from, to, className }: JourneyRoutePreviewProps) {
  const reduceMotion = !!useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const gradId = `route-grad-${uid}`;

  const fromTrim = from?.trim() || "Start";
  const toTrim = to?.trim() || "End";

  const geo = useMemo(() => {
    const a = resolveCityPoint(fromTrim);
    const b = resolveCityPoint(toTrim);
    if (a && b) {
      const { x0, y0, x1, y1 } = projectLngLat(a, b);
      const [cx, cy] = controlPointForArc(x0, y0, x1, y1, 16);
      const pathD = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
      const samples = sampleQuadBezier(x0, y0, cx, cy, x1, y1, 28);
      const km = haversineKm(a, b);
      return { mode: "geo" as const, pathD, samples, km, x0, y0, x1, y1 };
    }
    const { x0, y0, x1, y1, cx, cy } = SCHEMATIC;
    const pathD = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
    const samples = sampleQuadBezier(x0, y0, cx, cy, x1, y1, 28);
    return { mode: "schematic" as const, pathD, samples, km: null as number | null, x0, y0, x1, y1 };
  }, [fromTrim, toTrim]);

  const busAnimate =
    reduceMotion || geo.samples.length < 2
      ? false
      : {
          cx: geo.samples.map((p) => p[0]),
          cy: geo.samples.map((p) => p[1]),
        };

  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-sm", className)}>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
          Your route
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal leading-snug">
          {geo.mode === "geo"
            ? "Approximate path between cities (illustration)."
            : "Route preview — add more cities in the app config for a geographic map."}
        </p>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <div className="rounded-lg bg-gradient-to-b from-sky-50/90 to-emerald-50/40 dark:from-sky-950/40 dark:to-emerald-950/20 border border-border/50 px-2 py-3">
          <svg
            viewBox="0 0 100 58"
            className="w-full h-auto max-h-[200px] text-foreground"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
              </linearGradient>
            </defs>
            {/* subtle grid */}
            {[20, 40, 60, 80].map((x) => (
              <line
                key={`v${x}`}
                x1={x}
                y1={8}
                x2={x}
                y2={52}
                className="stroke-border/40"
                strokeWidth={0.15}
              />
            ))}
            <motion.path
              d={geo.pathD}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={2.2}
              strokeLinecap="round"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0.6 }}
              animate={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 1 }}
              transition={{ pathLength: { duration: 1.2, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.4 } }}
            />
            {/* endpoints */}
            <g>
              <circle cx={geo.x0} cy={geo.y0} r={3.2} className="fill-primary" />
              <circle cx={geo.x0} cy={geo.y0} r={5} className="fill-none stroke-primary/40" strokeWidth={0.6} />
            </g>
            <g>
              <circle cx={geo.x1} cy={geo.y1} r={3.2} className="fill-emerald-600 dark:fill-emerald-400" />
              <circle
                cx={geo.x1}
                cy={geo.y1}
                r={5}
                className="fill-none stroke-emerald-600/40 dark:stroke-emerald-400/40"
                strokeWidth={0.6}
              />
            </g>
            {/* moving bus dot */}
            <motion.circle
              r={2.4}
              className="fill-amber-400 stroke-amber-900/30 dark:fill-amber-300 dark:stroke-amber-100/40"
              strokeWidth={0.35}
              initial={reduceMotion ? { cx: geo.x0, cy: geo.y0 } : { cx: geo.samples[0]?.[0], cy: geo.samples[0]?.[1] }}
              animate={busAnimate || { cx: geo.x0, cy: geo.y0 }}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 5.5, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }
              }
            />
          </svg>
          <div className="mt-2 space-y-1 px-1">
            <div className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="font-medium text-foreground leading-tight">{fromTrim}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden />
              <span className="font-medium text-foreground leading-tight">{toTrim}</span>
            </div>
            {geo.km != null && (
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50 mt-2">
                ~{geo.km} km straight-line distance (road distance may differ).
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
