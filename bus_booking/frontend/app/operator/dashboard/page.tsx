"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOperatorSession } from "@/app/operator/operator-session";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  operatorApi,
  type DashboardStats,
  type DashboardTripRow,
  type OperatorProfile,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Bus,
  TrendingUp,
  Users,
  AlertCircle,
  ChevronRight,
  BarChart3,
  RefreshCw,
  CalendarDays,
  PlusCircle,
  CalendarPlus,
  DollarSign,
  LayoutList,
  UserCog,
  FileText,
} from "lucide-react";

function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function routeEnds(t: DashboardTripRow): { origin: string; destination: string } {
  const o = (t.origin ?? "").trim();
  const d = (t.destination ?? "").trim();
  if (o && d) return { origin: o, destination: d };
  const parts = (t.route || "").split("→").map((s) => s.trim());
  return { origin: parts[0] || "", destination: parts[1] || "" };
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function SummaryTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/80">
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400 opacity-90"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
    </div>
  );
}

function tripStatusPillClass(status: string) {
  if (status === "ACTIVE")
    return "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (status === "PENDING")
    return "bg-amber-500/15 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200";
  return "bg-slate-200/80 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300";
}

/** Dense row; route on first line, bus type (+ reg) below. Scroll horizontally on narrow viewports. */
function TripTableRow({ trip, showDate = false }: { trip: DashboardTripRow; showDate?: boolean }) {
  const lowOcc = trip.seats_total > 0 && trip.fill_pct < 20;
  const ref = trip.service_ref ?? `EGO-${trip.id}`;
  const asp = trip.asp != null && trip.seats_sold > 0 ? fmtRupee(trip.asp) : "—";
  const busType = (trip.service_type ?? "").trim();
  const reg = (trip.bus_reg ?? "").trim();
  const typeSubtitle =
    busType && reg ? `${busType} · ${reg}` : busType || reg || (trip.service_line || "").trim() || "";

  return (
    <Link
      href={`/operator/schedules/${trip.id}/bookings`}
      className="group grid grid-cols-12 items-start gap-x-2 border-b border-slate-100 px-3 py-1.5 text-xs leading-tight transition-colors hover:bg-slate-50/90 dark:border-slate-800/80 dark:hover:bg-slate-800/50 md:gap-x-2"
    >
      <div className="col-span-2 shrink-0 self-center font-mono text-[11px] text-slate-500 dark:text-slate-400">{ref}</div>
      <div className="col-span-3 min-w-0">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{trip.route}</p>
        {typeSubtitle ? (
          <p className="mt-0.5 truncate text-[11px] font-normal text-slate-500 dark:text-slate-400">{typeSubtitle}</p>
        ) : null}
      </div>
      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 self-center text-slate-600 dark:text-slate-400">
        {showDate ? <span className="shrink-0 text-[11px] text-slate-500">{fmtDate(trip.departure_dt)}</span> : null}
        <span className="shrink-0 font-medium tabular-nums text-slate-800 dark:text-slate-200">{fmtTime(trip.departure_dt)}</span>
        <span
          className={`shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide ${tripStatusPillClass(trip.status)}`}
        >
          {trip.status}
        </span>
      </div>
      <div className="col-span-1 self-center text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">
        {trip.revenue != null ? fmtRupee(trip.revenue) : "—"}
      </div>
      <div
        className={`col-span-2 self-center text-right tabular-nums ${lowOcc ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}
      >
        {trip.fill_pct}%
        <span className="font-normal text-slate-500 dark:text-slate-500"> ({trip.seats_sold}/{trip.seats_total})</span>
      </div>
      <div className="col-span-1 self-center text-right tabular-nums text-slate-700 dark:text-slate-300">{asp}</div>
      <div className="col-span-1 flex justify-end self-center">
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-indigo-500 dark:text-slate-600" />
      </div>
    </Link>
  );
}

function TripTableHeader() {
  return (
    <div className="grid grid-cols-12 gap-x-2 border-b border-slate-200/90 bg-slate-50/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
      <span className="col-span-2">Service ID</span>
      <span className="col-span-3 leading-tight">
        <span className="block">Route</span>
        <span className="mt-0.5 block text-[9px] font-semibold normal-case tracking-normal text-slate-400 dark:text-slate-500">
          Bus type
        </span>
      </span>
      <span className="col-span-2">Departure</span>
      <span className="col-span-1 text-right">Revenue</span>
      <span className="col-span-2 text-right">Occupancy</span>
      <span className="col-span-1 text-right">ASP</span>
      <span className="col-span-1 text-right">Open</span>
    </div>
  );
}

export default function OperatorDashboardPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const { canManageOperations, canManageCompany } = useOperatorSession();
  const [staffNotice, setStaffNotice] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [summaryDate, setSummaryDate] = useState(localYMD);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [fOrigin, setFOrigin] = useState("");
  const [fDest, setFDest] = useState("");
  const [fServiceId, setFServiceId] = useState("");
  const [fBusType, setFBusType] = useState("");
  const [fStatus, setFStatus] = useState("");

  const load = useCallback(
    async (silent = false) => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setErr("");
      try {
        const [p, s] = await Promise.all([
          operatorApi.profile(token),
          operatorApi.dashboardStats(token, { date: summaryDate }),
        ]);
        setProfile(p);
        setStats(s);
        setLastUpdated(
          new Date().toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getValidToken, router, summaryDate]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "staff") {
      setStaffNotice(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setFOrigin("");
    setFDest("");
    setFServiceId("");
    setFBusType("");
    setFStatus("");
  }, [summaryDate]);

  const filterOptions = useMemo(() => {
    const trips = stats?.today_trips ?? [];
    const origins = uniqSorted(trips.map((t) => routeEnds(t).origin));
    const destinations = uniqSorted(trips.map((t) => routeEnds(t).destination));
    const serviceIds = uniqSorted(trips.map((t) => t.service_ref ?? `EGO-${t.id}`));
    const busTypes = uniqSorted(trips.map((t) => (t.service_type ?? "").trim()).filter(Boolean));
    const statuses = uniqSorted(trips.map((t) => t.status));
    return { origins, destinations, serviceIds, busTypes, statuses };
  }, [stats?.today_trips]);

  const filteredTodayTrips = useMemo(() => {
    const trips = stats?.today_trips ?? [];
    return trips.filter((t) => {
      const { origin, destination } = routeEnds(t);
      if (fOrigin && origin !== fOrigin) return false;
      if (fDest && destination !== fDest) return false;
      const ref = t.service_ref ?? `EGO-${t.id}`;
      if (fServiceId && ref !== fServiceId) return false;
      const st = (t.service_type ?? "").trim();
      if (fBusType && st !== fBusType) return false;
      if (fStatus && t.status !== fStatus) return false;
      return true;
    });
  }, [stats?.today_trips, fOrigin, fDest, fServiceId, fBusType, fStatus]);

  const filtersActive = !!(fOrigin || fDest || fServiceId || fBusType || fStatus);

  const quickActions = useMemo(() => {
    const all = [
      { label: "Add a bus", href: "/operator/buses/new", Icon: PlusCircle, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300", tier: "ops" as const },
      { label: "New schedule", href: "/operator/schedules/new", Icon: CalendarPlus, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300", tier: "ops" as const },
      { label: "Sales & revenue", href: "/operator/sales", Icon: DollarSign, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40", tier: "ops" as const },
      { label: "All schedules", href: "/operator/schedules", Icon: LayoutList, color: "text-sky-600 bg-sky-50 dark:bg-sky-900/40", tier: "all" as const },
      { label: "Manifests", href: "/operator/schedules", Icon: FileText, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/40", tier: "all" as const },
      { label: "Team & invites", href: "/operator/team", Icon: Users, color: "text-indigo-700 bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200", tier: "company" as const },
      { label: "Profile & KYC", href: "/operator/onboarding", Icon: UserCog, color: "text-slate-600 bg-slate-100 dark:bg-slate-800", tier: "company" as const },
    ];
    return all.filter(
      (a) =>
        a.tier === "all" ||
        (a.tier === "ops" && canManageOperations) ||
        (a.tier === "company" && canManageCompany)
    );
  }, [canManageOperations, canManageCompany]);

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="relative h-11 w-11">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/30 to-violet-500/30 blur-md" />
          <div className="relative h-11 w-11 rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading your dashboard…</p>
      </div>
    );
  }

  const kpi = stats?.kpi;
  const summaryLabel = stats?.summary_date
    ? new Date(stats.summary_date + "T12:00:00").toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : summaryDate;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Header — redBus-style utility row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {profile?.name ? `${profile.name.split(" ")[0]}, here's your day` : "Operator dashboard"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{todayLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:bg-white hover:text-indigo-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:text-indigo-300"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {staffNotice && !canManageOperations && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          You have <strong className="font-semibold">dispatcher</strong> access: view trips and bookings only. Fare changes and refunds need a manager or owner; company profile and invites are owner-only.
        </div>
      )}

      {/* Action banners (KYC / pending trips) — similar to redBus agreement alerts */}
      {profile?.kyc_status === "PENDING" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200/90 bg-gradient-to-r from-rose-50 to-orange-50 px-4 py-3.5 text-sm text-rose-950 shadow-sm dark:border-rose-900/50 dark:from-rose-950/40 dark:to-orange-950/20 dark:text-rose-100">
          <span className="max-w-3xl leading-relaxed">
            <strong className="font-semibold">KYC pending.</strong> Finish your business profile so we can verify you — you&apos;ll get full publishing once cleared.
            {!canManageCompany && " Ask a business owner to complete onboarding."}
          </span>
          {canManageCompany ? (
            <Link
              href="/operator/onboarding"
              className="shrink-0 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
            >
              Complete profile
            </Link>
          ) : null}
        </div>
      )}
      {kpi && kpi.pending_approval > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3.5 text-sm text-amber-950 shadow-sm dark:border-amber-900/40 dark:from-amber-950/35 dark:to-yellow-950/20 dark:text-amber-100">
          <span>
            <strong className="font-semibold">{kpi.pending_approval}</strong> trip{kpi.pending_approval !== 1 ? "s" : ""} waiting for admin approval before passengers can book.
          </span>
          <Link
            href="/operator/schedules"
            className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            View schedules
          </Link>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {err}
        </div>
      )}

      {/* Today's summary — KPI strip like redBus "Today's sales" / revMax */}
      {kpi && (
        <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white/90 to-slate-50/90 p-4 shadow-md shadow-slate-900/[0.04] backdrop-blur-sm dark:border-slate-800 dark:from-slate-900/90 dark:to-slate-950/80 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Today&apos;s summary</h2>
              <p className="text-xs text-slate-500 mt-1">
                Sales for trips departing on the selected date · e-GO direct channel
                {lastUpdated ? ` · Last updated: ${lastUpdated}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label htmlFor="dash-date" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Date
              </label>
              <DatePickerField
                id="dash-date"
                value={summaryDate}
                onChange={setSummaryDate}
                className="min-w-[10.5rem] sm:min-w-[11rem]"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">Showing: {summaryLabel}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              label="Services running"
              value={`${kpi.trips_active_today} / ${kpi.trips_today}`}
              sub={kpi.trips_today === 0 ? "No trips this day" : "Active / scheduled"}
              icon={Bus}
            />
            <SummaryTile
              label="Seats sold"
              value={`${fmt(kpi.seats_sold_today)} / ${fmt(kpi.seats_total_today)}`}
              sub={`${kpi.fill_pct_today}% occupancy`}
              icon={Users}
            />
            <SummaryTile
              label="Revenue"
              value={fmtRupee(kpi.revenue_today)}
              sub={`This month: ${fmtRupee(kpi.revenue_month)}`}
              icon={TrendingUp}
            />
            <SummaryTile
              label="Avg selling price (ASP)"
              value={kpi.seats_sold_today > 0 ? fmtRupee(Math.round(kpi.asp_today)) : "—"}
              sub={
                kpi.bookings_count_today > 0
                  ? `${fmt(kpi.bookings_count_today)} ticket${kpi.bookings_count_today !== 1 ? "s" : ""} (bookings)`
                  : "No tickets this day"
              }
              icon={DollarSign}
            />
          </div>
        </section>
      )}

      {/* Secondary stats */}
      {kpi && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40">
              <Bus className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{kpi.total_buses}</p>
              <p className="text-xs text-slate-500">Buses registered</p>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/40">
              <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{kpi.active_schedules}</p>
              <p className="text-xs text-slate-500">Active upcoming trips</p>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/40">
              <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmtRupee(kpi.revenue_week)}</p>
              <p className="text-xs text-slate-500">Revenue last 7 days</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's services table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-md shadow-slate-900/[0.04] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Today&apos;s services</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Tap a row for manifest &amp; bookings. After <strong className="font-semibold text-slate-600 dark:text-slate-300">ASP</strong> there is
              only <strong className="font-semibold text-slate-600 dark:text-slate-300">Open</strong> — no hidden columns.
            </p>
          </div>
          <Link
            href="/operator/schedules"
            className="shrink-0 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
          >
            All schedules →
          </Link>
        </div>

        {!stats?.today_trips.length ? (
          <div className="px-5 py-12 text-center">
            <Bus className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No departures on this date.</p>
            {canManageOperations ? (
              <Link href="/operator/schedules/new">
                <Button size="sm" className="mt-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-violet-700">
                  Add a schedule
                </Button>
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Source
                  <select
                    value={fOrigin}
                    onChange={(e) => setFOrigin(e.target.value)}
                    className="h-8 min-w-[6.5rem] max-w-[10rem] rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 sm:max-w-[11rem]"
                  >
                    <option value="">All</option>
                    {filterOptions.origins.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Destination
                  <select
                    value={fDest}
                    onChange={(e) => setFDest(e.target.value)}
                    className="h-8 min-w-[6.5rem] max-w-[10rem] rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 sm:max-w-[11rem]"
                  >
                    <option value="">All</option>
                    {filterOptions.destinations.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Service ID
                  <select
                    value={fServiceId}
                    onChange={(e) => setFServiceId(e.target.value)}
                    className="h-8 min-w-[6.5rem] max-w-[9rem] rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="">All</option>
                    {filterOptions.serviceIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Bus type
                  <select
                    value={fBusType}
                    onChange={(e) => setFBusType(e.target.value)}
                    className="h-8 min-w-[7rem] max-w-[12rem] rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="">All</option>
                    {filterOptions.busTypes.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                    <select
                      value={fStatus}
                      onChange={(e) => setFStatus(e.target.value)}
                      className="h-8 min-w-[5.5rem] rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="">All</option>
                      {filterOptions.statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!filtersActive}
                    onClick={() => {
                      setFOrigin("");
                      setFDest("");
                      setFServiceId("");
                      setFBusType("");
                      setFStatus("");
                    }}
                    className="h-8 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-indigo-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-indigo-400 dark:hover:bg-slate-800"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 sm:self-end sm:text-right">
                {filtersActive ? (
                  <span>
                    Showing {filteredTodayTrips.length} of {stats.today_trips.length}
                  </span>
                ) : (
                  <span className="text-slate-400">{stats.today_trips.length} service(s)</span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <TripTableHeader />
                {filteredTodayTrips.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No services match these filters. Try &quot;Clear filters&quot; or pick another source or destination.
                  </p>
                ) : (
                  filteredTodayTrips.map((trip) => <TripTableRow key={trip.id} trip={trip} />)
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Next 7 days */}
      {stats?.week_trips && stats.week_trips.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-md shadow-slate-900/[0.04] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Next 7 days</h2>
              <p className="text-xs text-slate-500 mt-0.5">Upcoming from today · occupancy preview</p>
            </div>
            <span className="text-xs text-slate-400">{stats.week_trips.length} trips</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <TripTableHeader />
              {stats.week_trips.map((trip) => (
                <TripTableRow key={trip.id} trip={trip} showDate />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick actions */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-white/60 to-indigo-50/40 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900/50 dark:via-slate-950/40 dark:to-indigo-950/20">
        <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Quick actions</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(({ label, href, Icon, color }) => (
            <Link
              key={href + label}
              href={href}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-indigo-800"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
              {label}
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-indigo-500 dark:text-slate-600" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
