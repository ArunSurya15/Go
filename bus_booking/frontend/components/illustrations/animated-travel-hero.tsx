"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getTravelHeroBusVariant } from "@/components/illustrations/travel-hero-bus-config";
import { EgoPremiumBus } from "@/components/illustrations/travel-hero-bus-vector";

/** Raster hero art — default; use `NEXT_PUBLIC_TRAVEL_HERO_BUS=vector` for SVG coach. */
const HERO_BUS_SRC = "/hero-e-go-bus.png";

const TITLE_WORDS = ["Where", "to", "next?"];

type TravelHeroScopeValue = { uid: string; reduceMotion: boolean };

const TravelHeroContext = createContext<TravelHeroScopeValue | null>(null);

/** Use inside `<TravelHeroScope>` when building a custom layout. */
export function useTravelHeroScope(): TravelHeroScopeValue {
  const v = useContext(TravelHeroContext);
  if (!v) {
    throw new Error("Travel hero pieces must be used inside <TravelHeroScope>.");
  }
  return v;
}

/** Provides stable `uid` + `reduceMotion` for SVG ids and motion. */
export function TravelHeroScope({ children }: { children: ReactNode }) {
  const reduceMotion = !!useReducedMotion();
  const uid = useId().replace(/:/g, "");
  return (
    <TravelHeroContext.Provider value={{ uid, reduceMotion }}>
      {children}
    </TravelHeroContext.Provider>
  );
}

const GROUND_STRIP =
  "pointer-events-none absolute inset-x-0 bottom-0 h-[min(38%,140px)] min-h-[100px] sm:h-[min(40%,160px)] sm:min-h-[120px] dark:opacity-90 dark:brightness-[0.7] dark:saturate-[0.85]";

const titleContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
};

const titleWord = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const HERO_WIND_STREAK_TONES = [
  "from-transparent via-white to-transparent shadow-[0_0_8px_rgba(255,255,255,0.5)] dark:via-zinc-100 dark:shadow-[0_0_7px_rgba(255,255,255,0.2)]",
  "from-transparent via-zinc-200 to-transparent shadow-[0_0_6px_rgba(228,228,231,0.55)] dark:via-zinc-400 dark:shadow-[0_0_5px_rgba(161,161,170,0.35)]",
  "from-zinc-300/30 via-white/95 to-zinc-400/25 shadow-[0_0_7px_rgba(255,255,255,0.45)] dark:from-zinc-500/20 dark:via-zinc-300 dark:to-zinc-500/15 dark:shadow-[0_0_6px_rgba(212,212,216,0.25)]",
  "from-transparent via-zinc-400 to-transparent shadow-[0_0_5px_rgba(161,161,170,0.45)] dark:via-zinc-500 dark:shadow-[0_0_4px_rgba(113,113,122,0.4)]",
] as const;

/** Trailing speed lines while the hero bus cruises (PNG + vector) — white / grey mix. */
function HeroCruiseSpeedWind({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute -left-1 top-1/2 z-[1] flex h-[78%] w-[min(38%,6.25rem)] -translate-y-1/2 flex-col justify-center gap-1 sm:gap-1.5 sm:w-[min(40%,6.75rem)]"
      aria-hidden
    >
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <motion.div
          key={i}
          className={cn(
            "h-[2.5px] rounded-full bg-gradient-to-r sm:h-[3px]",
            HERO_WIND_STREAK_TONES[i % HERO_WIND_STREAK_TONES.length]
          )}
          style={{ width: `${52 + i * 7}%`, marginLeft: i * 1.25 }}
          animate={{
            opacity: [0.32, 0.98, 0.32],
            scaleX: [0.5, 1, 0.5],
            x: [0, -8, 0],
          }}
          transition={{
            duration: 0.36 + i * 0.03,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.045,
          }}
        />
      ))}
    </div>
  );
}

