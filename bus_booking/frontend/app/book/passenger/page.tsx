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

const FLOW_KEY = "bus_booking_flow";
const INDIAN_STATES = [
  "Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Maharashtra", "Delhi",
  "West Bengal", "Gujarat", "Rajasthan", "Telangana", "Pondicherry", "Other",
];

export default function PassengerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const scheduleId = searchParams.get("schedule_id");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flow, setFlow] = useState<{ from?: string; to?: string; date?: string; seats?: string[]; fare?: string; amount?: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && token) {
      const flowStr = sessionStorage.getItem(FLOW_KEY);
      const parsed = flowStr ? JSON.parse(flowStr) : {};
      setFlow(parsed);
      if (parsed.email) setEmail(parsed.email);
    }
  }, [token]);

  const handleProceed = () => {
    if (!phone.trim()) {
      setError("Phone number is required.");
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid gap-8 md:grid-cols-[1fr,320px]"
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
          <Card>
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
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handleProceed} disabled={loading}>
                {loading ? "Proceeding…" : "Proceed to payment"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Journey summary (redBus-style) */}
        {flow && (flow.from || flow.to) && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Trip summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{flow.from} → {flow.to}</p>
                {flow.date && <p className="text-muted-foreground">Date: {flow.date}</p>}
                {flow.seats && flow.seats.length > 0 && (
                  <p className="text-muted-foreground">{flow.seats.length} seat(s) · {flow.seats.join(", ")}</p>
                )}
                {flow.amount && <p className="font-semibold pt-2">₹{flow.amount}</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}
