"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorBus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperatorDashboardPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [buses, setBuses] = useState<OperatorBus[]>([]);
  const [schedules, setSchedules] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      try {
        const [p, b, s] = await Promise.all([
          operatorApi.profile(token),
          operatorApi.buses(token),
          operatorApi.schedules(token),
        ]);
        if (!cancelled) {
          setProfile(p);
          setBuses(b);
          setSchedules(Array.isArray(s) ? s : []);
        }
      } catch {
        router.replace("/operator/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getValidToken, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {profile?.name ? `Welcome, ${profile.name}` : "Operator dashboard"}
        </h1>
        <p className="mt-1 text-slate-600">Manage your buses and schedules.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My buses</CardTitle>
              <CardDescription>{buses.length} bus{buses.length !== 1 ? "es" : ""} registered</CardDescription>
            </div>
            <span className="text-3xl font-bold text-indigo-600">{buses.length}</span>
          </CardHeader>
          <CardContent>
            {buses.length === 0 ? (
              <p className="text-sm text-slate-500">No buses yet. Add your first bus to start creating schedules.</p>
            ) : (
              <ul className="space-y-2">
                {buses.slice(0, 5).map((bus) => (
                  <li key={bus.id} className="flex justify-between text-sm">
                    <span className="font-medium">{bus.registration_no}</span>
                    <span className="text-slate-500">{bus.capacity} seats</span>
                  </li>
                ))}
                {buses.length > 5 && (
                  <li className="text-sm text-slate-500">+{buses.length - 5} more</li>
                )}
              </ul>
            )}
            <div className="mt-4">
              <Link href="/operator/buses/new">
                <Button size="sm">Add bus</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My schedules</CardTitle>
              <CardDescription>{schedules.length} schedule{schedules.length !== 1 ? "s" : ""}</CardDescription>
            </div>
            <span className="text-3xl font-bold text-indigo-600">{schedules.length}</span>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <p className="text-sm text-slate-500">No schedules yet. Add a bus first, then create a schedule.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">New schedules are PENDING until approved by admin.</p>
                <ul className="space-y-1 text-xs">
                  {(schedules as Array<{ id: number; route: { origin: string; destination: string }; departure_dt: string }>).slice(0, 3).map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span className="text-slate-600">
                        {s.route.origin} → {s.route.destination}
                      </span>
                      <Link
                        href={`/operator/track/${s.id}`}
                        className="text-indigo-600 hover:underline text-xs"
                      >
                        Track
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4">
              <Link href="/operator/schedules/new">
                <Button size="sm" disabled={buses.length === 0}>Add schedule</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-indigo-100 bg-indigo-50/50">
        <CardContent className="py-6">
          <h3 className="font-semibold text-slate-800">Quick links</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/operator/buses/new" className="text-indigo-600 hover:underline">Add bus</Link>
            </li>
            <li>
              <Link href="/operator/schedules/new" className="text-indigo-600 hover:underline">Add schedule</Link>
            </li>
            <li>
              <Link href="/operator/onboarding" className="text-indigo-600 hover:underline">Complete or edit profile</Link>
            </li>
            <li>
              <a
                href="/api/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                API docs (buses, schedules)
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
