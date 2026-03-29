"use client";

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { MapPin } from "lucide-react";
import {
  chainHaversineKm,
  controlPointForArc,
  polylinePathD,
  projectLngLat,
  resolveCityPoint,
  resolveStopChainDetailed,
  projectLngLatChain,
  ROUTE_MAP_INNER,
  ROUTE_SVG,
  routeLayoutForStopCount,
  samplePolyline,
  sampleQuadBezier,
  screenMarkersAlongRoute,
  type RouteMapInner,
  type RouteStopInput,
} from "@/lib/journey-route-geo";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface JourneyRoutePreviewProps {
  from: string;
  to: string;
  /** Ordered stops from schedule route pattern (API). */
  routeStops?: RouteStopInput[] | null;
  routePatternName?: string | null;
  className?: string;
}

type MarkerRole = "start" | "via" | "end";

type MapMarker = { x: number; y: number; name: string; role: MarkerRole };

const SCHEMATIC = {
  x0: 22,
  y0: 54,
  x1: 138,
  y1: 54,
  cx: 80,
  cy: 22,
};

function mapPadForInner(inner: RouteMapInner, vbH: number) {
  return {
    xMin: inner.xMin + 2,
    xMax: inner.xMax - 2,
    yMin: Math.max(8, inner.yMin - 8),
    yMax: Math.min(vbH - 6, inner.yMax + 4),
  };
}

const DEFAULT_MAP_PAD = mapPadForInner(ROUTE_MAP_INNER, ROUTE_SVG.vbH);

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function norm2(dx: number, dy: number): { tx: number; ty: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { tx: dx / len, ty: dy / len };
}

/** Heading in degrees for each sample (bus front faces +x in local space). */
function computeBusHeadings(pts: [number, number][]): number[] {
  const n = pts.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let dx: number;
    let dy: number;
    if (i < n - 1) {
      dx = pts[i + 1][0] - pts[i][0];
      dy = pts[i + 1][1] - pts[i][1];
    } else {
      dx = pts[i][0] - pts[i - 1][0];
      dy = pts[i][1] - pts[i - 1][1];
    }
    if (dx === 0 && dy === 0 && i > 0) {
      dx = pts[i][0] - pts[i - 1][0];
      dy = pts[i][1] - pts[i - 1][1];
    }
    out.push((Math.atan2(dy, dx) * 180) / Math.PI);
  }
  return out;
}

function pointAlongPolyline(pts: [number, number][], t: number): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  const n = pts.length;
  const target = Math.max(0, Math.min(1, t)) * (n - 1);
  const i = Math.min(Math.floor(target), n - 2);
  const u = target - i;
  return [
    pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u,
    pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u,
  ];
}

function headingAlongPolyline(pts: [number, number][], t: number): number {
  if (pts.length < 2) return 0;
  const n = pts.length;
  const target = Math.max(0, Math.min(1, t)) * (n - 1);
  const i = Math.min(Math.floor(target), n - 2);
  const dx = pts[i + 1][0] - pts[i][0];
  const dy = pts[i + 1][1] - pts[i][1];
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function RouteWindStreaks({ active }: { active: boolean }) {
  if (!active) return null;
  const streaks = [
    { d: "M 3.4 -0.55 Q 5.2 -0.35 7.1 -0.75", delay: 0 },
    { d: "M 3.6 0.15 Q 5.5 0.45 7.4 0.05", delay: 0.07 },
    { d: "M 3.35 0.75 Q 5.4 0.95 7.2 0.55", delay: 0.14 },
    { d: "M 4 -1.05 Q 6 -0.85 7.8 -1.2", delay: 0.1 },
  ];
  return (
    <g className="text-sky-500/[0.75] dark:text-sky-300/60" aria-hidden>
      {streaks.map((s, i) => (
        <motion.path
          key={i}
          d={s.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.2}
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: [0.18, 0.7, 0.18] }}
          transition={{
            duration: 0.42 + i * 0.04,
            repeat: Infinity,
            ease: "easeInOut",
            delay: s.delay,
          }}
        />
      ))}
    </g>
  );
}

