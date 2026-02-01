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

export default function DroppingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = Number(searchParams.get("schedule_id"));
  const [list, setList] = useState<{ id: number; time: string; location_name: string; description: string }[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      return;
    }
    points.dropping(scheduleId)
      .then(setList)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dropping points."))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  const handleContinue = () => {
    if (selected == null) return;
    const flowStr = typeof window !== "undefined" ? sessionStorage.getItem(FLOW_KEY) : null;
    const flow = flowStr ? JSON.parse(flowStr) : {};
    flow.dropping_point_id = selected;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
    }
    router.push(`/book/passenger?schedule_id=${scheduleId}`);
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
        <Card>
          <CardHeader>
            <CardTitle>Dropping points</CardTitle>
            <CardDescription>Select Dropping Point</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && list.length === 0 && (
              <p className="text-sm text-muted-foreground">No dropping points. You can still continue.</p>
            )}
            {!loading && list.length > 0 && (
              <ul className="space-y-3">
                {list.map((dp) => (
                  <li
                    key={dp.id}
                    onClick={() => setSelected(dp.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected === dp.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-mono text-sm font-medium shrink-0 w-10 text-primary">{dp.time}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{dp.location_name}</p>
                      {dp.description && <p className="text-sm text-muted-foreground">{dp.description}</p>}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                      selected === dp.id ? "border-primary bg-primary" : "border-muted-foreground"
                    }`} />
                  </li>
                ))}
              </ul>
            )}
            <Button className="w-full" onClick={handleContinue} disabled={selected == null}>
              Continue to Passenger info
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
