"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { points, type BoardingPoint, type DroppingPoint } from "@/lib/api";

const FLOW_KEY = "bus_booking_flow";

function formatTime(iso: string) {
  if (!iso) return "--:--";
  if (iso.length <= 5 && iso.includes(":")) return iso;
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function BoardDropPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = Number(searchParams.get("schedule_id"));
  const [boardingList, setBoardingList] = useState<BoardingPoint[]>([]);
  const [droppingList, setDroppingList] = useState<DroppingPoint[]>([]);
  const [boardingId, setBoardingId] = useState<number | null>(null);
  const [droppingId, setDroppingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      return;
    }
    Promise.all([points.boarding(scheduleId), points.dropping(scheduleId)])
      .then(([b, d]) => {
        setBoardingList(b);
        setDroppingList(d);
        if (b.length === 1) setBoardingId(b[0].id);
        if (d.length === 1) setDroppingId(d[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load points."))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  const handleContinue = () => {
    const flowStr = typeof window !== "undefined" ? sessionStorage.getItem(FLOW_KEY) : null;
    const flow = flowStr ? JSON.parse(flowStr) : {};
    flow.boarding_point_id = boardingId ?? undefined;
    flow.dropping_point_id = droppingId ?? undefined;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
    }
    router.push(`/book/passenger?schedule_id=${scheduleId}`);
  };

  const canContinue =
    (boardingList.length === 0 || boardingId != null) && (droppingList.length === 0 || droppingId != null);

  if (!scheduleId) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-destructive">Invalid link.</p>
        <Button variant="outline" className="mt-4" asChild><Link href="/">Back to search</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-6">
          <span>1. Select seats</span>
          <span>→</span>
          <span className="font-medium text-primary">2. Board/Drop point</span>
          <span>→</span>
          <span>3. Passenger info</span>
          <span>→</span>
          <span>4. Payment</span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Boarding points</CardTitle>
              <CardDescription>Select Boarding Point</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && boardingList.length === 0 && (
                <p className="text-sm text-muted-foreground">No boarding points.</p>
              )}
              {!loading && boardingList.length > 0 && (
                <ul className="space-y-2">
                  {boardingList.map((bp) => (
                    <li
                      key={bp.id}
                      onClick={() => setBoardingId(bp.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        boardingId === bp.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-mono text-sm font-semibold shrink-0 w-10">{formatTime(bp.time)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{bp.location_name}</p>
                        {bp.landmark && <p className="text-xs text-muted-foreground">{bp.landmark}</p>}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                        boardingId === bp.id ? "border-primary bg-primary" : "border-muted-foreground"
                      }`} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dropping points</CardTitle>
              <CardDescription>Select Dropping Point</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && droppingList.length === 0 && (
                <p className="text-sm text-muted-foreground">No dropping points.</p>
              )}
              {!loading && droppingList.length > 0 && (
                <ul className="space-y-2">
                  {droppingList.map((dp) => (
                    <li
                      key={dp.id}
                      onClick={() => setDroppingId(dp.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        droppingId === dp.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-mono text-sm font-semibold shrink-0 w-10 text-primary">{formatTime(dp.time)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{dp.location_name}</p>
                        {dp.description && <p className="text-xs text-muted-foreground">{dp.description}</p>}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                        droppingId === dp.id ? "border-primary bg-primary" : "border-muted-foreground"
                      }`} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {error && <p className="text-sm text-destructive mt-4">{error}</p>}
        <Button className="w-full mt-6" onClick={handleContinue} disabled={!canContinue}>
          Select boarding & dropping points → Continue to Passenger info
        </Button>
      </motion.div>
    </div>
  );
}
