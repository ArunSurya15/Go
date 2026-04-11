"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi, type Schedule } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatorBusSeatPreview } from "@/components/admin/operator-bus-seat-preview";
import { BUS_FEATURES_FALLBACK } from "@/lib/bus-features";
import { Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ScheduleBusPanel({ schedule }: { schedule: Schedule }) {
  const [open, setOpen] = useState(false);
  const bus = schedule.bus as {
    registration_no?: string;
    operator_name?: string;
    service_name?: string;
    capacity?: number;
    features?: string[];
    seat_map?: Record<string, unknown>;
  };
  const labels = new Map(BUS_FEATURES_FALLBACK.map((f) => [f.id, f.label]));
  const sm = bus.seat_map;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-100/80 dark:hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-slate-700 dark:text-slate-300">
          Bus <strong>{bus.registration_no}</strong>
          {bus.capacity != null ? ` · ${bus.capacity} seats` : ""}
          {bus.service_name ? ` · ${bus.service_name}` : ""}
        </span>
        <span className="text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center gap-1 text-xs font-medium">
          {open ? (
            <>Hide layout <ChevronUp className="h-4 w-4" /></>
          ) : (
            <>View seat layout <ChevronDown className="h-4 w-4" /></>
          )}
        </span>
      </button>
      {bus.features && bus.features.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {bus.features.map((fid) => (
            <span
              key={fid}
              className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300"
            >
              {labels.get(fid) ?? fid}
            </span>
          ))}
        </div>
      )}
      {open && sm && Object.keys(sm).length > 0 && (
        <div className="px-2 pb-3 border-t border-slate-200 dark:border-slate-700 pt-2">
          <OperatorBusSeatPreview seatMap={sm} />
        </div>
      )}
    </div>
  );
}

export default function AdminSchedulesPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = await getValidToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setLoading(true);
    try {
      setRows(await adminApi.pendingSchedules(token));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getValidToken, router]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: number) => {
    setBusyId(id);
    setMsg(null);
    const token = await getValidToken();
    if (!token) return;
    try {
      await adminApi.approveSchedule(token, id);
      setMsg({ type: "ok", text: "Schedule approved and is now bookable." });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed." });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: number) => {
    if (!confirm("Reject this schedule? It will be marked cancelled and hidden from passengers.")) return;
    setBusyId(id);
    setMsg(null);
    const token = await getValidToken();
    if (!token) return;
    try {
      await adminApi.rejectSchedule(token, id);
      setMsg({ type: "ok", text: "Schedule rejected." });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pending schedules</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          New or unverified operators create trips as PENDING until you approve. Verified operators publish trips as
          ACTIVE automatically. Expand each row to check the bus seat map before approving.
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Approval queue</CardTitle>
          <CardDescription>{loading ? "Loading…" : `${rows.length} pending trip${rows.length !== 1 ? "s" : ""}`}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-500">No schedules waiting for approval.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((s) => {
                const route = s.route as { origin?: string; destination?: string };
                const bus = s.bus as { registration_no?: string; operator_name?: string };
                const b = busyId === s.id;
                return (
                  <li key={s.id} className="px-6 py-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {route.origin} → {route.destination}
                        </p>
                        <p className="text-sm text-slate-500">{fmt(s.departure_dt)}</p>
                        <p className="text-sm mt-1">
                          <span className="text-slate-600 dark:text-slate-400">{bus.operator_name}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="text-slate-600 dark:text-slate-400">{bus.registration_no}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">₹{s.fare}</span>
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" disabled={b} onClick={() => approve(s.id)} className="gap-1">
                          {b ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={b}
                          onClick={() => reject(s.id)}
                          className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                    <ScheduleBusPanel schedule={s} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
