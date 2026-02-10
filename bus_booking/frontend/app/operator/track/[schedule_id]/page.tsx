"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, routes, type Schedule, type TrackLocation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperatorTrackPage() {
  const params = useParams();
  const router = useRouter();
  const { getValidToken } = useAuth();
  const scheduleId = Number(params.schedule_id);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [recentLocations, setRecentLocations] = useState<TrackLocation[]>([]);
  const [autoSend, setAutoSend] = useState(false);
  const [autoInterval, setAutoInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      try {
        const schedules = await operatorApi.schedules(token);
        const s = schedules.find((x) => x.id === scheduleId);
        if (!cancelled) {
          if (s) {
            setSchedule(s);
            loadTrackingData();
          } else {
            setError("Schedule not found.");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load schedule.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scheduleId, getValidToken, router]);

  const loadTrackingData = async () => {
    try {
      const data = await routes.track(scheduleId);
      setRecentLocations(data.locations.slice(0, 10)); // Last 10 locations
    } catch {}
  };

  useEffect(() => {
    if (autoSend && schedule) {
      const interval = setInterval(() => {
        getCurrentLocationAndSend();
      }, 30000); // Every 30 seconds
      setAutoInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (autoInterval) {
        clearInterval(autoInterval);
        setAutoInterval(null);
      }
    }
  }, [autoSend, schedule]);

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          reject(new Error(`Geolocation error: ${err.message}`));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const sendLocation = async (latitude: number, longitude: number) => {
    const token = await getValidToken();
    if (!token) {
      setError("Not authenticated.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      await operatorApi.postLocation(token, scheduleId, latitude, longitude);
      setSuccess(`Location sent: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      setLat(latitude.toFixed(6));
      setLng(longitude.toFixed(6));
      await loadTrackingData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send location.");
    } finally {
      setSending(false);
    }
  };

  const getCurrentLocationAndSend = async () => {
    try {
      const { lat: latitude, lng: longitude } = await getCurrentLocation();
      await sendLocation(latitude, longitude);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get location.");
    }
  };

  const handleManualSend = async () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setError("Invalid coordinates.");
      return;
    }
    await sendLocation(latNum, lngNum);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md text-center">
        <p className="text-red-600 mb-4">{error || "Schedule not found."}</p>
        <Button asChild>
          <Link href="/operator/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const dep = new Date(schedule.departure_dt);
  const arr = new Date(schedule.arrival_dt);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/operator/dashboard" className="text-sm text-slate-600 hover:text-indigo-600">
          ← Dashboard
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Send GPS location</CardTitle>
          <CardDescription>
            Schedule #{scheduleId} · {schedule.route.origin} → {schedule.route.destination}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium mb-1">Trip details</p>
            <p>
              Departs: {dep.toLocaleString()} · Arrives: {arr.toLocaleString()}
            </p>
            <p className="mt-1">Bus: {schedule.bus.registration_no}</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Method 1: Use device GPS (recommended)</Label>
              <p className="text-xs text-slate-500 mb-2">
                Works on phones/tablets with GPS enabled. Click to get your current location and send it.
              </p>
              <Button
                onClick={getCurrentLocationAndSend}
                disabled={sending || autoSend}
                className="w-full"
              >
                {sending ? "Sending…" : "📍 Get current location & send"}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Or</span>
              </div>
            </div>

            <div>
              <Label>Method 2: Manual entry (for testing)</Label>
              <p className="text-xs text-slate-500 mb-2">
                Enter coordinates manually (e.g., Bengaluru: 12.9716, 77.5946)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="lat" className="text-xs">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    placeholder="12.9716"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lng" className="text-xs">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    placeholder="77.5946"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleManualSend}
                disabled={sending || !lat || !lng}
                variant="outline"
                className="w-full mt-2"
              >
                Send manual location
              </Button>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="auto" className="cursor-pointer text-sm">
                  Auto-send location every 30 seconds
                </Label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Continuously sends your GPS location. Turn off when done.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
          )}
        </CardContent>
      </Card>

      {recentLocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent locations sent</CardTitle>
            <CardDescription>Last {recentLocations.length} location updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLocations.map((loc, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <p className="font-mono text-xs">
                      {loc.lat}, {loc.lng}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(loc.recorded_at).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    View on map
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
