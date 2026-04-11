"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi, type AdminStats } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Building2, Bus, CheckCircle } from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      try {
        const s = await adminApi.stats(token);
        if (!cancelled) setStats(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load stats.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getValidToken, router]);

  if (error) {
    return <p className="text-center text-red-600 py-12">{error}</p>;
  }

  if (!stats) {
    return <p className="text-center text-slate-500 py-12">Loading dashboard…</p>;
  }

  const actionTiles = [
    {
      label: "Schedules awaiting approval",
      value: stats.pending_schedules,
      href: "/admin/schedules",
      icon: CalendarClock,
      accent: "from-amber-500 to-orange-500",
    },
    {
      label: "Operators (KYC pending)",
      value: stats.pending_operator_kyc,
      href: "/admin/operators?filter=pending",
      icon: Building2,
      accent: "from-violet-500 to-purple-600",
    },
  ];

  const statTiles = [
    { label: "Registered operators", value: stats.total_operators, icon: Building2, accent: "from-indigo-500 to-blue-600" },
    { label: "Active schedules (live, not archived)", value: stats.active_upcoming_schedules, icon: Bus, accent: "from-emerald-500 to-teal-600" },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Approve new trips and verify operators before they go live on e-GO.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {actionTiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href}>
              <Card className="border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.accent} text-white shadow-sm mb-2`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-3xl font-bold tabular-nums">{t.value}</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">{t.label}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Open →</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {statTiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label} className="border-slate-200 dark:border-slate-800 h-full opacity-95">
              <CardHeader className="pb-2">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.accent} text-white shadow-sm mb-2`}>
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-3xl font-bold tabular-nums">{t.value}</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">{t.label}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card className="border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-indigo-600" />
            Quick actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/admin/schedules"
            className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700"
          >
            Review pending schedules
          </Link>
          <Link
            href="/admin/operators?filter=pending"
            className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
          >
            Review KYC queue
          </Link>
          <Link
            href="/admin/audit"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300"
          >
            View audit log
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