/** Raster hero bus — swap `HERO_BUS_SRC` / file in `public/` for new art. */
function TravelHeroBusImage({
  reduceMotion,
  cruise = false,
  className,
}: {
  reduceMotion: boolean;
  cruise?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("relative w-full", className)}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.08 }}
    >
      <motion.div
        animate={
          reduceMotion
            ? false
            : cruise
              ? { y: [0, -2, 0] }
              : { y: [0, -2.5, 0], x: [0, 1.5, 0] }
        }
        transition={
          reduceMotion ? undefined : { duration: cruise ? 2.2 : 2.6, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <div className="relative">
          <Image
            src={HERO_BUS_SRC}
            alt="E Go electric bus"
            width={640}
            height={360}
            className="relative z-[2] h-auto w-full object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_4px_22px_rgba(0,0,0,0.4)]"
            sizes="(max-width: 640px) 48vw, 160px"
            quality={92}
            priority
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Picks raster PNG or SVG coach from `NEXT_PUBLIC_TRAVEL_HERO_BUS`. */
function TravelHeroBusVisual({
  reduceMotion,
  cruise = false,
  className,
}: {
  reduceMotion: boolean;
  cruise?: boolean;
  className?: string;
}) {
  const { uid } = useTravelHeroScope();
  if (getTravelHeroBusVariant() === "vector") {
    return (
      <EgoPremiumBus
        reduceMotion={reduceMotion}
        uid={uid}
        cruise={cruise}
        className={className}
      />
    );
  }
  return <TravelHeroBusImage reduceMotion={reduceMotion} cruise={cruise} className={className} />;
}

/** Realistic 3D cloud with volume and depth */
function RealisticCloud({ className, variant = 0 }: { className?: string; variant?: number }) {
  const clipId = useId().replace(/:/g, "");
  
  // Different cloud shapes - more realistic cumulus formations
  const cloudPaths = [
    {
      main: "M 20 45 C 15 30 30 18 50 20 C 60 10 80 8 95 18 C 110 8 130 15 138 30 C 152 32 158 45 152 58 C 155 68 142 74 125 72 L 35 72 C 18 74 12 60 20 45 Z",
      bumps: [
        { cx: 45, cy: 25, rx: 18, ry: 16 },
        { cx: 75, cy: 22, rx: 22, ry: 19 },
        { cx: 105, cy: 28, rx: 20, ry: 17 },
      ],
    },
    {
      main: "M 18 48 C 14 32 28 22 45 24 C 54 14 72 12 86 20 C 98 12 115 18 122 32 C 135 34 140 46 136 57 C 138 66 128 71 114 70 L 32 70 C 17 72 12 58 18 48 Z",
      bumps: [
        { cx: 42, cy: 28, rx: 16, ry: 15 },
        { cx: 68, cy: 25, rx: 19, ry: 17 },
        { cx: 95, cy: 30, rx: 18, ry: 16 },
      ],
    },
    {
      main: "M 22 50 C 18 36 32 26 48 28 C 56 18 74 16 88 24 C 100 16 116 22 124 35 C 136 37 142 48 138 59 C 140 68 130 73 116 72 L 36 72 C 20 74 16 62 22 50 Z",
      bumps: [
        { cx: 48, cy: 30, rx: 17, ry: 16 },
        { cx: 75, cy: 27, rx: 20, ry: 18 },
        { cx: 102, cy: 32, rx: 19, ry: 17 },
      ],
    },
  ];

  const cloud = cloudPaths[variant % cloudPaths.length];

  return (
    <svg
      className={cn(
        "h-full w-full overflow-visible drop-shadow-[0_3px_8px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]",
        className
      )}
      viewBox="0 0 160 80"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <path d={cloud.main} />
        </clipPath>
        
        <radialGradient id={`${clipId}-volume`}>
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(210 20% 92%)" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Base — light mode: soft white; dark: opaque pale cloud (low-opacity + dark sky reads as black) */}
        <path d={cloud.main} className="fill-white/95 dark:fill-sky-100/92" />

        {/* Volume bumps — keep gradient; do not override fill in dark (was washing out / fighting url(#)) */}
        {cloud.bumps.map((bump, i) => (
          <ellipse
            key={i}
            cx={bump.cx}
            cy={bump.cy}
            rx={bump.rx}
            ry={bump.ry}
            fill={`url(#${clipId}-volume)`}
            opacity={0.6}
          />
        ))}

        {/* Underside shading */}
        <ellipse
          cx="80"
          cy="65"
          rx="55"
          ry="8"
          className="fill-slate-300/35 dark:fill-sky-950/25"
        />

        {/* Top highlight */}
        <ellipse
          cx="80"
          cy="28"
          rx="45"
          ry="12"
          className="fill-white/55 dark:fill-sky-50/45"
        />
      </g>
    </svg>
  );
}

function DriftingCloud({
  className,
  delay,
  reduceMotion,
  duration = 22,
  variant = 0,
}: {
  className?: string;
  delay: number;
  reduceMotion: boolean;
  duration?: number;
  variant?: number;
}) {
  return (
    <motion.div
      className={cn("absolute z-[5] opacity-95", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: delay * 0.15 }}
    >
      <motion.div
        className="h-full w-full"
        animate={
          reduceMotion
            ? { x: 0 }
            : { x: ["-4%", "6%", "-4%"] }
        }
        transition={
          reduceMotion
            ? {}
            : { duration, repeat: Infinity, ease: "easeInOut", delay }
        }
      >
        <RealisticCloud className="h-full w-full" variant={variant} />
      </motion.div>
    </motion.div>
  );
}

/** Detailed sun with realistic rays */
function DetailedSun({ reduceMotion, uid }: { reduceMotion: boolean; uid: string }) {
  const sid = `sun-${uid}`;
  
  // Create more rays with varied lengths
  const rays = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 360) / 16;
    const rad = (angle * Math.PI) / 180;
    const innerRadius = 26;
    const outerRadius = i % 2 === 0 ? 40 : 36;
    
    const x1 = 50 + Math.cos(rad) * innerRadius;
    const y1 = 50 + Math.sin(rad) * innerRadius;
    const x2 = 50 + Math.cos(rad) * outerRadius;
    const y2 = 50 + Math.sin(rad) * outerRadius;
    
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`url(#${sid}-ray)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.95"
      />
    );
  });

  return (
    <motion.div
      className="pointer-events-none absolute right-[3%] top-[4%] z-[4] h-14 w-14 md:h-[4.25rem] md:w-[4.25rem]"
      animate={reduceMotion ? {} : { scale: [1, 1.05, 1] }}
      transition={reduceMotion ? {} : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-lg">
        <defs>
          <radialGradient id={`${sid}-core`}>
            <stop offset="0%" stopColor="hsl(50 100% 68%)" />
            <stop offset="50%" stopColor="hsl(45 100% 60%)" />
            <stop offset="100%" stopColor="hsl(40 100% 52%)" />
          </radialGradient>
          
          <linearGradient id={`${sid}-ray`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(48 100% 62%)" />
            <stop offset="100%" stopColor="hsl(42 100% 55%)" />
          </linearGradient>
        </defs>
        
        <motion.g
          style={{ transformOrigin: "50px 50px" }}
          animate={reduceMotion ? {} : { rotate: 360 }}
          transition={reduceMotion ? {} : { duration: 80, repeat: Infinity, ease: "linear" }}
        >
          {rays}
        </motion.g>
        
        {/* Sun core */}
        <circle cx="50" cy="50" r="24" fill={`url(#${sid}-core)`} />
        
        {/* Highlight */}
        <circle cx="45" cy="45" r="10" fill="hsl(55 100% 80%)" opacity="0.5" />
        <circle cx="43" cy="43" r="6" fill="hsl(60 100% 90%)" opacity="0.7" />
      </svg>
    </motion.div>
  );
}

/** Detailed tree with realistic foliage and bark texture */
function RealisticTree({
  x = 50,
  scale = 1,
  reduceMotion,
}: {
  x?: number;
  scale?: number;
  reduceMotion: boolean;
}) {
  const treeId = useId().replace(/:/g, "");

  return (
    <motion.g
      style={{ transformOrigin: `${x}px 198px` }}
      animate={
        reduceMotion
          ? false
          : { rotate: [0, 1.2 * scale, 0, -0.8 * scale, 0] }
      }
      transition={
        reduceMotion
          ? undefined
          : { duration: 5 + scale, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <defs>
        <linearGradient id={`${treeId}-trunk`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(25 45% 32%)" />
          <stop offset="50%" stopColor="hsl(28 48% 36%)" />
          <stop offset="100%" stopColor="hsl(25 42% 28%)" />
        </linearGradient>

        <radialGradient id={`${treeId}-canopy-main`}>
          <stop offset="0%" stopColor="hsl(135 60% 40%)" />
          <stop offset="60%" stopColor="hsl(140 58% 35%)" />
          <stop offset="100%" stopColor="hsl(145 55% 28%)" />
        </radialGradient>

        <radialGradient id={`${treeId}-canopy-light`}>
          <stop offset="0%" stopColor="hsl(110 65% 48%)" />
          <stop offset="100%" stopColor="hsl(125 60% 38%)" />
        </radialGradient>
      </defs>

      {/* Trunk with taper */}
      <path
        d={`M ${x - 5 * scale} 198
            L ${x - 4 * scale} ${155 - 20 * scale}
            C ${x - 3.5 * scale} ${145 - 20 * scale} ${x - 1 * scale} ${140 - 20 * scale} ${x + 2 * scale} ${138 - 20 * scale}
            L ${x + 6 * scale} ${138 - 20 * scale}
            C ${x + 9 * scale} ${140 - 20 * scale} ${x + 11.5 * scale} ${145 - 20 * scale} ${x + 12 * scale} ${155 - 20 * scale}
            L ${x + 13 * scale} 198
            Z`}
        fill={`url(#${treeId}-trunk)`}
        stroke="hsl(25 40% 24%)"
        strokeWidth={0.8 * scale}
      />

      {/* Bark texture lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M ${x - 3 * scale} ${160 + i * 8 * scale} Q ${x + 2 * scale} ${158 + i * 8 * scale} ${x + 7 * scale} ${160 + i * 8 * scale}`}
          stroke="hsl(25 35% 22%)"
          strokeWidth={0.6 * scale}
          fill="none"
          opacity="0.4"
        />
      ))}

      {/* Canopy - multiple layers for depth */}
      
      {/* Back layer */}
      <circle
        cx={x - 8 * scale}
        cy={115 - 15 * scale}
        r={18 * scale}
        fill="hsl(145 52% 30%)"
        opacity="0.6"
      />
      <circle
        cx={x + 12 * scale}
        cy={118 - 15 * scale}
        r={16 * scale}
        fill="hsl(145 52% 30%)"
        opacity="0.6"
      />

      {/* Main canopy volume */}
      <ellipse
        cx={x}
        cy={110 - 15 * scale}
        rx={30 * scale}
        ry={35 * scale}
        fill={`url(#${treeId}-canopy-main)`}
        stroke="hsl(145 50% 26%)"
        strokeWidth={0.8 * scale}
        opacity="0.95"
      />

      {/* Secondary bumps for organic shape */}
      <circle
        cx={x - 12 * scale}
        cy={105 - 12 * scale}
        r={14 * scale}
        fill="hsl(138 58% 36%)"
        opacity="0.85"
      />
      <circle
        cx={x + 14 * scale}
        cy={108 - 12 * scale}
        r={16 * scale}
        fill="hsl(132 60% 38%)"
        opacity="0.9"
      />
      <circle
        cx={x}
        cy={95 - 18 * scale}
        r={18 * scale}
        fill="hsl(130 62% 40%)"
        opacity="0.88"
      />

      {/* Light spots - sun hitting foliage */}
      <ellipse
        cx={x - 8 * scale}
        cy={98 - 15 * scale}
        rx={12 * scale}
        ry={10 * scale}
        fill={`url(#${treeId}-canopy-light)`}
        opacity="0.5"
      />
      <ellipse
        cx={x + 10 * scale}
        cy={102 - 12 * scale}
        rx={10 * scale}
        ry={8 * scale}
        fill="hsl(115 68% 52%)"
        opacity="0.45"
      />
      <ellipse
        cx={x}
        cy={88 - 18 * scale}
        rx={14 * scale}
        ry={11 * scale}
        fill="hsl(120 70% 55%)"
        opacity="0.4"
      />

      {/* Dark accents for depth */}
      <ellipse
        cx={x}
        cy={135 - 15 * scale}
        rx={26 * scale}
        ry={12 * scale}
        fill="hsl(145 50% 25%)"
        opacity="0.7"
      />
    </motion.g>
  );
}

function hillParallax(reduceMotion: boolean, duration: number, x: number[]) {
  return reduceMotion
    ? false
    : { x, transition: { duration, repeat: Infinity, ease: "easeInOut" as const } };
}

/** Rolling hills + grass only (no trees) — pair with `TravelHeroTrees`. */
function TravelHeroRollingHillsSvg({
  uid,
  reduceMotion,
  className,
}: {
  uid: string;
  reduceMotion: boolean;
  className?: string;
}) {
  const lid = `land-${uid}`;

  return (
    <svg
      className={cn("pointer-events-none h-full w-full text-inherit", className)}
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${lid}-hill-far`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(100 50% 70%)" />
          <stop offset="100%" stopColor="hsl(105 45% 60%)" />
        </linearGradient>
        <linearGradient id={`${lid}-hill-mid`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(125 55% 50%)" />
          <stop offset="100%" stopColor="hsl(130 52% 40%)" />
        </linearGradient>
        <linearGradient id={`${lid}-hill-near`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(140 60% 38%)" />
          <stop offset="100%" stopColor="hsl(145 58% 28%)" />
        </linearGradient>
      </defs>

      <motion.g animate={hillParallax(reduceMotion, 16, [0, -8, 0])} opacity={0.92}>
        <path
          d="M 0 115 C 80 95 160 105 240 98 C 320 92 380 100 400 94 L 400 200 L 0 200 Z"
          fill={`url(#${lid}-hill-far)`}
        />
      </motion.g>

      <motion.g animate={hillParallax(reduceMotion, 12, [0, -12, 0])}>
        <path
          d="M 0 130 C 100 115 200 125 300 118 C 350 114 380 120 400 116 L 400 200 L 0 200 Z"
          fill={`url(#${lid}-hill-mid)`}
        />
      </motion.g>

      <motion.g animate={hillParallax(reduceMotion, 9, [0, -16, 0])}>
        <path
          d="M 0 148 C 120 128 240 142 320 136 C 360 132 390 138 400 134 L 400 200 L 0 200 Z"
          fill={`url(#${lid}-hill-near)`}
        />
        <g fill="hsl(145 62% 25%)" opacity="0.75">
          <path d="M 85 134 l 2 -7 l 2.5 7 z" />
          <path d="M 92 136 l 1.5 -6 l 2 6 z" />
          <path d="M 100 133 l 2 -8 l 2 8 z" />
          <path d="M 108 135 l 1.5 -6 l 2.5 6 z" />
          <path d="M 215 128 l 2 -7 l 2 7 z" />
          <path d="M 223 130 l 1.5 -6 l 2.5 6 z" />
          <path d="M 230 127 l 2 -7.5 l 2 7.5 z" />
          <path d="M 305 132 l 2 -7 l 2 7 z" />
          <path d="M 313 134 l 1.5 -6 l 2 6 z" />
          <path d="M 345 130 l 2 -7.5 l 2 7.5 z" />
        </g>
      </motion.g>
    </svg>
  );
}

/** Foreground trees only — same viewBox as hills; stack above `TravelHeroRollingHills`. */
function TravelHeroTreesSvg({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <svg
      className="pointer-events-none h-full w-full"
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <RealisticTree x={50} scale={1.2} reduceMotion={reduceMotion} />
      <RealisticTree x={330} scale={0.9} reduceMotion={reduceMotion} />
      <RealisticTree x={370} scale={0.7} reduceMotion={reduceMotion} />
    </svg>
  );
}

/**
 * Flat grey road, edge to edge — static white dashed center line (no motion).
 * `reduceMotion` kept for call-site compatibility; markings are always static.
 */
function RealisticRoad({ reduceMotion: _reduceMotion, className }: { reduceMotion: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "relative h-4 w-full overflow-hidden bg-zinc-400 dark:bg-zinc-500",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-zinc-100/90 dark:bg-zinc-300/80" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-zinc-500/90 dark:bg-zinc-600" />
      {/* Static center line — repeating dashes */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 opacity-95 dark:opacity-90"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgb(255 255 255) 0 11px, transparent 11px 24px)",
        }}
        aria-hidden
      />
    </div>
  );
}

/**
 * Distant buildings, trees, and grass — same idea as clouds: soft silhouettes on the page background.
 */
export function TravelHeroAmbientScenery({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-12 z-[4] h-[4.5rem] sm:bottom-14 sm:h-[5.25rem]",
        className
      )}
      aria-hidden
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 420 70"
        preserveAspectRatio="xMidYMax meet"
      >
        {/* Left skyline — varied cool greys, cornices + window hints */}
        <g fill="currentColor">
          <g className="text-zinc-500/[0.48] dark:text-zinc-400/[0.28]">
            <rect x="3" y="42" width="13" height="26" rx="0.65" />
            <rect x="4.5" y="40" width="10" height="2.8" rx="0.35" className="text-zinc-600/[0.55] dark:text-zinc-500/[0.38]" />
            <rect x="5.2" y="47" width="2.4" height="3" rx="0.2" className="text-zinc-300/[0.4] dark:text-zinc-600/[0.22]" />
            <rect x="8.8" y="47" width="2.4" height="3" rx="0.2" className="text-zinc-300/[0.4] dark:text-zinc-600/[0.22]" />
          </g>
          <g className="text-zinc-600/[0.44] dark:text-zinc-500/[0.26]">
            <rect x="17" y="32" width="15" height="36" rx="0.7" />
            <rect x="18.5" y="29.5" width="12" height="3.2" rx="0.35" className="text-zinc-700/[0.5] dark:text-zinc-400/[0.34]" />
            <rect x="19.5" y="38" width="2.3" height="2.8" rx="0.2" className="text-zinc-300/[0.35] dark:text-zinc-600/[0.2]" />
            <rect x="23" y="38" width="2.3" height="2.8" rx="0.2" className="text-zinc-300/[0.35] dark:text-zinc-600/[0.2]" />
            <rect x="26.5" y="38" width="2.3" height="2.8" rx="0.2" className="text-zinc-300/[0.35] dark:text-zinc-600/[0.2]" />
            <rect x="19.5" y="44" width="2.3" height="2.8" rx="0.2" className="text-zinc-300/[0.32] dark:text-zinc-600/[0.18]" />
            <rect x="23" y="44" width="2.3" height="2.8" rx="0.2" className="text-zinc-300/[0.32] dark:text-zinc-600/[0.18]" />
          </g>
          <g className="text-slate-500/[0.46] dark:text-zinc-500/[0.27]">
            <rect x="34" y="38" width="10" height="30" rx="0.55" />
            <rect x="35" y="36" width="8" height="2.4" rx="0.3" className="text-slate-600/[0.52] dark:text-zinc-400/[0.32]" />
            <rect x="35.8" y="43" width="2" height="2.5" rx="0.2" className="text-slate-300/[0.38] dark:text-zinc-600/[0.2]" />
            <rect x="38.5" y="43" width="2" height="2.5" rx="0.2" className="text-slate-300/[0.38] dark:text-zinc-600/[0.2]" />
          </g>
          <g className="text-zinc-500/[0.42] dark:text-zinc-500/[0.24]">
            <rect x="45" y="28" width="13" height="40" rx="0.65" />
            <rect x="46.2" y="25.5" width="10.6" height="3.2" rx="0.35" className="text-zinc-600/[0.5] dark:text-zinc-400/[0.3]" />
            <rect x="47" y="33" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.36] dark:text-zinc-600/[0.2]" />
            <rect x="50.2" y="33" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.36] dark:text-zinc-600/[0.2]" />
            <rect x="53.4" y="33" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.36] dark:text-zinc-600/[0.2]" />
            <rect x="47" y="38.5" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.3] dark:text-zinc-600/[0.17]" />
            <rect x="50.2" y="38.5" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.3] dark:text-zinc-600/[0.17]" />
          </g>
        </g>

        {/* Gateway of India (Mumbai) — same grey family as skyline */}
        <g className="text-zinc-500/[0.52] dark:text-zinc-400/[0.3]" fill="currentColor">
          <title>Gateway of India inspired silhouette</title>
          {/* Stepped base */}
          <rect x="168" y="64" width="84" height="4" rx="0.4" className="text-zinc-600/[0.48] dark:text-zinc-500/[0.28]" />
          <rect x="171" y="60" width="78" height="4.5" rx="0.4" />
          {/* Side wings */}
          <rect x="172" y="34" width="16" height="26" rx="0.5" />
          <rect x="232" y="34" width="16" height="26" rx="0.5" />
          <rect x="174" y="31" width="12" height="3.5" rx="0.3" className="text-zinc-600/[0.55] dark:text-zinc-500/[0.34]" />
          <rect x="234" y="31" width="12" height="3.5" rx="0.3" className="text-zinc-600/[0.55] dark:text-zinc-500/[0.34]" />
          {/* Horseshoe arch mass */}
          <path d="M 188 60 L 188 38 Q 210 18 232 38 L 232 60 L 225 60 L 225 40 Q 210 26 195 40 L 195 60 Z" />
          {/* Inner arch reveal (lighter edge) */}
          <path
            d="M 196 60 L 196 43 Q 210 32 224 43 L 224 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            className="text-zinc-400/[0.35] dark:text-zinc-500/[0.22]"
            opacity={0.9}
          />
          {/* Top cornice */}
          <rect x="184" y="24" width="52" height="5" rx="0.35" className="text-zinc-600/[0.5] dark:text-zinc-500/[0.32]" />
          {/* Corner turret caps */}
          <rect x="170" y="28" width="5" height="4" rx="0.35" className="text-zinc-600/[0.45] dark:text-zinc-500/[0.28]" />
          <rect x="245" y="28" width="5" height="4" rx="0.35" className="text-zinc-600/[0.45] dark:text-zinc-500/[0.28]" />
          {/* Central finial */}
          <path
            d="M 210 24 L 207 17 L 213 17 Z"
            className="text-zinc-600/[0.52] dark:text-zinc-500/[0.34]"
          />
          <circle cx="210" cy="15.5" r="2.2" className="text-zinc-500/[0.55] dark:text-zinc-400/[0.32]" />
        </g>

        {/* Right skyline */}
        <g fill="currentColor">
          <g className="text-zinc-600/[0.43] dark:text-zinc-500/[0.25]">
            <rect x="316" y="34" width="14" height="34" rx="0.65" />
            <rect x="317.5" y="31.5" width="11" height="3" rx="0.35" className="text-zinc-700/[0.48] dark:text-zinc-400/[0.3]" />
            <rect x="318.5" y="39" width="2.3" height="2.7" rx="0.2" className="text-zinc-300/[0.34] dark:text-zinc-600/[0.19]" />
            <rect x="322" y="39" width="2.3" height="2.7" rx="0.2" className="text-zinc-300/[0.34] dark:text-zinc-600/[0.19]" />
            <rect x="325.5" y="39" width="2.3" height="2.7" rx="0.2" className="text-zinc-300/[0.34] dark:text-zinc-600/[0.19]" />
          </g>
          <g className="text-zinc-500/[0.46] dark:text-zinc-400/[0.27]">
            <rect x="332" y="27" width="17" height="41" rx="0.7" />
            <rect x="333.5" y="24.5" width="14" height="3.4" rx="0.35" className="text-zinc-600/[0.52] dark:text-zinc-500/[0.32]" />
            <rect x="334.8" y="32" width="2.4" height="2.9" rx="0.2" className="text-zinc-300/[0.36] dark:text-zinc-600/[0.2]" />
            <rect x="338.5" y="32" width="2.4" height="2.9" rx="0.2" className="text-zinc-300/[0.36] dark:text-zinc-600/[0.2]" />
            <rect x="342.2" y="32" width="2.4" height="2.9" rx="0.2" className="text-zinc-300/[0.36] dark:text-zinc-600/[0.2]" />
            <rect x="334.8" y="37.5" width="2.4" height="2.9" rx="0.2" className="text-zinc-300/[0.3] dark:text-zinc-600/[0.17]" />
            <rect x="338.5" y="37.5" width="2.4" height="2.9" rx="0.2" className="text-zinc-300/[0.3] dark:text-zinc-600/[0.17]" />
          </g>
          <g className="text-slate-500/[0.44] dark:text-zinc-500/[0.26]">
            <rect x="351" y="36" width="11" height="32" rx="0.55" />
            <rect x="352" y="33.5" width="9" height="2.8" rx="0.3" className="text-slate-600/[0.5] dark:text-zinc-400/[0.3]" />
            <rect x="352.8" y="41" width="2" height="2.4" rx="0.2" className="text-slate-300/[0.36] dark:text-zinc-600/[0.2]" />
            <rect x="355.8" y="41" width="2" height="2.4" rx="0.2" className="text-slate-300/[0.36] dark:text-zinc-600/[0.2]" />
          </g>
          <g className="text-zinc-500/[0.4] dark:text-zinc-500/[0.23]">
            <rect x="363" y="30" width="15" height="38" rx="0.65" />
            <rect x="364.2" y="27.5" width="12.6" height="3.2" rx="0.35" className="text-zinc-600/[0.48] dark:text-zinc-400/[0.28]" />
            <rect x="365" y="35" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.32] dark:text-zinc-600/[0.18]" />
            <rect x="368.5" y="35" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.32] dark:text-zinc-600/[0.18]" />
            <rect x="372" y="35" width="2.2" height="2.6" rx="0.2" className="text-zinc-300/[0.32] dark:text-zinc-600/[0.18]" />
          </g>
          <g className="text-zinc-600/[0.38] dark:text-zinc-500/[0.22]">
            <rect x="379" y="37" width="10" height="31" rx="0.5" />
            <rect x="380" y="35" width="8" height="2.5" rx="0.3" className="text-zinc-700/[0.45] dark:text-zinc-400/[0.26]" />
            <rect x="380.8" y="42" width="2" height="2.4" rx="0.2" className="text-zinc-300/[0.3] dark:text-zinc-600/[0.16]" />
            <rect x="383.8" y="42" width="2" height="2.4" rx="0.2" className="text-zinc-300/[0.3] dark:text-zinc-600/[0.16]" />
          </g>
        </g>
        {/* Trees — separate greens, still low-contrast */}
        <g className="text-emerald-700/50 dark:text-emerald-600/25" fill="currentColor">
          <rect x="92" y="48" width="2.8" height="18" rx="0.4" />
          <circle cx="93.4" cy="40" r="11" opacity={0.9} />
          <rect x="138" y="46" width="2.5" height="20" rx="0.4" />
          <ellipse cx="139.2" cy="36" rx="10" ry="13" opacity={0.88} />
          <rect x="268" y="50" width="2.2" height="16" rx="0.4" />
          <circle cx="269.1" cy="42" r="9" opacity={0.85} />
          <rect x="298" y="47" width="2.6" height="19" rx="0.4" />
          <ellipse cx="299.3" cy="37" rx="9.5" ry="12" opacity={0.87} />
        </g>
        {/* Grass tufts */}
        <g
          className="text-emerald-800/45 dark:text-emerald-700/22"
          fill="currentColor"
          opacity={0.95}
        >
          <path d="M 72 68 l 1.8 -6.5 l 1.6 6.5 z" />
          <path d="M 76 69 l 1.2 -5 l 1.4 5 z" />
          <path d="M 184 68 l 2 -7 l 1.8 7 z" />
          <path d="M 189 69 l 1.4 -5.5 l 1.2 5.5 z" />
          <path d="M 228 67 l 1.6 -6 l 1.7 6 z" />
          <path d="M 232 68 l 1.1 -4.5 l 1.3 4.5 z" />
        </g>
      </svg>
    </div>
  );
}

