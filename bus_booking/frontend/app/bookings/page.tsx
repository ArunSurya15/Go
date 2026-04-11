"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { booking, type Booking, type CancelPreview } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Calendar, Ticket, X, AlertTriangle, CheckCircle } from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    REFUNDED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
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
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        {!token ? "Please log in." : "Loading bookings…"}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4 pb-16">
      {cancelPreview && cancelBookingId && (
        <CancelModal
          preview={cancelPreview}
          onConfirm={doCancel}
          onClose={() => { setCancelPreview(null); setCancelBookingId(null); }}
          loading={cancelLoading}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Button asChild size="sm"><Link href="/">+ New booking</Link></Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Tabs */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden w-fit">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past & cancelled (${past.length})`}
          </button>
        ))}
      </div>

      {displayed.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-4">{tab === "upcoming" ? "No upcoming trips." : "No past bookings."}</p>
            {tab === "upcoming" && <Button asChild><Link href="/">Search buses</Link></Button>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {displayed.map((b) => {
          const route = b.schedule.route;
          const canCancel = b.status === "CONFIRMED" && !isPast(b.schedule.departure_dt);
          const msg = cancelMsg?.id === b.id ? cancelMsg : null;
          return (
            <Card key={b.id} className={`transition-shadow hover:shadow-md ${b.status === "CANCELLED" || b.status === "REFUNDED" ? "opacity-75" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">
                      {route.origin} → {route.destination}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      PNR: EGO{String(b.id).padStart(7, "0")} · {b.schedule.bus.operator_name}
                    </CardDescription>
                  </div>
                  {statusBadge(b.status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatDt(b.schedule.departure_dt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Bus className="h-3.5 w-3.5 shrink-0" />
                    <span>{b.seats.join(", ")}</span>
                  </div>
                </div>

                {/* Refund info for cancelled bookings */}
                {(b.status === "REFUNDED" || b.status === "CANCELLED") && (
                  <div className={`rounded-lg px-3 py-2 text-xs ${b.status === "REFUNDED" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "bg-slate-50 dark:bg-slate-800 text-slate-500"}`}>
                    {b.status === "REFUNDED" ? "✅ Refund processed" : "❌ Cancelled — no refund"}
                  </div>
                )}

                {/* Cancel message */}
                {msg && (
                  <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600"}`}>
                    {msg.ok ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                    {msg.msg}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-base font-semibold">₹{b.amount}</p>
                  <div className="flex gap-2">
                    {b.status === "CONFIRMED" && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/booking/${b.id}`}><Ticket className="h-3.5 w-3.5 mr-1" />Ticket</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/track?schedule_id=${b.schedule.id}`}>Track</Link>
                        </Button>
                      </>
                    )}
                    {canCancel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => openCancelModal(b.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
