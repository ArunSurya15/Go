/**
 * Hero bus rendering:
 * - `raster` (default): PNG/WebP in `public/` (`hero-e-go-bus.png`).
 * - `vector`: SVG coach — set `.env.local` → `NEXT_PUBLIC_TRAVEL_HERO_BUS=vector` (or `svg`).
 */
export type TravelHeroBusVariant = "raster" | "vector";

export function getTravelHeroBusVariant(): TravelHeroBusVariant {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_TRAVEL_HERO_BUS?.toLowerCase().trim()
      : undefined;
  if (raw === "vector" || raw === "svg") return "vector";
  return "raster";
}
