"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  TravelHeroAmbientScenery,
  TravelHeroCruiseBus,
  TravelHeroCruiseGround,
  TravelHeroDriftingCloud,
  TravelHeroHeading,
  TravelHeroScope,
  TravelHeroSection,
  TravelHeroSun,
} from "@/components/illustrations/animated-travel-hero";
import { routes } from "@/lib/api";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { addDays } from "date-fns";
import { formatLocalYMD } from "@/lib/date-ymd";

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function HomePage() {
  const router = useRouter();
  const todayIso = formatLocalYMD(new Date());
  const tomorrowIso = formatLocalYMD(addDays(new Date(), 1));
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
      <div className="bg-gradient-to-b from-sky-50/40 via-neutral-100 to-primary/[0.04] py-8 px-4 dark:from-zinc-900 dark:via-zinc-950 dark:to-primary/10 sm:py-10">
        <motion.div
          className="container mx-auto max-w-4xl"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.div variants={fadeUp} className="-mx-1 mb-6 w-full sm:mx-0 sm:mb-8">
            <TravelHeroSection>
              <TravelHeroScope>
                <TravelHeroSun />
                <TravelHeroDriftingCloud
                  className="left-[2%] top-[6%] h-11 w-32 md:h-12 md:w-40"
                  delay={0}
                  duration={28}
                  variant={0}
                />
                <TravelHeroDriftingCloud
                  className="left-[26%] top-[2%] h-9 w-28 md:h-10 md:w-36"
                  delay={2}
                  duration={22}
                  variant={1}
                />
                <TravelHeroDriftingCloud
                  className="right-[4%] top-[10%] h-10 w-32 md:h-11 md:w-40"
                  delay={3.5}
                  duration={26}
                  variant={2}
                />
                <TravelHeroDriftingCloud
                  className="right-[20%] top-[4%] h-8 w-24 opacity-90"
                  delay={5}
                  duration={20}
                  variant={0}
                />
                <TravelHeroCruiseGround />
                <TravelHeroAmbientScenery />
                <TravelHeroHeading />
                <TravelHeroCruiseBus />
              </TravelHeroScope>
            </TravelHeroSection>
          </motion.div>

          <motion.div variants={fadeUp} className="mx-auto max-w-2xl">
          <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-900/80">
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
                    <DatePickerField
                      id="date"
                      value={date}
                      onChange={setDate}
                      min={todayIso}
                      className="h-11 min-h-[2.75rem] flex-1 min-w-[160px] py-0"
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
                  className="w-full h-12 font-semibold rounded-lg"
                  disabled={loading}
                >
                  {loading ? "Searching…" : "Search buses"}
                </Button>
              </form>
            </CardContent>
          </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
