"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { booking, routes, type SeatMapResponse, type Schedule } from "@/lib/api";

const FLOW_KEY = "bus_booking_flow";
const INDIAN_STATES = [
  "Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Maharashtra", "Delhi",
  "West Bengal", "Gujarat", "Rajasthan", "Telangana", "Pondicherry", "Other",
];

type PassengerInfo = { name: string; age: string; gender: string };

function getSeatDeck(seat: string, layout: SeatMapResponse["layout"]): "Lower deck" | "Upper deck" {
  const { rows, cols, labels } = layout;
  const half = Math.ceil(rows / 2);
  const idx = labels.indexOf(seat);
  if (idx === -1) return "Lower deck";
  const rowIdx = Math.floor(idx / cols);
  return rowIdx < half ? "Lower deck" : "Upper deck";
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
                return (
                  <div key={seat} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👤</span>
                        <div>
                          <p className="font-medium">Passenger {idx + 1}</p>
                          <p className="text-xs text-muted-foreground">Seat {seat}, {deck}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`name-${seat}`}>Name *</Label>
                        <Input
                          id={`name-${seat}`}
                          value={p.name}
                          onChange={(e) =>
                            setPassengers((prev) => ({
                              ...prev,
                              [seat]: { ...prev[seat], name: e.target.value },
                            }))
                          }
                          placeholder="Full name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`age-${seat}`}>Age *</Label>
                        <Input
                          id={`age-${seat}`}
                          type="number"
                          min={1}
                          max={120}
                          value={p.age}
                          onChange={(e) =>
                            setPassengers((prev) => ({
                              ...prev,
                              [seat]: { ...prev[seat], age: e.target.value },
                            }))
                          }
                          placeholder="Age"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`gender-${seat}`}>Gender *</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`gender-${seat}`}
                              value="Male"
                              checked={p.gender === "Male"}
                              onChange={(e) =>
                                setPassengers((prev) => ({
                                  ...prev,
                                  [seat]: { ...prev[seat], gender: e.target.value },
                                }))
                              }
                            />
                            <span className="text-sm">Male</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`gender-${seat}`}
                              value="Female"
                              checked={p.gender === "Female"}
                              onChange={(e) =>
                                setPassengers((prev) => ({
                                  ...prev,
                                  [seat]: { ...prev[seat], gender: e.target.value },
                                }))
                              }
                            />
                            <span className="text-sm">Female</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive mt-4">{error}</p>}
          <Button className="w-full mt-6 bg-red-600 hover:bg-red-700" onClick={handleProceed} disabled={loading}>
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
