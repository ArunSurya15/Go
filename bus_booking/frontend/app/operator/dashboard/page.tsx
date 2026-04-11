"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type DashboardStats, type DashboardTripRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Bus, TrendingUp, Users, Clock, AlertCircle,
  ChevronRight, BarChart3, RefreshCw, CalendarDays,
  PlusCircle, CalendarPlus, DollarSign, LayoutList,
  UserCog, FileText, MapPin,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}
function fmtRupee(n: number) {
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function FillBar({ pct, sold, total }: { pct: number; sold: number; total: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-indigo-400";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">{sold}/{total}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    CANCELLED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status}
    </span>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, gradient, href,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; gradient: string; href?: string;
}) {
  const inner = (
    <div className={`rounded-2xl p-5 text-white ${gradient} shadow-md h-full flex flex-col justify-between`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
      </div>
      {href && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100">
          View details <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return inner;
}

// ── trip row ──────────────────────────────────────────────────────────────────

function TripRow({ trip, showDate = false }: { trip: DashboardTripRow; showDate?: boolean }) {
  return (
    <Link
      href={`/operator/schedules/${trip.id}/bookings`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {trip.route}
          </span>
          <StatusPill status={trip.status} />
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-slate-500">
            {showDate ? fmtDate(trip.departure_dt) + " · " : ""}{fmtTime(trip.departure_dt)}
          </span>
          {trip.bus_reg && <span className="text-xs text-slate-400">{trip.bus_reg}</span>}
        </div>
      </div>

      <div className="w-28 shrink-0">
        <FillBar pct={trip.fill_pct} sold={trip.seats_sold} total={trip.seats_total} />
        <p className="text-[10px] text-slate-400 text-right mt-0.5">{trip.fill_pct}% full</p>
      </div>

      {trip.revenue !== undefined && (
        <div className="w-20 shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmtRupee(trip.revenue)}</p>
        </div>
      )}

      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
    </Link>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function OperatorDashboardPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<{ name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async (silent = false) => {
    const token = await getValidToken();
    if (!token) { router.replace("/operator/login"); return; }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setErr("");
    try {
      const [p, s] = await Promise.all([
        operatorApi.profile(token),
        operatorApi.dashboardStats(token),
      ]);
      setProfile(p);
      setStats(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getValidToken, router]);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  const kpi = stats?.kpi;

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {profile?.name ? `Good day, ${profile.name.split(" ")[0]} 👋` : "Operator dashboard"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{today}</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {err}
        </div>
      )}

      {/* KPI cards */}
      {kpi && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Today's trips"
            value={String(kpi.trips_today)}
            sub={kpi.trips_today === 0 ? "No departures today" : `${kpi.fill_pct_today}% avg fill rate`}
            icon={Bus}
            gradient="bg-gradient-to-br from-indigo-500 to-violet-600"
          />
          <KpiCard
            label="Seats sold today"
            value={`${fmt(kpi.seats_sold_today)} / ${fmt(kpi.seats_total_today)}`}
            sub={`${kpi.fill_pct_today}% occupancy`}
            icon={Users}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <KpiCard
            label="Revenue today"
            value={fmtRupee(kpi.revenue_today)}
            sub={`This month: ${fmtRupee(kpi.revenue_month)}`}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-amber-500 to-orange-500"
            href="/operator/sales"
          />
          <KpiCard
            label="Pending approval"
            value={String(kpi.pending_approval)}
            sub={kpi.pending_approval === 0 ? "All trips approved" : "Awaiting admin review"}
            icon={Clock}
            gradient={kpi.pending_approval > 0
              ? "bg-gradient-to-br from-rose-500 to-pink-600"
              : "bg-gradient-to-br from-slate-500 to-slate-700"}
            href="/operator/schedules"
          />
        </div>
      )}

      {/* Secondary stats row */}
      {kpi && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
              <Bus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{kpi.total_buses}</p>
              <p className="text-xs text-slate-500">Buses registered</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
              <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{kpi.active_schedules}</p>
              <p className="text-xs text-slate-500">Active upcoming trips</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
              <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmtRupee(kpi.revenue_week)}</p>
              <p className="text-xs text-slate-500">Revenue last 7 days</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's departures */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Today&apos;s departures</h2>
            <p className="text-xs text-slate-500 mt-0.5">Click a trip to view bookings &amp; manifest</p>
          </div>
          <Link href="/operator/schedules" className="text-xs text-indigo-600 hover:underline font-medium">
            All schedules &rarr;
          </Link>
        </div>

        {!stats?.today_trips.length ? (
          <div className="px-5 py-10 text-center">
            <Bus className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No departures scheduled for today.</p>
            <Link href="/operator/schedules/new">
              <Button size="sm" className="mt-4">Add a schedule</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {/* Table header */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
              <span className="flex-1">Route</span>
              <span className="w-28">Fill rate</span>
              <span className="w-20 text-right">Revenue</span>
              <span className="w-4" />
            </div>
            {stats.today_trips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </div>

      {/* Next 7 days */}
      {stats?.week_trips && stats.week_trips.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Next 7 days</h2>
              <p className="text-xs text-slate-500 mt-0.5">Upcoming trips and seat availability</p>
            </div>
            <span className="text-xs text-slate-400">{stats.week_trips.length} trips</span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {stats.week_trips.map((trip) => (
              <TripRow key={trip.id} trip={trip} showDate />
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-100 dark:border-indigo-900 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Quick actions</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Add a bus",       href: "/operator/buses/new",       Icon: PlusCircle,  color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40" },
            { label: "New schedule",    href: "/operator/schedules/new",   Icon: CalendarPlus, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/40" },
            { label: "Sales & revenue", href: "/operator/sales",           Icon: DollarSign,  color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40" },
            { label: "All schedules",   href: "/operator/schedules",       Icon: LayoutList,  color: "text-sky-600 bg-sky-100 dark:bg-sky-900/40" },
            { label: "Boarding manifests", href: "/operator/schedules",    Icon: FileText,    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/40" },
            { label: "Edit profile",    href: "/operator/onboarding",      Icon: UserCog,     color: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
          ].map(({ label, href, Icon, color }) => (
            <Link
              key={href + label}
              href={href}
              className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
              {label}
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-300 group-hover:text-indigo-400 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
