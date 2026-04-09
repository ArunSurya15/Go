"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorOfferStyle, type Schedule, type SeatFareMap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkles, Zap, PartyPopper, Sun, Palette } from "lucide-react";
import type { ReactNode } from "react";

const DISCOUNT_PRESETS = [5, 10, 15, 20, 25] as const;

const OFFER_STYLE_OPTIONS: {
  value: OperatorOfferStyle | "";
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  { value: "", label: "None (text only)", hint: "Ribbon uses your offer line with a classic look.", icon: null },
  {
    value: "last_minute",
    label: "Last-minute deal",
    hint: "Urgent, high-energy — great for filling seats close to departure.",
    icon: <Zap className="h-4 w-4" aria-hidden />,
  },
  {
    value: "flash_sale",
    label: "Flash sale",
    hint: "Bold and exciting — limited-time feel.",
    icon: <Sparkles className="h-4 w-4" aria-hidden />,
  },
  {
    value: "weekend_special",
    label: "Weekend special",
    hint: "Calm premium gradient — leisure travellers.",
    icon: <Sun className="h-4 w-4" aria-hidden />,
  },
  {
    value: "festival",
    label: "Festival / season",
    hint: "Warm gold tones — holidays and peak season.",
    icon: <PartyPopper className="h-4 w-4" aria-hidden />,
  },
  {
    value: "custom",
    label: "Custom spotlight",
    hint: "Violet hero style — pair with your own offer line.",
    icon: <Palette className="h-4 w-4" aria-hidden />,
  },
];

function round2(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function bookableLabelsFromSeatMap(seatMap: { labels?: string[]; types?: string[] } | undefined): string[] {
  const labels = seatMap?.labels ?? [];
  const types = seatMap?.types ?? [];
  const out: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    const lb = (labels[i] || "").trim();
    if (!lb) continue;
    const t = types[i];
    if (t === "aisle" || t === "blank") continue;
    out.push(lb);
  }
  return out;
}

/** Only labels that differ from base fare are stored on the schedule. */
function buildSeatFareOverrides(
  bookable: string[],
  inputs: Record<string, string>,
  baseFare: string
): SeatFareMap {
  const base = parseFloat(baseFare) || 0;
  const out: SeatFareMap = {};
  for (const lb of bookable) {
    const raw = (inputs[lb] ?? "").trim();
    if (!raw) continue;
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) continue;
    if (Math.abs(v - base) > 0.009) {
      out[lb] = round2(v);
    }
  }
  return out;
}

