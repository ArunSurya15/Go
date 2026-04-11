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
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/operator/dashboard" className="text-sm text-slate-500 hover:text-indigo-600">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">My buses</h1>
        </div>
        <Button asChild>
          <Link href="/operator/buses/new">
            <PlusCircle className="h-4 w-4 mr-1.5" />Add bus
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-slate-500 py-8 text-center">Loading…</p>
      ) : buses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-14 text-center">
          <Bus className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">No buses yet.</p>
          <Button asChild><Link href="/operator/buses/new">Add your first bus</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map((bus) => {
            const features = (bus.features || []) as Array<{ id: string; label: string } | string>;
            const featureLabels = features.map((f) => typeof f === "string" ? f : f.label);
            return (
              <div
                key={bus.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4 flex items-start gap-4 shadow-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/40">
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
                      className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 rounded-lg border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
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