function RouteBusWheel({ cx, cy, spin }: { cx: number; cy: number; spin: boolean }) {
  return (
    <g transform={`translate(${cx},${cy})`}>
      <motion.g
        animate={spin ? { rotate: [0, 360] } : { rotate: 0 }}
        transition={
          spin
            ? { duration: 0.48, repeat: Infinity, ease: "linear" }
            : { duration: 0 }
        }
      >
        <circle
          r={0.52}
          className="fill-slate-800 stroke-slate-500 dark:fill-slate-950 dark:stroke-slate-600"
          strokeWidth={0.12}
        />
        <line
          x1={-0.34}
          y1={0}
          x2={0.34}
          y2={0}
          className="stroke-slate-200 dark:stroke-slate-400"
          strokeWidth={0.1}
          strokeLinecap="round"
        />
        <line
          x1={0}
          y1={-0.34}
          x2={0}
          y2={0.34}
          className="stroke-slate-200 dark:stroke-slate-400"
          strokeWidth={0.1}
          strokeLinecap="round"
        />
      </motion.g>
    </g>
  );
}

/**
 * Small bus icon: moves along samples, wind behind (+x), wheels spin when moving.
 */
function AnimatedRouteBus({
  samples,
  reduceMotion,
  moving,
  fallbackX,
  fallbackY,
}: {
  samples: [number, number][];
  reduceMotion: boolean;
  moving: boolean;
  fallbackX: number;
  fallbackY: number;
}) {
  const gRef = useRef<SVGGElement>(null);
  const progress = useMotionValue(0);
  const samplesRef = useRef(samples);
  const movingRef = useRef(moving);
  const reduceMotionRef = useRef(reduceMotion);
  samplesRef.current = samples;
  movingRef.current = moving;
  reduceMotionRef.current = reduceMotion;

  const spinWheels = moving && !reduceMotion && samples.length >= 2;
  const showWind = spinWheels;

  const applyTransform = useCallback(
    (t: number) => {
      const el = gRef.current;
      if (!el) return;
      const pts = samplesRef.current;
      if (pts.length < 2) {
        if (pts.length === 0) {
          el.setAttribute("transform", `translate(${fallbackX},${fallbackY}) rotate(0)`);
        } else {
          const r = computeBusHeadings(pts)[0] ?? 0;
          el.setAttribute("transform", `translate(${pts[0][0]},${pts[0][1]}) rotate(${r})`);
        }
        return;
      }
      const [x, y] = pointAlongPolyline(pts, t);
      const rot = headingAlongPolyline(pts, t);
      el.setAttribute("transform", `translate(${x},${y}) rotate(${rot})`);
    },
    [fallbackX, fallbackY]
  );

  useEffect(() => {
    applyTransform(0);
  }, [samples, applyTransform]);

  useEffect(() => {
    if (reduceMotion || !moving || samples.length < 2) {
      progress.set(0);
      applyTransform(0);
      return;
    }
    progress.set(0);
    applyTransform(0);
    const controls = animate(progress, 1, {
      duration: 5.5,
      repeat: Infinity,
      ease: "linear",
      repeatDelay: 0.6,
    });
    return () => controls.stop();
  }, [reduceMotion, moving, samples, applyTransform, progress]);

  useMotionValueEvent(progress, "change", (t) => {
    if (reduceMotionRef.current || !movingRef.current || samplesRef.current.length < 2) return;
    const el = gRef.current;
    if (!el) return;
    const pts = samplesRef.current;
    const [x, y] = pointAlongPolyline(pts, t);
    const rot = headingAlongPolyline(pts, t);
    el.setAttribute("transform", `translate(${x},${y}) rotate(${rot})`);
  });

  return (
    <g ref={gRef}>
      <RouteWindStreaks active={showWind} />
      <path
        d="M -3.35 1.32 L -3.35 -0.82 Q -3.35 -1.32 -2.75 -1.32 L 1.95 -1.32 Q 3.05 -1.32 3.35 -0.55 L 3.42 0.82 Q 3.42 1.32 2.85 1.32 L -2.85 1.32 Q -3.42 1.32 -3.35 1.32 Z"
        className="fill-amber-400 stroke-amber-900/50 dark:fill-amber-300 dark:stroke-amber-200/40"
        strokeWidth={0.28}
        strokeLinejoin="round"
      />
      <path
        d="M 1.35 -1.22 L 2.95 -1.05 L 2.88 0.55 L 1.25 0.48 Z"
        className="fill-sky-200/90 stroke-sky-600/40 dark:fill-sky-400/25 dark:stroke-sky-300/35"
        strokeWidth={0.1}
      />
      <RouteBusWheel cx={-1.55} cy={1.28} spin={spinWheels} />
      <RouteBusWheel cx={1.38} cy={1.28} spin={spinWheels} />
    </g>
  );
}

