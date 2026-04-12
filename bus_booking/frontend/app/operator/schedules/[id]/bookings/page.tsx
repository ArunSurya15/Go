"use client";

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOperatorSession } from "@/app/operator/operator-session";
import { operatorApi, type OperatorManifestBooking, type Schedule } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function statusPill(s: string) {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium";
  if (s === "CONFIRMED") return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200`;
  if (s === "CANCELLED") return `${base} bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200`;
  if (s === "REFUNDED")  return `${base} bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200`;
}

function payDot(s: string) {
  if (s === "SUCCESS") return "text-emerald-600 dark:text-emerald-400";
  if (s === "FAILED")  return "text-red-600 dark:text-red-400";
  return "text-slate-400";
}

// Parse seat label into [row, col] for natural sort: "2A" < "2B" < "10A"
function parseSeat(label: string): [number, string] {
  const m = label.match(/^(\d+)(.*)$/);
  return m ? [parseInt(m[1], 10), m[2].toUpperCase()] : [0, label.toUpperCase()];
}
function compareSeat(a: string, b: string) {
  const [ar, ac] = parseSeat(a);
  const [br, bc] = parseSeat(b);
  return ar !== br ? ar - br : ac.localeCompare(bc);
}

// Expand a booking into per-seat manifest rows
type ManifestRow = {
  seat: string;
  name: string;
  age: string;
  gender: string;
  phone: string;
  boarding: string;
  drop: string;
  pnr: string;
  status: string;
  payment_status: string;
  booking_id: number;
};

function expandToSeats(bookings: OperatorManifestBooking[]): ManifestRow[] {
  const out: ManifestRow[] = [];
  for (const b of bookings) {
    const seats = b.seats ?? [];
    if (!seats.length) continue;
    for (const seat of seats) {
      const pax = b.passengers.find((p) => p.seat === seat);
      out.push({
        seat,
        name: pax?.name ?? "",
        age: pax?.age ?? "",
        gender: pax?.gender ?? "",
        phone: b.contact_phone ?? "",
        boarding: b.boarding_point_name ?? "",
        drop: b.dropping_point_name ?? "",
        pnr: b.pnr,
        status: b.status,
        payment_status: b.payment_status,
        booking_id: b.id,
      });
    }
  }
  return out.sort((a, b) => compareSeat(a.seat, b.seat));
}

// ─── cancel modal ────────────────────────────────────────────────────────────

function OperatorCancelModal({ title, body, onConfirm, onClose, loading }: {
  title: string;
  body: ReactNode;
  onConfirm: (reason: string, refundPct: number) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const [refundPct, setRefundPct] = useState(100);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {body}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Refund percentage</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={100} step={10} value={refundPct}
                onChange={(e) => setRefundPct(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-12 text-right font-semibold text-indigo-600">{refundPct}%</span>
            </div>
            <p className="text-xs text-slate-400">0% = cancel only, 100% = full refund to passenger</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Reason (optional)</label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800"
              placeholder="e.g. Bus breakdown"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Back</Button>
          <Button variant="destructive" className="flex-1" onClick={() => onConfirm(reason, refundPct)} disabled={loading}>
            {loading ? "Processing…" : "Confirm cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── component ──────────────────────────────────────────────────────────────

type Tab = "manifest" | "bookings";

export default function OperatorScheduleBookingsPage() {
  const params = useParams();
  const router = useRouter();
  const idRaw = params.id;
  const scheduleId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;
  const { getValidToken } = useAuth();
  const { canManageOperations } = useOperatorSession();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [rows, setRows] = useState<OperatorManifestBooking[]>([]);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("manifest");

  // Cancellation state
  const [cancelTarget, setCancelTarget] = useState<{ type: "booking"; bookingId: number } | { type: "schedule" } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(scheduleId)) { setErr("Invalid schedule."); setLoading(false); return; }
    const token = await getValidToken();
    if (!token) { router.replace("/operator/login"); return; }
    setLoading(true); setErr(null);
    try {
      const [s, list] = await Promise.all([
        operatorApi.getSchedule(token, scheduleId),
        operatorApi.scheduleBookings(token, scheduleId),
      ]);
      setSchedule(s);
      setRows(Array.isArray(list) ? list : []);
      setHint(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load bookings.");
      setSchedule(null); setRows([]);
    } finally { setLoading(false); }
  }, [getValidToken, router, scheduleId]);

  useEffect(() => { load(); }, [load]);

  const doExport = async (format: "csv" | "pdf") => {
    if (!Number.isFinite(scheduleId)) return;
    if (!loading && rows.length === 0) {
      setHint("No bookings yet — nothing to export. Come back once passengers have booked.");
      return;
    }
    const token = await getValidToken();
    if (!token) { router.replace("/operator/login"); return; }
    setExporting(format); setErr(null); setHint(null);
    try {
      await operatorApi.downloadManifest(token, { schedule_id: scheduleId, format });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed.");
    } finally { setExporting(null); }
  };

  const doOperatorCancel = async (reason: string, refundPct: number) => {
    if (!cancelTarget) return;
    const token = await getValidToken();
    if (!token) return;
    setCancelLoading(true);
    try {
      if (cancelTarget.type === "booking") {
        const result = await operatorApi.cancelBooking(token, scheduleId, cancelTarget.bookingId, { reason, refund_pct: refundPct });
        setRows((prev) => prev.map((b) => b.id === cancelTarget.bookingId ? { ...b, status: result.status } : b));
        setCancelMsg(`Booking #${cancelTarget.bookingId} cancelled. Refund: ₹${result.refund_amount}`);
      } else {
        const result = await operatorApi.cancelSchedule(token, scheduleId, { reason, refund_pct: refundPct });
        setCancelMsg(`Schedule cancelled. ${result.cancelled_bookings} booking(s) cancelled.`);
        load();
      }
    } catch (e) {
      setCancelMsg(`Error: ${e instanceof Error ? e.message : "Cancellation failed."}`);
    } finally {
      setCancelLoading(false);
      setCancelTarget(null);
    }
  };

  const route = schedule?.route as { origin?: string; destination?: string } | undefined;
  const manifestRows = useMemo(() => expandToSeats(rows), [rows]);
  const totalSeats = manifestRows.length;
  const confirmed = rows.filter((b) => b.status === "CONFIRMED");
  const totalRevenue = confirmed.reduce((s, b) => s + parseFloat(b.amount || "0"), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">

      {/* Cancel modal */}
      {cancelTarget && canManageOperations && (
        <OperatorCancelModal
          title={cancelTarget.type === "schedule" ? "Cancel entire schedule" : "Cancel booking"}
          body={
            cancelTarget.type === "schedule" ? (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                This will cancel <strong>all active bookings</strong> on this schedule and trigger refunds.
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This will cancel booking #{(cancelTarget as { type: "booking"; bookingId: number }).bookingId} and process the refund.
              </p>
            )
          }
          onConfirm={doOperatorCancel}
          onClose={() => setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}

      {/* Header */}
      <div>
        <Link href="/operator/schedules" className="text-sm text-slate-500 hover:text-indigo-600">
          ← All schedules
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bookings & manifest</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {route ? `${route.origin} → ${route.destination}` : loading ? "Loading…" : "Trip"}
              {schedule ? ` · ${formatDt(schedule.departure_dt)}` : ""}
            </p>
            {schedule && canManageOperations ? (
              <Link href={`/operator/schedules/${schedule.id}/edit`} className="mt-1.5 inline-block text-sm text-indigo-600 hover:underline">
                Edit pricing & offers
              </Link>
            ) : null}
          </div>
          {canManageOperations && !loading && rows.filter((b) => b.status === "CONFIRMED").length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400"
              onClick={() => { setCancelMsg(null); setCancelTarget({ type: "schedule" }); }}
            >
              Cancel schedule
            </Button>
          )}
        </div>
      </div>

      {/* Stats + Export */}
      {!loading && rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Bookings</p>
              <p className="mt-1 text-2xl font-bold text-indigo-700 dark:text-indigo-300">{rows.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Seats sold</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalSeats}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 dark:bg-slate-900/40">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Revenue (confirmed)</p>
              <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                ₹{totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Errors / hints / cancel feedback */}
      {cancelMsg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{cancelMsg}</p>
      ) : null}
      {hint ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200">{hint}</p>
      ) : null}
      {err ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{err}</p>
      ) : null}

      {/* Tab bar + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-0">
        <div className="flex gap-0">
          {(["manifest", "bookings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
                tab === t
                  ? "border-indigo-600 text-indigo-700 dark:text-indigo-300 dark:border-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {t === "manifest" ? "Boarding manifest" : "Booking details"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || loading} onClick={() => doExport("csv")}>
            {exporting === "csv" ? "Preparing…" : "↓ CSV"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || loading} onClick={() => doExport("pdf")}>
            {exporting === "pdf" ? "Preparing…" : "↓ PDF"}
          </Button>
        </div>
      </div>

      {/* ── MANIFEST TAB ── */}
      {tab === "manifest" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Boarding manifest</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${totalSeats} seat${totalSeats !== 1 ? "s" : ""} · sorted by seat number. Hand this to the conductor.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="px-6 pb-6 text-sm text-slate-500">Loading…</p>
            ) : manifestRows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-slate-500">No bookings yet for this trip.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                      <th className="px-4 py-2.5 text-left w-16">Seat</th>
                      <th className="px-4 py-2.5 text-left">Passenger</th>
                      <th className="px-4 py-2.5 text-left">Age / Gender</th>
                      <th className="px-4 py-2.5 text-left">Contact</th>
                      <th className="px-4 py-2.5 text-left">Boarding</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-left">PNR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {manifestRows.map((r, i) => (
                      <tr
                        key={`${r.booking_id}-${r.seat}`}
                        className={cn(
                          "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors",
                          i % 2 === 0 ? "" : "bg-slate-50/30 dark:bg-slate-900/20"
                        )}
                      >
                        <td className="px-4 py-2.5 font-mono font-bold text-indigo-700 dark:text-indigo-300">{r.seat}</td>
                        <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">
                          {r.name || <span className="italic text-slate-400">Not provided</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {[r.age, r.gender].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{r.phone || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{r.boarding || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={statusPill(r.status)}>{r.status}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.pnr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── BOOKINGS TAB ── */}
      {tab === "bookings" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Booking details</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${rows.length} booking${rows.length !== 1 ? "s" : ""} — full contact, payment, and order info.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="px-6 pb-6 text-sm text-slate-500">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-slate-500">No bookings yet for this trip.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((b) => (
                  <div key={b.id} className="px-6 py-5 space-y-3">
                    {/* PNR + badges + amount + date + cancel */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300">{b.pnr}</span>
                      <span className={statusPill(b.status)}>{b.status}</span>
                      <span className={cn("text-xs font-semibold", payDot(b.payment_status))}>
                        {b.payment_status || "No payment"}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">₹{b.amount}</span>
                      <span className="text-xs text-slate-400">{formatDt(b.created_at)}</span>
                      <div className="ml-auto">
                        {canManageOperations && b.status === "CONFIRMED" && (
                          <button
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            onClick={() => { setCancelMsg(null); setCancelTarget({ type: "booking", bookingId: b.id }); }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Seat chips */}
                    {b.seats?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {b.seats.map((s) => (
                          <span key={s} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{s}</span>
                        ))}
                      </div>
                    ) : null}

                    {/* Meta fields */}
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Contact</p>
                        <p className="text-slate-700 dark:text-slate-300">{b.contact_phone || "—"}</p>
                      </div>
                      {b.boarding_point_name ? (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Boarding</p>
                          <p className="text-slate-700 dark:text-slate-300">{b.boarding_point_name}</p>
                        </div>
                      ) : null}
                      {b.dropping_point_name ? (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Drop</p>
                          <p className="text-slate-700 dark:text-slate-300">{b.dropping_point_name}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Booker</p>
                        <p className="text-slate-700 dark:text-slate-300">{b.booker_email || "—"}</p>
                        {b.booker_phone ? <p className="text-xs text-slate-500">{b.booker_phone}</p> : null}
                      </div>
                      {b.gateway_order_id ? (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order ID</p>
                          <p className="font-mono text-xs text-slate-500">{b.gateway_order_id}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-sm">
        <Link href="/operator/dashboard" className="text-indigo-600 hover:underline">← Dashboard</Link>
      </p>
    </div>
  );
}