/** Full-width shell; place `TravelHeroScope` + scene pieces inside. */
export function TravelHeroSection({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative isolate mx-auto w-full max-w-3xl overflow-x-hidden py-1", className)}>
      {children}
    </div>
  );
}

/** Optional wash only — default is transparent so the page background reads as one surface. */
export function TravelHeroSkyBackdrop({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 bg-transparent",
        className
      )}
      aria-hidden
    />
  );
}

export function TravelHeroSkyShimmer({ className }: { className?: string }) {
  const { reduceMotion } = useTravelHeroScope();
  if (reduceMotion) return null;
  return (
    <motion.div
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] bg-gradient-to-tr from-cyan-300/8 via-transparent to-amber-200/12 dark:from-cyan-900/15 dark:to-amber-900/8",
        className
      )}
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

export function TravelHeroSun() {
  const { uid, reduceMotion } = useTravelHeroScope();
  return <DetailedSun reduceMotion={reduceMotion} uid={uid} />;
}

export function TravelHeroDriftingCloud({
  className,
  delay,
  duration,
  variant = 0,
}: {
  className?: string;
  delay: number;
  duration: number;
  variant?: number;
}) {
  const { reduceMotion } = useTravelHeroScope();
  return (
    <DriftingCloud
      className={className}
      delay={delay}
      duration={duration}
      variant={variant}
      reduceMotion={reduceMotion}
    />
  );
}

