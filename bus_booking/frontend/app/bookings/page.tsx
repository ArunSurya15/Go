"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { booking, downloadBookingTicketPdf, type Booking, type CancelPreview } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TicketBusIcon } from "@/components/icons/ticket-bus-icon";
import { EgoTicketSheet } from "@/components/ticket/ego-ticket-sheet";
import {
  Bus,
  Calendar,
  Download,
  MapPin,
  Plus,
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    CONFIRMED:
      "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700/30 dark:bg-emerald-600 dark:text-white dark:ring-emerald-500/40",
    PENDING:
      "bg-amber-500/12 text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25",
    CANCELLED: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
    REFUNDED: "bg-sky-500/12 text-sky-900 ring-1 ring-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/25",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        map[status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatTripWhen(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
  };
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

/** Two map pins linked by a winding route (journey / live track). */
function TrackRouteGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-sky-800 dark:text-sky-200", className)}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M 5.35 8.55 C 10.2 8.35 11.5 10.8 9.85 12.85 C 8.35 14.7 12.8 16.1 16.65 16.55"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5.35" cy="8.55" r="0.72" fill="currentColor" />
      <circle cx="16.65" cy="16.55" r="0.72" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" strokeLinecap="round">
        <path
          fill="none"
          d="M 5.35 2.55 c-1.22 0-2.2.98-2.2 2.2 0 1.85 2.2 4.45 2.2 4.45 s2.2-2.6 2.2-4.45 c0-1.22-.98-2.2-2.2-2.2z"
        />
        <circle cx="5.35" cy="4.75" r="0.88" fill="none" />
      </g>
      <g stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" strokeLinecap="round">
        <path
          fill="none"
          d="M 16.65 10.55 c-1.22 0-2.2.98-2.2 2.2 0 1.85 2.2 4.45 2.2 4.45 s2.2-2.6 2.2-4.45 c0-1.22-.98-2.2-2.2-2.2z"
        />
        <circle cx="16.65" cy="12.75" r="0.88" fill="none" />
      </g>
    </svg>
  );
}

/** Minimal trip actions — no gold/amber, no heavy gradients. */
const tripActionBtn = cn(
  "h-9 gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700",
  "shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2",
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700/80"
);

const tripActionIconClass = "h-4 w-4 text-slate-500 dark:text-slate-400";

// ── cancel modal ──────────────────────────────────────────────────────────────