/**
 * Teardrop map pin (source / destination). Local (0,0) is the tip — aligns with the route endpoint.
 */
function MapEndpointPin({
  x,
  y,
  variant,
}: {
  x: number;
  y: number;
  variant: "start" | "end";
}) {
  const isStart = variant === "start";
  const fill = isStart ? "#ef4444" : "#22c55e";
  const stroke = isStart ? "#991b1b" : "#166534";
  return (
    <g transform={`translate(${x},${y})`}>
      <path
        d="M0,0 C-1.2,0 -2.15,-0.78 -2.9,-2.4 C-3.9,-4.85 -3.48,-8.15 0,-9.2 C3.48,-8.15 3.9,-4.85 2.9,-2.4 C2.15,-0.78 1.2,0 0,0 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={0.42}
        strokeLinejoin="round"
        paintOrder="stroke fill"
      />
      <circle cx={0} cy={-5.25} r={2.05} fill="#ffffff" stroke={stroke} strokeWidth={0.22} />
    </g>
  );
}

type MarkerDraw = MapMarker & {
  key: string;
  labelX: number;
  labelY: number;
  labelText: string;
  fontPx: number;
};

type LabelLayoutCtx = {
  mapPad: { xMin: number; xMax: number; yMin: number; yMax: number };
  vbW: number;
  vbH: number;
  stopCount: number;
};

