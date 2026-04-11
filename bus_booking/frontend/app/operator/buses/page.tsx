"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorBus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Bus, Edit, PlusCircle, Users } from "lucide-react";

export default function OperatorBusesPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [buses, setBuses] = useState<OperatorBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const token = await getValidToken();
      if (!token) { router.replace("/operator/login"); return; }
      try {
        setBuses(await operatorApi.buses(token));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load buses.");
      } finally {
        setLoading(false);
      }
    })();
  }, [getValidToken, router]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/operator/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">My buses</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Fleet list, seat counts, and quick edits.</p>
        </div>
        <Button asChild className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-violet-700">
          <Link href="/operator/buses/new">
            <PlusCircle className="mr-1.5 h-4 w-4" />
            Add bus
          </Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="h-9 w-9 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin dark:border-indigo-900 dark:border-t-indigo-400" />
          <p className="text-sm font-medium text-slate-500">Loading your fleet…</p>
        </div>
      ) : buses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-indigo-200/60 bg-gradient-to-b from-white/90 to-indigo-50/40 px-6 py-16 text-center dark:border-indigo-900/40 dark:from-slate-900/80 dark:to-indigo-950/20">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/50">
            <Bus className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">No buses yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Add your first vehicle to attach seat maps and run schedules.
          </p>
          <Button asChild className="mt-6 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-md">
            <Link href="/operator/buses/new">Add your first bus</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map((bus) => {
            const features = (bus.features || []) as Array<{ id: string; label: string } | string>;
            const featureLabels = features.map((f) => typeof f === "string" ? f : f.label);
            return (
              <div
                key={bus.id}
                className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/40">
                  <Bus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{bus.registration_no}</p>
                      {(bus as { service_name?: string }).service_name && (
                        <p className="text-sm text-slate-500">{(bus as { service_name?: string }).service_name}</p>
                      )}
                    </div>
                    <Link
                      href={`/operator/buses/${bus.id}/edit`}
                      className="flex items-center gap-1.5 rounded-full border border-indigo-200/90 bg-indigo-50/50 px-3.5 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />{bus.capacity} seats
                    </span>
                    {featureLabels.slice(0, 4).map((f, i) => (
                      <span key={i} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs">{f}</span>
                    ))}
                    {featureLabels.length > 4 && (
                      <span className="text-xs text-slate-400">+{featureLabels.length - 4} more</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
