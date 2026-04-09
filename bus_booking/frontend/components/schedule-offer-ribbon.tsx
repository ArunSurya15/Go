"use client";

import { cn } from "@/lib/utils";
import type { Schedule } from "@/lib/api";

const STYLE_PRESETS: Record<
  string,
  { label: string; className: string; subtitle?: string }
> = {
  last_minute: {
    label: "Last-minute deal",
    className:
      "bg-gradient-to-br from-red-500 via-orange-500 to-amber-400 text-white shadow-[0_4px_20px_-2px_rgba(239,68,68,0.55)] animate-pulse",
    subtitle: "Grab it before it is gone",
  },
  flash_sale: {
    label: "Flash sale",
    className:
      "bg-gradient-to-br from-fuchsia-600 via-pink-500 to-rose-500 text-white shadow-[0_4px_18px_-2px_rgba(236,72,153,0.5)]",
    subtitle: "Limited seats at this price",
  },
  weekend_special: {
    label: "Weekend special",
    className:
      "bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_4px_16px_-2px_rgba(14,165,233,0.45)]",
  },
  festival: {
    label: "Festival offer",
    className:
      "bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 text-amber-950 shadow-sm",
  },
  custom: {
    label: "Special offer",
    className:
      "bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_4px_16px_-2px_rgba(124,58,237,0.45)]",
  },
};

/**
 * Eye-catching ribbon for passenger schedule cards — uses operator promo text and/or style theme.
 */
export function ScheduleOfferRibbon({
  operatorPromoTitle,
  operatorOfferStyle,
}: {
  operatorPromoTitle?: string | null;
  operatorOfferStyle?: Schedule["operator_offer_style"];
}) {
  const style = (operatorOfferStyle || "").trim();
  const preset = style ? STYLE_PRESETS[style] : null;
  const title = (operatorPromoTitle || "").trim();
  const mainLabel = title || preset?.label;
  if (!mainLabel) return null;

  const ribbonClass =
    preset?.className ??
    "bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 shadow-sm";

  return (
    <div
      className={cn(
        "absolute right-0 top-0 z-10 max-w-[58%] rounded-bl-xl px-3 py-1.5 text-left shadow-md sm:max-w-[48%]",
        ribbonClass,
        style === "last_minute" && "ring-2 ring-white/30 ring-offset-1 ring-offset-transparent"
      )}
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 8% 100%, 0 72%)" }}
    >
      <p className="text-[11px] font-extrabold leading-tight tracking-tight sm:text-xs">{mainLabel}</p>
      {!title && preset?.subtitle ? (
        <p className="mt-0.5 text-[9px] font-medium opacity-90 sm:text-[10px]">{preset.subtitle}</p>
      ) : null}
    </div>
  );
}