export default function EditSchedulePricingPage() {
  const params = useParams();
  const router = useRouter();
  const { getValidToken } = useAuth();
  const id = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  const [fare, setFare] = useState("");
  const [fareOriginal, setFareOriginal] = useState("");
  const [operatorPromoTitle, setOperatorPromoTitle] = useState("");
  const [operatorOfferStyle, setOperatorOfferStyle] = useState<OperatorOfferStyle | "">("");
  const [customPct, setCustomPct] = useState("12");
  const [seatFareInputs, setSeatFareInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const token = await getValidToken();
    if (!token) {
      router.replace("/operator/login");
      return;
    }
    try {
      const s = await operatorApi.getSchedule(token, id);
      setSchedule(s);
      setFare(String(s.fare ?? ""));
      setFareOriginal(s.fare_original != null ? String(s.fare_original) : "");
      setOperatorPromoTitle(s.operator_promo_title ?? "");
      setOperatorOfferStyle((s.operator_offer_style as OperatorOfferStyle) || "");
      const sm = (s.bus as { seat_map?: { labels?: string[]; types?: string[] } })?.seat_map;
      const bookable = bookableLabelsFromSeatMap(sm);
      const baseStr = String(s.fare ?? "");
      const ov = (s.seat_fares || {}) as SeatFareMap;
      const nextInputs: Record<string, string> = {};
      for (const lb of bookable) {
        nextInputs[lb] = ov[lb] != null && ov[lb] !== "" ? String(ov[lb]) : baseStr;
      }
      setSeatFareInputs(nextInputs);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [getValidToken, id, router]);

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      router.replace("/operator/schedules");
      return;
    }
    load();
  }, [id, load, router]);

  const applyDiscountPercent = (pct: number) => {
    const currentSelling = parseFloat(fare) || 0;
    const currentMrp = parseFloat(fareOriginal) || 0;
    if (currentMrp > 0) {
      setFare(round2(currentMrp * (1 - pct / 100)));
      setError("");
      return;
    }
    if (currentSelling <= 0) {
      setError("Set a selling fare first.");
      return;
    }
    setFareOriginal(round2(currentSelling));
    setFare(round2(currentSelling * (1 - pct / 100)));
    setError("");
  };

  const applyCustomPercent = () => {
    const p = parseFloat(customPct);
    if (!Number.isFinite(p) || p < 0 || p > 95) {
      setError("Enter a discount between 0 and 95%.");
      return;
    }
    applyDiscountPercent(p);
  };

  const handleSave = async () => {
    setError("");
    setDone(false);
    const token = await getValidToken();
    if (!token) return;
    if (!fareLocked && !fare.trim()) {
      setError("Selling fare is required.");
      return;
    }
    setSaving(true);
    try {
      if (fareLocked) {
        await operatorApi.updateSchedule(token, id, {
          operator_promo_title: operatorPromoTitle.trim(),
          operator_offer_style: operatorOfferStyle || "",
        });
      } else {
        const sm = (schedule.bus as { seat_map?: { labels?: string[]; types?: string[] } })?.seat_map;
        const bookable = bookableLabelsFromSeatMap(sm);
        const seat_fares = buildSeatFareOverrides(bookable, seatFareInputs, fare.trim());
        await operatorApi.updateSchedule(token, id, {
          fare: fare.trim(),
          ...(fareOriginal.trim() ? { fare_original: fareOriginal.trim() } : { fare_original: null }),
          operator_promo_title: operatorPromoTitle.trim(),
          operator_offer_style: operatorOfferStyle || "",
          seat_fares,
        });
      }
      setDone(true);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !schedule) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-slate-500">
        {error ? <p className="text-amber-800">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  const route = schedule.route as { origin?: string; destination?: string };
  const fareEditable = schedule.fare_editable !== false;
  const fareLocked = !fareEditable;
  const seatMapForLabels = (schedule.bus as { seat_map?: { labels?: string[]; types?: string[] } })?.seat_map;
  const bookableSeatLabels = bookableLabelsFromSeatMap(seatMapForLabels);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <Link
          href="/operator/schedules"
          className="text-sm text-slate-600 hover:text-indigo-600 dark:text-slate-400"
        >
          ← All schedules
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Pricing & offers</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {route.origin} → {route.destination}
        </p>
      </div>

      {schedule.status === "PENDING" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          This trip is <strong>pending approval</strong>. Pricing you set here will apply once an admin marks it{" "}
          <strong>ACTIVE</strong> — then passengers see it on search.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          This trip is <strong>live</strong>. Saving updates what passengers see on the next refresh (unless pricing
          is locked).
        </div>
      )}

      {fareLocked ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          <strong>Pricing is locked.</strong> This schedule has {schedule.confirmed_bookings_count ?? "one or more"}{" "}
          confirmed booking(s). Selling fare and MRP can&apos;t change — you can still update how offers &amp; ribbons
          look below.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Fares</CardTitle>
          <CardDescription>
            MRP / original fare shows struck-through when it&apos;s higher than the selling fare — same as &quot;was
            ₹899, now ₹749&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fare">Selling fare (₹) *</Label>
              <Input
                id="fare"
                type="text"
                inputMode="decimal"
                value={fare}
                onChange={(e) => setFare(e.target.value)}
                disabled={fareLocked}
                className="font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fare_original">MRP / list price (optional)</Label>
              <Input
                id="fare_original"
                type="text"
                inputMode="decimal"
                value={fareOriginal}
                onChange={(e) => setFareOriginal(e.target.value)}
                disabled={fareLocked}
                placeholder="Higher anchor price"
              />
            </div>
          </div>

          {!fareLocked ? (
            <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
                Quick discount
              </p>
              <p className="text-xs text-indigo-800/90 dark:text-indigo-300/90">
                Applies to MRP if set; otherwise uses your current selling fare as the &quot;before&quot; price and
                updates both lines.
              </p>
              <div className="flex flex-wrap gap-2">
                {DISCOUNT_PRESETS.map((pct) => (
                  <Button key={pct} type="button" variant="secondary" size="sm" onClick={() => applyDiscountPercent(pct)}>
                    {pct}% off
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="custom_pct" className="text-xs">
                    Custom %
                  </Label>
                  <Input
                    id="custom_pct"
                    className="h-9 w-20"
                    value={customPct}
                    onChange={(e) => setCustomPct(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="mb-0.5" onClick={applyCustomPercent}>
                  Apply
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!fareLocked && bookableSeatLabels.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Per-seat pricing</CardTitle>
            <CardDescription>
              Charge different amounts per seat (e.g. lower vs upper, window vs aisle). Prices shown to passengers on
              each berth/seat. Only seats that differ from the <strong>base selling fare</strong> above are stored as
              overrides — others use the base fare automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const b = fare.trim() || "0";
                  setSeatFareInputs((prev) => {
                    const n = { ...prev };
                    for (const lb of bookableSeatLabels) n[lb] = b;
                    return n;
                  });
                }}
              >
                Fill all with base fare
              </Button>
            </div>
            <div className="max-h-[min(380px,55vh)] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-xs dark:bg-slate-800">
                  <tr>
                    <th className="p-2 font-medium">Seat</th>
                    <th className="p-2 font-medium">Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {bookableSeatLabels.map((lb) => (
                    <tr key={lb} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-2 font-mono text-xs">{lb}</td>
                      <td className="p-2">
                        <Input
                          className="h-8 max-w-[120px]"
                          value={seatFareInputs[lb] ?? ""}
                          onChange={(e) =>
                            setSeatFareInputs((prev) => ({ ...prev, [lb]: e.target.value }))
                          }
                          inputMode="decimal"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How it looks to passengers</CardTitle>
          <CardDescription>
            Offer line appears on the bus card. Style adds colour and motion — use both for the strongest effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="promo">Offer line</Label>
            <Input
              id="promo"
              value={operatorPromoTitle}
              onChange={(e) => setOperatorPromoTitle(e.target.value)}
              placeholder='e.g. "Flat 15% off — book in the next 24h"'
            />
          </div>
          <div className="space-y-2">
            <Label>Offer spotlight style</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {OFFER_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value || "none"}
                  type="button"
                  onClick={() => setOperatorOfferStyle(opt.value)}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    (operatorOfferStyle || "") === opt.value
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/30 dark:bg-indigo-950/40"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700",
                  )}
                >
                  <span className="mt-0.5 text-indigo-600">{opt.icon}</span>
                  <span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Saved. Passengers will see updated pricing on the schedules page.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" disabled={saving} onClick={handleSave} className="min-w-[200px]">
          {saving ? "Saving…" : fareLocked ? "Save offer display" : "Save & go live"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/operator/schedules">Cancel</Link>
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        {fareLocked
          ? "Offer text and style save to this trip immediately for active schedules."
          : '"Go live" saves pricing and offers to this trip. Active trips update for passengers immediately; pending trips show new pricing after approval.'}
      </p>
    </div>
  );
}
