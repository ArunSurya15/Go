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
import { points } from "@/lib/api";

const FLOW_KEY = "bus_booking_flow";

export default function BoardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = Number(searchParams.get("schedule_id"));
  const [list, setList] = useState<{ id: number; time: string; location_name: string; landmark: string }[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      return;
    }
    points.boarding(scheduleId)
      .then(setList)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load boarding points."))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  const handleContinue = () => {
    if (selected == null) return;
    const flowStr = typeof window !== "undefined" ? sessionStorage.getItem(FLOW_KEY) : null;
    const flow = flowStr ? JSON.parse(flowStr) : {};
    flow.boarding_point_id = selected;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
    }
    router.push(`/book/dropping?schedule_id=${scheduleId}`);
  };

  if (!scheduleId) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-destructive">Invalid link.</p>
        <Button variant="outline" className="mt-4" asChild><Link href="/">Back to search</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
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
        <p className="text-sm text-muted-foreground mb-2">
          <Link href={`/book/board-drop?schedule_id=${scheduleId}`} className="text-primary underline">
            Select boarding & dropping on one page
          </Link>
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Boarding points</CardTitle>
            <CardDescription>Select Boarding Point</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && list.length === 0 && (
              <p className="text-sm text-muted-foreground">No boarding points. You can still continue.</p>
            )}
            {!loading && list.length > 0 && (
              <ul className="space-y-3">
                {list.map((bp) => (
                  <li
                    key={bp.id}
                    onClick={() => setSelected(bp.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected === bp.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-mono text-sm font-medium shrink-0 w-10">{bp.time}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{bp.location_name}</p>
                      {bp.landmark && <p className="text-sm text-muted-foreground">{bp.landmark}</p>}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                      selected === bp.id ? "border-primary bg-primary" : "border-muted-foreground"
                    }`} />
                  </li>
                ))}
              </ul>
            )}
            <Button className="w-full" onClick={handleContinue} disabled={selected == null}>
              Continue to Dropping points
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