export function TravelHeroRollingHills({ className }: { className?: string }) {
  const { uid, reduceMotion } = useTravelHeroScope();
  return (
    <div className={cn(GROUND_STRIP, "z-[2]", className)} aria-hidden>
      <TravelHeroRollingHillsSvg uid={uid} reduceMotion={reduceMotion} />
    </div>
  );
}

export function TravelHeroTrees({ className }: { className?: string }) {
  const { reduceMotion } = useTravelHeroScope();
  return (
    <div className={cn(GROUND_STRIP, "z-[3]", className)} aria-hidden>
      <TravelHeroTreesSvg reduceMotion={reduceMotion} />
    </div>
  );
}

export function TravelHeroHeading({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("relative z-20 px-3 pb-1 pt-4 text-center sm:px-4 sm:pt-5", className)}
      variants={titleContainer}
      initial="hidden"
      animate="visible"
    >
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 drop-shadow-sm dark:text-zinc-50 sm:text-3xl md:leading-tight">
        {TITLE_WORDS.map((word, i) => (
          <motion.span
            key={word + i}
            variants={titleWord}
            className="inline-block pr-[0.25em] last:pr-0"
          >
            {word}
          </motion.span>
        ))}
      </h1>
      <motion.p
        className="mt-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:text-sm"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Book bus tickets in a few taps — smooth rides, clear fares.
      </motion.p>
    </motion.div>
  );
}

