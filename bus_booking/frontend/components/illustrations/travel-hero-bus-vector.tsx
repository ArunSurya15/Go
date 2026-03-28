"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  reduceMotion: boolean;
  uid: string;
  cruise?: boolean;
  className?: string;
};

/** Premium SVG coach when `NEXT_PUBLIC_TRAVEL_HERO_BUS=vector`. */
export function EgoPremiumBus({ reduceMotion, uid, cruise = false, className }: Props) {
  const gid = `ego-${uid}`;

  return (
    <motion.svg
      viewBox="0 0 700 300"
      className={cn(
        "h-auto w-full max-w-[160px] sm:max-w-[175px] drop-shadow-[0_4px_18px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_4px_22px_rgba(0,0,0,0.4)]",
        className
      )}
      aria-hidden
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.08 }}
    >
      <defs>
        <linearGradient id={`${gid}-busBody`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="50%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id={`${gid}-glass`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={`${gid}-shine`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      <ellipse cx="350" cy="260" rx="250" ry="15" fill="rgba(0,0,0,0.15)" />

      <motion.g
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
        <rect x="80" y="100" width="540" height="120" rx="35" fill={`url(#${gid}-busBody)`} />
        <rect x="150" y="70" width="380" height="50" rx="25" fill={`url(#${gid}-busBody)`} />
        <rect x="130" y="110" width="380" height="70" rx="12" fill={`url(#${gid}-glass)`} />
        <rect x="130" y="110" width="380" height="30" rx="12" fill={`url(#${gid}-shine)`} />
        <rect x="520" y="110" width="90" height="75" rx="12" fill={`url(#${gid}-glass)`} />
        <text x="545" y="95" fill="#fde047" fontSize="26" fontWeight="bold">
          E Go
        </text>
        <path d="M100 170 Q260 120 420 170" stroke="#22c55e" strokeWidth="8" fill="none" />
        <path d="M100 190 Q260 140 420 190" stroke="#38bdf8" strokeWidth="5" fill="none" />

        {[200, 480].map((x, i) => (
          <motion.g
            key={i}
            animate={reduceMotion ? false : { rotate: 360 }}
            transition={
              reduceMotion ? undefined : { repeat: Infinity, duration: 1.2, ease: "linear" }
            }
            style={{ transformOrigin: `${x}px 235px` }}
          >
            <circle cx={x} cy="235" r="30" fill="#111827" />
            <circle cx={x} cy="235" r="15" fill="#9ca3af" />
          </motion.g>
        ))}

        <rect x="560" y="170" width="30" height="14" rx="7" fill="#fef08a" />
        <rect x="540" y="200" width="90" height="24" rx="6" fill="#facc15" />
        <text x="548" y="217" fontSize="12" fill="#000">
          MB 78 1234
        </text>

        <g>
          <circle cx="160" cy="135" r="10" fill="#fcd34d" />
          <rect x="150" y="145" width="20" height="20" rx="5" fill="#f97316" />
        </g>
        <g>
          <circle cx="220" cy="135" r="10" fill="#fecaca" />
          <rect x="210" y="145" width="20" height="20" rx="5" fill="#22c55e" />
        </g>
        <g>
          <circle cx="280" cy="135" r="10" fill="#fde68a" />
          <rect x="270" y="145" width="20" height="20" rx="5" fill="#60a5fa" />
        </g>
        <g>
          <circle cx="340" cy="130" r="10" fill="#fca5a5" />
          <rect x="330" y="140" width="20" height="20" rx="5" fill="#eab308" />
          <line x1="340" y1="115" x2="330" y2="95" stroke="#fca5a5" strokeWidth="3" />
          <line x1="340" y1="115" x2="350" y2="95" stroke="#fca5a5" strokeWidth="3" />
        </g>
        <g>
          <circle cx="565" cy="145" r="12" fill="#fde68a" />
          <rect x="553" y="158" width="24" height="20" rx="6" fill="#ffffff" />
        </g>
        <g>
          <circle cx="610" cy="145" r="10" fill="#bfdbfe" />
          <rect x="600" y="158" width="20" height="18" rx="5" fill="#60a5fa" />
        </g>
      </motion.g>
    </motion.svg>
  );
}

/** @deprecated Use `EgoPremiumBus` — kept for imports that expect this name. */
export const TravelHeroVectorCoach = EgoPremiumBus;
