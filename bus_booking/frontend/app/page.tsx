"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(todayIso);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!from.trim() || !to.trim() || !date) {
      setError("Please fill From, To and Date.");
      return;
    }
    setLoading(true);
    try {
      const list = await routes.list(from.trim(), to.trim());
      if (list.length === 0) {
        setError("No routes found. Try different cities.");
        setLoading(false);
        return;
      }
      const routeId = list[0].id;
      router.push(`/schedules?route_id=${routeId}&date=${date}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const swapCities = () => {
    setFrom(to);
    setTo(from);
  };

  const isToday = date === todayIso;

  return (
    <div className="min-h-[60vh]">
      <div className="bg-gradient-to-br from-slate-100 via-white to-primary/5 py-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="container mx-auto max-w-2xl text-center mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2">
            Book bus tickets online
          </h1>
          <p className="text-muted-foreground">Search buses by route and date.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="container mx-auto max-w-2xl"
        >
          <Card className="shadow-lg rounded-xl border-0 bg-white">
            <CardContent className="p-5 md:p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-2 items-end">
                  <div className="grid gap-1.5">
                    <Label htmlFor="from" className="text-muted-foreground text-sm">From</Label>
                    <Input
                      id="from"
                      placeholder="e.g. Bangalore"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full shrink-0 self-center md:mb-2"
                    onClick={swapCities}
                    aria-label="Swap cities"
                  >
                    <svg className="h-4 w-4 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </Button>
                  <div className="grid gap-1.5">
                    <Label htmlFor="to" className="text-muted-foreground text-sm">To</Label>
                    <Input
                      id="to"
                      placeholder="e.g. Pondicherry"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="date" className="text-muted-foreground text-sm">Date of Journey</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="date"
                      type="date"
                      min={todayIso}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-11 flex-1 min-w-[140px]"
                    />
                    <span className="text-sm text-muted-foreground">
                      {isToday ? "(Today)" : date === tomorrowIso ? "(Tomorrow)" : ""}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant={date === todayIso ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setDate(todayIso)}
                      >
                        Today
                      </Button>
                      <Button
                        type="button"
                        variant={date === tomorrowIso ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setDate(tomorrowIso)}
                      >
                        Tomorrow
                      </Button>
                    </div>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
                  disabled={loading}
                >
                  {loading ? "Searching…" : "Search buses"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