export function TravelHeroCoachBus({ className }: { className?: string }) {
  const { reduceMotion } = useTravelHeroScope();
  return (
    <div className={cn("relative z-10 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4", className)}>
      <div className="w-full max-w-[min(100%,175px)] sm:max-w-[190px]">
        <TravelHeroBusVisual reduceMotion={reduceMotion} />
      </div>
    </div>
  );
}

export function TravelHeroRoadStrip({ className }: { className?: string }) {
  const { reduceMotion } = useTravelHeroScope();
  return (
    <div
      className={cn(
        "relative z-10 mx-auto pb-1 mt-1.5 w-full max-w-[min(100%,280px)] px-1 sm:mt-2 sm:max-w-[320px] sm:px-2",
        className
      )}
    >
      <RealisticRoad reduceMotion={reduceMotion} />
    </div>
  );
}

/** Flat mini landscape above the road — layered hills, simple trees, pale sky (reference-style). */
function TravelHeroCruiseHillsStrip() {
  return (
    <div
      className={cn("relative w-full overflow-hidden bg-sky-100/85 dark:bg-sky-900/30")}
      aria-hidden
    >
      <svg
        className="block h-9 w-full sm:h-10"
        viewBox="0 0 400 48"
        preserveAspectRatio="none"
      >
        <title>Landscape</title>
        {/* Distant soft hill — kept low in the viewBox so it doesn’t read into the skyline above */}
        <path
          d="M0 48 V 30 C 55 24 95 22 150 28 S 260 20 400 26 V 48 Z"
          className="fill-emerald-200/95 dark:fill-emerald-700/55"
        />
        {/* Mid rolling hills */}
        <path
          d="M0 48 V 32 C 70 18 110 20 170 30 S 270 22 400 30 V 48 Z"
          className="fill-emerald-300/95 dark:fill-emerald-600/58"
        />
        {/* Foreground hill */}
        <path
          d="M0 48 V 38 C 90 28 130 30 200 38 S 310 32 400 40 V 48 Z"
          className="fill-emerald-400/95 dark:fill-emerald-600/62"
        />
        {/* Winding paths — airy greens */}
        <path
          d="M 48 46 Q 72 34 96 42"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          className="text-lime-100/95 dark:text-lime-400/50"
        />
        <path
          d="M 288 46 Q 312 36 338 44"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          className="text-emerald-100/90 dark:text-emerald-400/45"
        />
        {/* Taller trees — lighter trunk + canopy greens */}
        <g className="fill-emerald-600/80 dark:fill-emerald-500/75">
          <rect x="71.2" y="24" width="2.4" height="15" rx="0.45" />
          <rect x="116.8" y="22" width="2.2" height="16" rx="0.4" />
          <rect x="266.8" y="23" width="2.4" height="15.5" rx="0.45" />
        </g>
        <circle cx="72.4" cy="17.5" r="6.8" className="fill-lime-400/95 dark:fill-lime-300/85" />
        <circle cx="118" cy="14" r="4.2" className="fill-emerald-400/95 dark:fill-emerald-300/82" />
        <circle cx="114.2" cy="16.2" r="3.6" className="fill-green-400/95 dark:fill-green-300/78" />
        <circle cx="121.6" cy="16.2" r="3.6" className="fill-emerald-400/95 dark:fill-emerald-300/80" />
        <ellipse
          cx="268.2"
          cy="15"
          rx="7"
          ry="6"
          className="fill-green-400/95 dark:fill-green-300/80"
        />
      </svg>
    </div>
  );
}