function CancelModal({ preview, onConfirm, onClose, loading }: {
  preview: CancelPreview;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const refund = parseFloat(preview.refund_amount);
  const amount = parseFloat(preview.amount);
  const pct = amount > 0 ? Math.round((refund / amount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Cancel booking</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Refund summary */}
        <div className={`rounded-xl p-4 ${refund > 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
          <p className="text-sm font-medium mb-1">
            {preview.refund_tier === "full" && "✅ Full refund"}
            {preview.refund_tier === "partial" && `⚡ Partial refund (${pct}%)`}
            {preview.refund_tier === "none" && "⚠️ No refund"}
          </p>
          {refund > 0 ? (
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">₹{refund.toFixed(2)}</p>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Your trip departs in {preview.hours_until_departure}h — below the refund window.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Paid: ₹{amount.toFixed(2)} · {preview.hours_until_departure}h until departure
          </p>
        </div>

        {/* Policy reminder */}
        <div className="text-xs text-slate-500 space-y-0.5">
          <p className="font-medium">Refund policy:</p>
          <p>· &gt;{preview.policy.full_refund_hours}h before departure → 100% refund</p>
          <p>· {preview.policy.partial_refund_hours}–{preview.policy.full_refund_hours}h → {preview.policy.partial_refund_pct}% refund</p>
          <p>· &lt;{preview.policy.partial_refund_hours}h → no refund</p>
          <Link href="/cancellation-policy" target="_blank" className="text-indigo-500 hover:underline inline-block pt-1">
            Full cancellation policy →
          </Link>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reason (optional)</label>
          <input
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800"
            placeholder="e.g. Change of plans"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Keep booking</Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => onConfirm(reason)}
            disabled={loading}
          >
            {loading ? "Cancelling…" : "Yes, cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function MyBookingsPage() {
  const router = useRouter();
  const { token, getValidToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  // Cancel state
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const [ticketSheet, setTicketSheet] = useState<Booking | null>(null);
  const [downloadBusyId, setDownloadBusyId] = useState<number | null>(null);

  const handleDownloadPdf = async (id: number) => {
    const t = await getValidToken();
    if (!t) return;
    setDownloadBusyId(id);
    setError("");
    try {
      await downloadBookingTicketPdf(t, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloadBusyId(null);
    }
  };

  const load = useCallback(async () => {
    const t = await getValidToken();
    if (!t) { router.replace("/login"); return; }
    try {
      const b = await booking.list(t);
      setBookings(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [getValidToken, router]);

  useEffect(() => { load(); }, [load]);

  const openCancelModal = async (id: number) => {
    setCancelMsg(null);
    const t = await getValidToken();
    if (!t) return;
    try {
      const preview = await booking.cancelPreview(t, id);
      if (!preview.cancellation_allowed) {
        setCancelMsg({ id, msg: preview.cancellation_blocked_reason, ok: false });
        return;
      }
      setCancelBookingId(id);
      setCancelPreview(preview);
    } catch (e) {
      setCancelMsg({ id, msg: e instanceof Error ? e.message : "Could not load cancellation info.", ok: false });
    }
  };

  const doCancel = async (reason: string) => {
    if (!cancelBookingId) return;
    const t = await getValidToken();
    if (!t) return;
    setCancelLoading(true);
    try {
      const result = await booking.cancel(t, cancelBookingId, reason);
      setBookings((prev) =>
        prev.map((b) => b.id === cancelBookingId ? { ...b, status: result.status } : b)
      );
      setCancelPreview(null);
      setCancelBookingId(null);
      const refund = parseFloat(result.refund_amount);
      setCancelMsg({
        id: cancelBookingId,
        msg: refund > 0 ? `Booking cancelled. Refund of ₹${refund.toFixed(2)} will be processed in 5–7 business days.` : "Booking cancelled. No refund applicable.",
        ok: true,
      });
    } catch (e) {
      setCancelMsg({ id: cancelBookingId, msg: e instanceof Error ? e.message : "Cancellation failed.", ok: false });
      setCancelPreview(null);
      setCancelBookingId(null);
    } finally {
      setCancelLoading(false);
    }
  };

  const upcoming = bookings.filter((b) => !isPast(b.schedule.departure_dt) && b.status !== "CANCELLED" && b.status !== "REFUNDED");
  const past = bookings.filter((b) => isPast(b.schedule.departure_dt) || b.status === "CANCELLED" || b.status === "REFUNDED");
  const displayed = tab === "upcoming" ? upcoming : past;

  if (!token || loading) {
    return (
      <div className="container mx-auto flex min-h-[40vh] max-w-3xl flex-col items-center justify-center gap-3 px-4 py-16 text-muted-foreground">
        {!token ? (
          "Please log in."
        ) : (
          <>
            <div className="h-9 w-9 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin dark:border-indigo-900 dark:border-t-indigo-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading your trips…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8 pb-20">
      <EgoTicketSheet
        booking={ticketSheet}
        open={!!ticketSheet}
        onClose={() => setTicketSheet(null)}
        onDownloadPdf={() => ticketSheet && void handleDownloadPdf(ticketSheet.id)}
        downloading={ticketSheet ? downloadBusyId === ticketSheet.id : false}
      />
      {cancelPreview && cancelBookingId && (
        <CancelModal
          preview={cancelPreview}
          onConfirm={doCancel}
          onClose={() => { setCancelPreview(null); setCancelBookingId(null); }}
          loading={cancelLoading}
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" aria-hidden />
            Your bookings
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">My Trips</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tickets, live tracking, and cancellations in one place.</p>
        </div>
        <Button
          asChild
          className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 font-semibold shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-violet-700"
        >
          <Link href="/" className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" aria-hidden />
            New booking
          </Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="inline-flex rounded-full border border-slate-200/90 bg-slate-50/80 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-900/60">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-all",
              tab === t
                ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            {t === "upcoming" ? (
              <>
                Upcoming <span className="ml-1 tabular-nums text-slate-400 dark:text-slate-500">({upcoming.length})</span>
              </>
            ) : (
              <>
                Past &amp; cancelled{" "}
                <span className="ml-1 tabular-nums text-slate-400 dark:text-slate-500">({past.length})</span>
              </>
            )}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Past &amp; cancelled shows your <span className="font-semibold text-slate-500 dark:text-slate-400">10 most recent</span> trips.
        Older bookings stay on record; contact support if you need history beyond that.
      </p>

      {displayed.length === 0 && (
        <div className="rounded-2xl border border-dashed border-indigo-200/60 bg-gradient-to-b from-white to-indigo-50/40 px-6 py-14 text-center dark:border-indigo-900/40 dark:from-slate-900 dark:to-indigo-950/20">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-indigo-200 dark:text-indigo-900" />
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {tab === "upcoming" ? "No upcoming trips" : "No past bookings here"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {tab === "upcoming" ? "Book a bus from the home page — your trips will show up here." : "When trips finish or you cancel, they appear in this tab."}
          </p>
          {tab === "upcoming" && (
            <Button asChild className="mt-6 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-md">
              <Link href="/">Search buses</Link>
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {displayed.map((b) => {
          const route = b.schedule.route;
          const bus = b.schedule.bus;
          const serviceLine = (bus.service_name || "").trim();
          const when = formatTripWhen(b.schedule.departure_dt);
          const canCancel = b.status === "CONFIRMED" && !isPast(b.schedule.departure_dt);
          const msg = cancelMsg?.id === b.id ? cancelMsg : null;
          const muted = b.status === "CANCELLED" || b.status === "REFUNDED";
          return (
            <div
              key={b.id}
              className={cn(
                "overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm ring-1 ring-slate-200/40 transition-all hover:border-indigo-200/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/50 dark:hover:border-indigo-900/50",
                muted && "opacity-[0.88]"
              )}
            >
              <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5 sm:pt-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {route.origin} → {route.destination}
                  </p>
                  {serviceLine ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{serviceLine}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-500">
                    PNR EGO{String(b.id).padStart(7, "0")} · {bus.operator_name}
                  </p>
                </div>
                {statusBadge(b.status)}
              </div>

              <div className="grid grid-cols-1 gap-2 border-y border-slate-100/90 bg-slate-50/50 px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950/30 sm:grid-cols-2 sm:px-5">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800">
                    <Calendar className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  </span>
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{when.date}</span>
                    <span className="text-slate-400"> · {when.time}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 sm:justify-end">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800 sm:order-2">
                    <Bus className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                  </span>
                  <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200 sm:order-1">{b.seats.join(", ")}</span>
                </div>
              </div>

              {(b.status === "REFUNDED" || b.status === "CANCELLED") && (
                <div
                  className={cn(
                    "mx-4 mt-2 rounded-xl px-3 py-2 text-xs sm:mx-5",
                    b.status === "REFUNDED"
                      ? "bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400"
                  )}
                >
                  {b.status === "REFUNDED" ? "Refund processed" : "Cancelled — no refund"}
                </div>
              )}

              {msg && (
                <div
                  className={cn(
                    "mx-4 mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs sm:mx-5",
                    msg.ok
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-200"
                      : "bg-red-50 text-red-700 dark:bg-red-950/25 dark:text-red-300"
                  )}
                >
                  {msg.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                  {msg.msg}
                </div>
              )}

              <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
                <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">₹{b.amount}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {b.status === "CONFIRMED" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={tripActionBtn}
                        onClick={() => setTicketSheet(b)}
                      >
                        <TicketBusIcon className="h-[18px] w-[18px]" />
                        Show ticket
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={tripActionBtn}
                        disabled={downloadBusyId === b.id}
                        onClick={() => void handleDownloadPdf(b.id)}
                      >
                        <Download className={tripActionIconClass} aria-hidden />
                        PDF
                      </Button>
                      {!isPast(b.schedule.departure_dt) && (
                        <Button variant="ghost" size="sm" asChild className={tripActionBtn}>
                          <Link href={`/track?schedule_id=${b.schedule.id}`} className="inline-flex items-center gap-2">
                            <TrackRouteGlyph className="h-[18px] w-[18px] text-slate-500 dark:text-slate-400" />
                            Track
                          </Link>
                        </Button>
                      )}
                    </>
                  )}
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      onClick={() => openCancelModal(b.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