function buildMarkerDraw(
  markers: MapMarker[],
  fromLabel: string,
  toLabel: string,
  ctx: LabelLayoutCtx
): MarkerDraw[] {
  const { mapPad: P, vbW, vbH, stopCount } = ctx;
  const xFlip = vbW * (118 / 160);
  const yFlip = vbH * (52 / 88);
  const xNudge = vbW * (124 / 160);
  let viaIdx = 0;
  const viaFont = stopCount > 11 ? 4.35 : stopCount > 8 ? 4.55 : 4.85;
  const viaDist = stopCount > 10 ? 9 : 10;

  return markers.map((m, i) => {
    const key = `${m.role}-${i}-${m.name.slice(0, 8)}`;
    let labelX = m.x;
    let labelY = m.y;
    let labelText = m.name;
    let fontPx = 5.2;

    if (m.role === "via") {
      const prev = markers[i - 1] ?? m;
      const next = markers[i + 1] ?? m;
      const { tx, ty } = norm2(next.x - prev.x, next.y - prev.y);
      const nx = -ty;
      const ny = tx;
      const side = viaIdx % 2 === 0 ? 1 : -1;
      viaIdx += 1;
      labelX = clamp(m.x + nx * side * viaDist, P.xMin, P.xMax);
      labelY = clamp(m.y + ny * side * viaDist, P.yMin, P.yMax);
      labelText = m.name.trim() || "Via";
      fontPx = viaFont;
    } else if (m.role === "start") {
      labelText = fromLabel.trim() || "Start";
      labelX = clamp(m.x, P.xMin + 6, P.xMax - 6);
      labelY = clamp(m.y + 9, P.yMin + 4, P.yMax);
      if (labelY > P.yMax - 2) {
        labelY = clamp(m.y - 9, P.yMin, P.yMax - 3);
      }
    } else {
      const prev = markers[i - 1];
      const distPrev = prev ? Math.hypot(m.x - prev.x, m.y - prev.y) : Infinity;
      const tightToPrev = distPrev < 24 * (vbW / 160);

      labelText = toLabel.trim() || "End";
      labelX = clamp(m.x, P.xMin + 4, P.xMax - 8);

      if (tightToPrev && prev) {
        const legDx = m.x - prev.x;
        const sideways = legDx >= -2 ? 11 : -11;
        labelX = clamp(m.x + sideways, P.xMin + 4, P.xMax - 8);
        labelY = clamp(m.y + 15, P.yMin + 4, P.yMax - 1);
      } else {
        labelY = clamp(m.y + 9, P.yMin + 4, P.yMax);
        if (m.x > xFlip || m.y > yFlip) {
          labelY = clamp(m.y - 9, P.yMin + 3, P.yMax - 2);
        }
        if (labelY > P.yMax - 2) {
          labelY = clamp(m.y - 9, P.yMin, P.yMax - 3);
        }
        if (m.x > xNudge) {
          labelX = clamp(m.x - 9, P.xMin + 4, P.xMax - 4);
        }
      }
    }

    return { ...m, key, labelX, labelY, labelText, fontPx };
  });
}