/** Hills + road only — keep `z-[1]` so `TravelHeroAmbientScenery` (`z-[4]`) paints on top. */
export function TravelHeroCruiseGround({ className }: { className?: string }) {
  const { reduceMotion } = useTravelHeroScope();
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-2 z-[1] flex flex-col sm:bottom-3",
        className
      )}
      aria-hidden
    >
      <TravelHeroCruiseHillsStrip />
      <RealisticRoad reduceMotion={reduceMotion} className="h-5 shrink-0 rounded-none sm:h-6" />
    </div>
  );
}

/** Moving bus — `z-[8]` so it stays above skyline + heading overlap region. */
export function TravelHeroCruiseBus({ className }: { className?: string }) {
  const { reduceMotion } = useTravelHeroScope();
  return (
    <div className={cn("relative z-[8] w-full px-0 pb-2 pt-1 sm:pb-3 sm:pt-2", className)}>
      <div className="relative w-full min-h-[5rem] sm:min-h-[5.5rem]">
        <div className="pointer-events-none relative flex w-full items-end justify-center overflow-visible pb-0">
          {/* motion `x` only on outer div; inner `translate-y` lowers bus without being overwritten. */}
          <motion.div
            className="relative w-[min(48vw,160px)] max-w-[160px]"
            animate={
              reduceMotion
                ? { x: 0 }
                : { x: ["-44vw", "44vw"] }
            }
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : {
                    x: {
                      duration: 12,
                      repeat: Infinity,
                      ease: "linear",
                      repeatType: "loop",
                    },
                  }
            }
          >
            <div className="translate-y-1.5 sm:translate-y-2">
              <HeroCruiseSpeedWind active={!reduceMotion} />
              <div className="relative z-[2]">
                <TravelHeroBusVisual reduceMotion={reduceMotion} cruise />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** One-liner composition; for separate DOM objects, compose on the page with the exports above. */
export function ImprovedTravelHero({ className }: { className?: string }) {
  return (
    <TravelHeroSection className={className}>
      <TravelHeroScope>
        <TravelHeroSun />
        <TravelHeroDriftingCloud
          className="left-[2%] top-[6%] h-11 w-32 md:h-12 md:w-40"
          delay={0}
          duration={28}
          variant={0}
        />
        <TravelHeroDriftingCloud
          className="left-[26%] top-[2%] h-9 w-28 md:h-10 md:w-36"
          delay={2}
          duration={22}
          variant={1}
        />
        <TravelHeroDriftingCloud
          className="right-[4%] top-[10%] h-10 w-32 md:h-11 md:w-40"
          delay={3.5}
          duration={26}
          variant={2}
        />
        <TravelHeroDriftingCloud
          className="right-[20%] top-[4%] h-8 w-24 opacity-90"
          delay={5}
          duration={20}
          variant={0}
        />
        <TravelHeroCruiseGround />
        <TravelHeroAmbientScenery />
        <TravelHeroHeading />
        <TravelHeroCruiseBus />
      </TravelHeroScope>
    </TravelHeroSection>
  );
}
