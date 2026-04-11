"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { booking, routes, type SeatMapResponse, type Schedule } from "@/lib/api";
import { computeFemaleOnlySeatLabels } from "@/components/seat-layout";
import { User, AlertCircle } from "lucide-react";

function isMalePassengerGender(g: string): boolean {
  const u = g.trim().toUpperCase();
  return u === "M" || u === "MALE";
}

const FLOW_KEY = "bus_booking_flow";
const INDIAN_STATES = [
  "Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Maharashtra", "Delhi",
  "West Bengal", "Gujarat", "Rajasthan", "Telangana", "Pondicherry", "Other",
];

type PassengerInfo = { name: string; age: string; gender: string };

function getSeatDeck(seat: string, layout: SeatMapResponse["layout"]): "Lower deck" | "Upper deck" {
  const { rows, cols, labels } = layout;
  const raw = layout.deck_split_row;
  const split =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw < rows
      ? Math.floor(raw)
      : Math.ceil(rows / 2);
  const idx = labels.indexOf(seat);
  if (idx === -1) return "Lower deck";
  const rowIdx = Math.floor(idx / cols);
  return rowIdx < split ? "Lower deck" : "Upper deck";
}

export default function PassengerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, getValidToken } = useAuth();
  const scheduleId = searchParams.get("schedule_id");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flow, setFlow] = useState<{
    schedule_id?: number;
    from?: string;
    to?: string;
    date?: string;
    seats?: string[];
    fare?: string;
    amount?: string;
    schedule?: Schedule;
  } | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [passengers, setPassengers] = useState<Record<string, PassengerInfo>>({});

  useEffect(() => {
    if (typeof window !== "undefined" && token && scheduleId) {
      const flowStr = sessionStorage.getItem(FLOW_KEY);
      const parsed = flowStr ? JSON.parse(flowStr) : {};
      setFlow(parsed);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.contact_phone) setPhone(parsed.contact_phone);
      if (parsed.state_of_residence) setState(parsed.state_of_residence);
      if (parsed.whatsapp_opt_in !== undefined) setWhatsapp(parsed.whatsapp_opt_in);

      // Load seat map to determine deck
      routes.scheduleSeatMap(Number(scheduleId)).then(setSeatMap).catch(() => {});

      // Load schedule if not in flow
      if (!parsed.schedule && parsed.schedule_id) {
        routes.schedules(parsed.route_id || 0, parsed.date || "")
          .then((schedules) => {
            const s = schedules.find((x) => x.id === parsed.schedule_id);
            if (s) {
              setFlow((f) => (f ? { ...f, schedule: s } : f));
              const updated = { ...parsed, schedule: s };
              sessionStorage.setItem(FLOW_KEY, JSON.stringify(updated));
            }
          })
          .catch(() => {});
      }

      // Initialize passenger forms for each seat
      if (parsed.seats && Array.isArray(parsed.seats)) {
        const p: Record<string, PassengerInfo> = {};
        parsed.seats.forEach((seat: string) => {
          p[seat] = parsed.passengers?.[seat] || { name: "", age: "", gender: "" };
        });
        setPassengers(p);
      }
    }
  }, [token, scheduleId]);

  const femaleOnlySeats = useMemo(() => {
    if (!seatMap) return new Set<string>();
    const occ = new Set(seatMap.occupied);
    const gm = new Map<string, string>();
    seatMap.occupied_details?.forEach((o) => {
      if (o.label) gm.set(o.label, (o.gender || "").toString().toUpperCase());
    });
    return computeFemaleOnlySeatLabels(seatMap.layout, occ, gm);
  }, [seatMap]);

  // Load last booking's contact info
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const validToken = await getValidToken();
        if (!validToken) return;
        const bookings = await booking.list(validToken);
        if (!cancelled && bookings.length > 0) {
          const last = bookings[0];
          if (!phone && last.contact_phone) setPhone(last.contact_phone);
          if (!email && last.state_of_residence) setState(last.state_of_residence);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [token, getValidToken, phone, email]);

  const handleProceed = () => {
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!state) {
      setError("State of residence is required.");
      return;
    }
    const seats = flow?.seats || [];
    const missing = seats.find((s) => {
      const p = passengers[s];
      return !p?.name.trim() || !p?.age.trim() || !p?.gender;
    });
    if (missing) {
      setError("Please fill all passenger details.");
      return;
    }
    const maleOnFemaleOnly = seats.find((s) => {
      const p = passengers[s];
      return (
        femaleOnlySeats.has(s) &&
        p?.gender &&
        isMalePassengerGender(p.gender)
      );
    });
    if (maleOnFemaleOnly) {
      setError(
        `Seat ${maleOnFemaleOnly} is only available for female passengers (next to a booked female). Change seat on the seat selection step or set gender to Female.`
      );
      return;
    }
    setError("");
    setLoading(true);
    const flowStr = typeof window !== "undefined" ? sessionStorage.getItem(FLOW_KEY) : null;
    const flowData = flowStr ? JSON.parse(flowStr) : {};
    flowData.contact_phone = phone.trim();
    flowData.state_of_residence = state;
    flowData.whatsapp_opt_in = whatsapp;
    flowData.email = email;
    flowData.passengers = passengers; // Store passenger details
    if (typeof window !== "undefined") {
      sessionStorage.setItem(FLOW_KEY, JSON.stringify(flowData));
    }
    setLoading(false);
    router.push(`/book/payment?schedule_id=${scheduleId}`);
  };

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Please log in to book.</p>
        <Button onClick={() => router.push("/login")}>Login</Button>
      </div>
    );
  }

  const seats = flow?.seats || [];
  const schedule = flow?.schedule;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid gap-8 lg:grid-cols-[1fr,380px]"
      >
        <div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-6">
            <span>1. Select seats</span>
            <span>→</span>
            <span>2. Board/Drop point</span>
            <span>→</span>
            <span className="font-medium text-primary">3. Passenger info</span>
            <span>→</span>
            <span>4. Payment</span>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
              <CardDescription>Ticket details will be sent to</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone *</Label>
                <div className="flex gap-2">
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground shrink-0">
                    +91 (IND)
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email ID</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State of Residence *</Label>
                <select
                  id="state"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Required for GST Tax Invoicing</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600" aria-hidden>●</span>
                <input
                  type="checkbox"
                  id="whatsapp"
                  checked={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="whatsapp" className="font-normal cursor-pointer text-sm">
                  Send booking details and trip updates on WhatsApp
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passenger details</CardTitle>
              <CardDescription>{seats.length} passenger{seats.length !== 1 ? "s" : ""}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {seats.map((seat, idx) => {
                const deck = seatMap ? getSeatDeck(seat, seatMap.layout) : "Lower deck";
                const p = passengers[seat] || { name: "", age: "", gender: "" };
                const isFemaleOnly = femaleOnlySeats.has(seat);
                // Avatar accent colours cycling through a palette
                const avatarColors = [
                  "from-indigo-500 to-violet-600",
                  "from-emerald-500 to-teal-600",
                  "from-amber-500 to-orange-500",
                  "from-pink-500 to-rose-600",
                  "from-sky-500 to-cyan-600",
                ];
                const avatarGrad = avatarColors[idx % avatarColors.length];

                const handleGenderChange = (next: string) => {
                  setPassengers((prev) => {
                    const merged = { ...prev, [seat]: { ...prev[seat], gender: next } };
                    const bad = seats.find((s) => {
                      const g = merged[s]?.gender;
                      return femaleOnlySeats.has(s) && !!g && isMalePassengerGender(g);
                    });
                    if (bad) {
                      setError(`Seat ${bad} is only available for female passengers. Select Female or change your seat.`);
                    } else {
                      setError((prev) => prev.includes("only available for female") ? "" : prev);
                    }
                    return merged;
                  });
                };

                return (
                  <div
                    key={seat}
                    className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-4 px-5 py-4 bg-slate-50 dark:bg-slate-800/50">
                      {/* Avatar */}
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGrad} shadow-sm`}>
                        <User className="h-5 w-5 text-white" strokeWidth={2} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          Passenger {idx + 1}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {/* Seat badge */}
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                            Seat {seat}
                          </span>
                          {/* Deck badge */}
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            deck === "Upper deck"
                              ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                              : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                          }`}>
                            {deck === "Upper deck" ? "⬆ Upper" : "⬇ Lower"}
                          </span>
                        </div>
                      </div>

                      {/* Female-only warning badge */}
                      {isFemaleOnly && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 dark:bg-pink-900/30 px-2.5 py-1 text-xs font-semibold text-pink-700 dark:text-pink-300 shrink-0">
                          ♀ Female only
                        </span>
                      )}
                    </div>

                    {/* Female-only notice */}
                    {isFemaleOnly && (
                      <div className="flex items-start gap-2 mx-5 mt-3 rounded-xl bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900 px-3 py-2.5">
                        <AlertCircle className="h-4 w-4 text-pink-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-pink-700 dark:text-pink-300">
                          This seat is next to a booked female passenger. Only female passengers may be assigned here.
                        </p>
                      </div>
                    )}

                    {/* Fields */}
                    <div className="px-5 py-4 grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`name-${seat}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Full name *
                        </Label>
                        <Input
                          id={`name-${seat}`}
                          value={p.name}
                          onChange={(e) =>
                            setPassengers((prev) => ({ ...prev, [seat]: { ...prev[seat], name: e.target.value } }))
                          }
                          placeholder="e.g. Priya Sharma"
                          className="rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`age-${seat}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Age *
                        </Label>
                        <Input
                          id={`age-${seat}`}
                          type="number"
                          min={1}
                          max={120}
                          value={p.age}
                          onChange={(e) =>
                            setPassengers((prev) => ({ ...prev, [seat]: { ...prev[seat], age: e.target.value } }))
                          }
                          placeholder="e.g. 28"
                          className="rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Gender *
                        </Label>
                        <div className="flex gap-2">
                          {["Male", "Female"].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => handleGenderChange(g)}
                              className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-all ${
                                p.gender === g
                                  ? g === "Male"
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                    : "bg-pink-500 border-pink-500 text-white shadow-sm"
                                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                              }`}
                            >
                              {g === "Male" ? "♂ Male" : "♀ Female"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive mt-4">{error}</p>}
          <Button className="w-full mt-6" onClick={handleProceed} disabled={loading}>
            {loading ? "Proceeding…" : "Proceed to payment"}
          </Button>
        </div>

        {/* Summary sidebar */}
        {flow && (flow.from || flow.to) && (
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Trip summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {schedule && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Operator</p>
                    <p className="font-semibold">{schedule.bus.operator_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {seats.length} seat{seats.length !== 1 ? "s" : ""} · {schedule.bus.registration_no}
                    </p>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-base">{flow.from} → {flow.to}</p>
                  {flow.date && <p className="text-muted-foreground mt-1">{flow.date}</p>}
                </div>
                {schedule && (
                  <div className="space-y-2 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Departure</p>
                      <p className="font-medium">
                        {new Date(schedule.departure_dt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(schedule.departure_dt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Arrival</p>
                      <p className="font-medium">
                        {new Date(schedule.arrival_dt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(schedule.arrival_dt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Seat details</p>
                  <p className="text-xs">{seats.length} seat{seats.length !== 1 ? "s" : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {seats.map((s) => (
                      <span
                        key={s}
                        className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                {flow.amount && (
                  <div className="pt-2 border-t">
                    <p className="text-lg font-bold">₹{flow.amount}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}