export function JourneyRoutePreview({
  from,
  to,
  routeStops,
  routePatternName,
  className,
}: JourneyRoutePreviewProps) {
  const reduceMotion = !!useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const gradId = `route-grad-${uid}`;

  const fromTrim = from?.trim() || "Start";
  const toTrim = to?.trim() || "End";

  const geo = useMemo(() => {
    const stops = routeStops?.length
      ? [...routeStops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [];

    const viaNamesFromPattern =
      stops.length >= 3
        ? stops
            .slice(1, -1)
            .map((s) => s.name.trim())
            .filter(Boolean)
        : [];

    const detailed = stops.length >= 2 ? resolveStopChainDetailed(stops) : [];

    if (detailed.length >= 2) {
      const layout = routeLayoutForStopCount(detailed.length);
      const chain = detailed.map((d) => ({ lat: d.lat, lng: d.lng }));
      let xyGeo = projectLngLatChain(chain, layout.chainPad, layout.inner);
      const lastIdx = xyGeo.length - 1;
      if (lastIdx >= 0) {
        const extraStops = Math.max(0, detailed.length - 4);
        const endDropY = 5 + Math.min(4, extraStops * 0.45);
        const ny = clamp(
          xyGeo[lastIdx][1] + endDropY,
          layout.inner.yMin + 2,
          layout.inner.yMax - 2
        );
        xyGeo = xyGeo.map((p, i) =>
          i === lastIdx ? ([p[0], ny] as [number, number]) : p
        );
      }
      const fallbackCenter: [number, number] = [
        (layout.inner.xMin + layout.inner.xMax) / 2,
        (layout.inner.yMin + layout.inner.yMax) / 2,
      ];
      const xyMarkers = screenMarkersAlongRoute(chain, xyGeo, fallbackCenter);
      const pathD = polylinePathD(xyGeo);
      const stepsPerSeg =
        detailed.length > 12 ? 12 : detailed.length > 8 ? 11 : 10;
      const samples = samplePolyline(xyGeo, stepsPerSeg);
      const km = chainHaversineKm(chain);
      const markerLayout: MapMarker[] = detailed.map((d, i) => ({
        x: xyMarkers[i][0],
        y: xyMarkers[i][1],
        name: d.name,
        role: i === 0 ? "start" : i === detailed.length - 1 ? "end" : "via",
      }));
      return {
        mode: "multi" as const,
        pathD,
        samples,
        km,
        markerLayout,
        viaNamesFromPattern,
        vbW: layout.vbW,
        vbH: layout.vbH,
        mapPad: mapPadForInner(layout.inner, layout.vbH),
        stopCount: detailed.length,
      };
    }

    const a = resolveCityPoint(fromTrim);
    const b = resolveCityPoint(toTrim);
    if (a && b) {
      const { x0, y0, x1, y1 } = projectLngLat(a, b);
      const [cx, cy] = controlPointForArc(x0, y0, x1, y1, 26);
      const pathD = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
      const samples = sampleQuadBezier(x0, y0, cx, cy, x1, y1, 28);
      const km = chainHaversineKm([a, b]);
      const markerLayout: MapMarker[] = [
        { x: x0, y: y0, name: fromTrim, role: "start" },
        { x: x1, y: y1, name: toTrim, role: "end" },
      ];
      return {
        mode: "geo" as const,
        pathD,
        samples,
        km,
        markerLayout,
        viaNamesFromPattern: [] as string[],
        vbW: ROUTE_SVG.vbW,
        vbH: ROUTE_SVG.vbH,
        mapPad: DEFAULT_MAP_PAD,
        stopCount: 2,
      };
    }
    const { x0, y0, x1, y1, cx, cy } = SCHEMATIC;
    const pathD = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
    const samples = sampleQuadBezier(x0, y0, cx, cy, x1, y1, 36);
    const markerLayout: MapMarker[] = [
      { x: x0, y: y0, name: fromTrim, role: "start" },
      { x: x1, y: y1, name: toTrim, role: "end" },
    ];
    return {
      mode: "schematic" as const,
      pathD,
      samples,
      km: null as number | null,
      markerLayout,
      viaNamesFromPattern: [] as string[],
      vbW: ROUTE_SVG.vbW,
      vbH: ROUTE_SVG.vbH,
      mapPad: DEFAULT_MAP_PAD,
      stopCount: 2,
    };
  }, [fromTrim, toTrim, routeStops]);

  const startM = geo.markerLayout[0];

  const markerDraw = useMemo(
    () =>
      buildMarkerDraw(geo.markerLayout, fromTrim, toTrim, {
        mapPad: geo.mapPad,
        vbW: geo.vbW,
        vbH: geo.vbH,
        stopCount: geo.stopCount,
      }),
    [geo.markerLayout, geo.mapPad, geo.vbW, geo.vbH, geo.stopCount, fromTrim, toTrim]
  );

  const busAnimate =
    reduceMotion || geo.samples.length < 2
      ? false
      : {
          cx: geo.samples.map((p) => p[0]),
          cy: geo.samples.map((p) => p[1]),
        };

  const subtitle =
    geo.mode === "multi"
      ? routePatternName
        ? `Pattern: ${routePatternName}. Stops are placed in journey order along the path (illustration).`
        : "Stops are placed in journey order along the path (illustration)."
      : geo.mode === "geo"
        ? "Approximate path between cities (illustration)."
        : "Route preview — add more cities in the app config for a geographic map.";

  const viaLine =
    geo.viaNamesFromPattern.length > 0
      ? geo.viaNamesFromPattern.join(" · ")
      : geo.markerLayout.filter((m) => m.role === "via").length > 0
        ? geo.markerLayout
            .filter((m) => m.role === "via")
            .map((m) => m.name)
            .join(" · ")
        : null;

  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-sm", className)}>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
          Your route
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal leading-snug">{subtitle}</p>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <div className="rounded-lg bg-gradient-to-b from-sky-50/90 to-emerald-50/40 dark:from-sky-950/40 dark:to-emerald-950/20 border border-border/50 px-2 py-3">
          <svg
            viewBox={`0 0 ${geo.vbW} ${geo.vbH}`}
            className={cn(
              "w-full h-auto text-foreground",
              geo.stopCount > 9
                ? "max-h-[380px]"
                : geo.stopCount > 6
                  ? "max-h-[320px]"
                  : "max-h-[280px]"
            )}
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
              </linearGradient>
            </defs>
            {[1, 2, 3, 4].map((k) => {
              const x = Math.round((geo.vbW * k) / 5);
              const y0 = Math.round(geo.vbH * 0.16);
              const y1 = Math.round(geo.vbH * 0.84);
              return (
                <line
                  key={`v${k}`}
                  x1={x}
                  y1={y0}
                  x2={x}
                  y2={y1}
                  className="stroke-border/40"
                  strokeWidth={geo.vbW > 200 ? 0.18 : 0.2}
                />
              );
            })}
            <motion.path
              d={geo.pathD}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={
                geo.mode === "multi"
                  ? geo.stopCount > 10
                    ? 1.65
                    : 1.9
                  : 2.2
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0.6 }}
              animate={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 1 }}
              transition={{ pathLength: { duration: 1.2, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.4 } }}
            />

            {markerDraw.map((d) =>
              d.role === "via" ? (
                <circle
                  key={d.key}
                  cx={d.x}
                  cy={d.y}
                  r={2.6}
                  className="fill-sky-500 stroke-white dark:stroke-slate-900"
                  strokeWidth={0.45}
                />
              ) : null
            )}

            <AnimatedRouteBus
              samples={geo.samples as [number, number][]}
              reduceMotion={reduceMotion}
              moving={!!busAnimate}
              fallbackX={startM.x}
              fallbackY={startM.y}
            />

            {markerDraw.map((d) =>
              d.role === "start" ? (
                <MapEndpointPin key={d.key} x={d.x} y={d.y} variant="start" />
              ) : d.role === "end" ? (
                <MapEndpointPin key={d.key} x={d.x} y={d.y} variant="end" />
              ) : null
            )}

            {markerDraw.map((d) => {
              const halo = {
                paintOrder: "stroke fill" as const,
                stroke: "rgba(255,255,255,0.92)",
                strokeWidth: 0.45,
              };
              if (d.role === "via") {
                return (
                  <text
                    key={`${d.key}-lbl`}
                    x={d.labelX}
                    y={d.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-slate-800 dark:fill-slate-100"
                    style={{ fontSize: `${d.fontPx}px`, fontWeight: 600, ...halo }}
                  >
                    {d.labelText}
                  </text>
                );
              }
              if (d.role === "start") {
                return (
                  <text
                    key={`${d.key}-lbl`}
                    x={d.labelX}
                    y={d.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-red-700 dark:fill-red-400"
                    style={{ fontSize: `${d.fontPx}px`, fontWeight: 700, ...halo }}
                  >
                    {d.labelText}
                  </text>
                );
              }
              return (
                <text
                  key={`${d.key}-lbl`}
                  x={d.labelX}
                  y={d.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-emerald-700 dark:fill-emerald-300"
                  style={{ fontSize: `${d.fontPx}px`, fontWeight: 700, ...halo }}
                >
                  {d.labelText}
                </text>
              );
            })}
          </svg>

          <div className="mt-3 space-y-2.5 px-1 text-xs border-t border-border/40 pt-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </p>
              <p className="font-semibold text-foreground leading-snug mt-0.5">{fromTrim}</p>
            </div>
            {viaLine && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Via
                </p>
                <p className="text-foreground leading-snug mt-0.5">{viaLine}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                To
              </p>
              <p className="font-semibold text-foreground leading-snug mt-0.5">{toTrim}</p>
            </div>
            <p className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 pt-1">
              <span>
                <span className="font-semibold text-red-600 dark:text-red-400">●</span> from
              </span>
              {geo.markerLayout.some((m) => m.role === "via") && (
                <span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">●</span> via
                </span>
              )}
              <span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">●</span> to
              </span>
            </p>
            {geo.km != null && (
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                ~{geo.km} km straight-line along shown points (road distance may differ).
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
