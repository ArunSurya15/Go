"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { routes, type BusReviewItem } from "@/lib/api";
import { cn } from "@/lib/utils";

function ratingBadgeTier(avg: number) {
  if (avg >= 4) {
    return {
      wrap: "border-0 bg-green-900 text-white shadow-sm ring-1 ring-green-950/30 dark:bg-emerald-950 dark:ring-emerald-900/50",
      star: "fill-white text-white",
      sub: "text-white/90",
    };
  }
  if (avg >= 3) {
    return {
      wrap: "border-0 bg-amber-600 text-white shadow-sm ring-1 ring-amber-800/35 dark:bg-amber-700 dark:ring-amber-900/40",
      star: "fill-white text-white",
      sub: "text-white/90",
    };
  }
  return {
    wrap: "border-0 bg-red-700 text-white shadow-sm ring-1 ring-red-900/35 dark:bg-red-900 dark:ring-red-950/50",
    star: "fill-white text-white",
    sub: "text-white/90",
  };
}

export function BusRatingReviewsTrigger({
  busId,
  avg,
  count,
}: {
  busId: number;
  avg: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BusReviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tier = ratingBadgeTier(avg);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    routes
      .busReviews(busId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load reviews.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, busId]);

  useEffect(() => {
    if (!open) {
      setItems(null);
      setError("");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-opacity hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          tier.wrap
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Star className={cn("h-3.5 w-3.5", tier.star)} aria-hidden />
        {avg.toFixed(1)}
        <span className={cn("font-normal", tier.sub)}>({count})</span>
        <span className="sr-only">, open passenger reviews</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bus-reviews-title"
            className="flex max-h-[min(85vh,32rem)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 id="bus-reviews-title" className="text-base font-semibold">
                  Passenger reviews
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Overall {avg.toFixed(1)} ★ · {count} rating{count === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading reviews…</p>
              ) : error ? (
                <p className="py-4 text-sm text-destructive">{error}</p>
              ) : items && items.length === 0 ? (
                <p className="py-6 text-sm leading-relaxed text-muted-foreground">
                  No written reviews yet. The score above can still reflect all star ratings from completed
                  trips. Reviews with comments appear here after travellers share feedback.
                </p>
              ) : (
                <ul className="space-y-4">
                  {items?.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 dark:bg-muted/20"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium">{r.reviewer_label}</span>
                        <time
                          className="text-[11px] tabular-nums text-muted-foreground"
                          dateTime={r.created_at}
                        >
                          {new Date(r.created_at).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </div>
                      <div className="mt-1 flex gap-0.5" aria-label={`${r.stars} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-3.5 w-3.5",
                              i < r.stars
                                ? "fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-400"
                                : "fill-muted/30 text-muted-foreground/40"
                            )}
                            aria-hidden
                          />
                        ))}
                      </div>
                      {r.comment ? (
                        <p className="mt-2 text-sm leading-snug">{r.comment}</p>
                      ) : (
                        <p className="mt-1.5 text-xs italic text-muted-foreground">No comment</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
