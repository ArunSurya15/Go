"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { routes, type TrackResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const POLL_INTERVAL_MS = 15000; // 15 seconds when tracking is active

export default function TrackBusPage() {
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get("schedule_id");
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrack = useCallback(async () => {
    if (!scheduleId) return;
    try {
      const res = await routes.track(parseInt(scheduleId, 10));
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tracking.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      setError("Missing schedule_id.");
      return;
    }
    fetchTrack();
  }, [scheduleId, fetchTrack]);

  useEffect(() => {
    if (!data?.active || !scheduleId) return;
    const t = setInterval(fetchTrack, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [data?.active, scheduleId, fetchTrack]);

  if (loading) {
    return (
      <div className="container max-w-lg py-12 text-center text-slate-500">
        Loading tracking…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-600">{error || "Not found."}</p>
            <Link href="/" className="mt-4 inline-block">
              <Button variant="outline">Back to home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const last = data.locations[0];
  const mapUrl = last
    ? `https://www.google.com/maps?q=${last.lat},${last.lng}`
    : null;
  const startsAt = new Date(data.tracking_starts_at);
  const endsAt = new Date(data.tracking_ends_at);

  return (
    <div className="container max-w-lg py-8">
      <div className="mb-4">
        <Link href="/" className="text-sm text-slate-600 hover:underline">← Home</Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Track your bus</CardTitle>
          <CardDescription>{data.route}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!data.active && data.message && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {data.message}
            </p>
          )}
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-slate-500">Tracking window</dt>
              <dd>
                Starts: {startsAt.toLocaleString()} · Ends: {endsAt.toLocaleString()}
              </dd>
            </div>
            {data.active && last && (
              <div>
                <dt className="text-slate-500">Last position</dt>
                <dd>
                  {last.lat}, {last.lng} at {new Date(last.recorded_at).toLocaleTimeString()}
                </dd>
              </div>
            )}
          </dl>
          {data.active && (
            <p className="text-xs text-slate-500">
              Live tracking starts 1 hour before departure. Position updates every few minutes when the driver app is active.
            </p>
          )}
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button>View on map</Button>
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
