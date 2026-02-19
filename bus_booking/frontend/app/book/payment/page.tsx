"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { booking } from "@/lib/api";

const FLOW_KEY = "bus_booking_flow";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const scheduleId = Number(searchParams.get("schedule_id"));

  const [flow, setFlow] = useState<{
    schedule_id?: number;
    date?: string;
    from?: string;
    to?: string;
    fare?: string;
    seats?: string[];
    amount?: string;
    boarding_point_id?: number;
    dropping_point_id?: number;
    contact_phone?: string;
    state_of_residence?: string;
    whatsapp_opt_in?: boolean;
    passengers?: Record<string, { name?: string; age?: string; gender?: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(FLOW_KEY);
    setFlow(raw ? JSON.parse(raw) : null);
  }, []);

  const handleCreateOrder = async () => {
    if (!token || !flow?.schedule_id || !flow?.seats?.length) {
      setError("Missing booking details. Please start from seat selection.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(FLOW_KEY) : null;
      const latestFlow = raw ? JSON.parse(raw) : flow;
      const payload = {
        schedule_id: latestFlow.schedule_id ?? flow.schedule_id,
        seats: latestFlow.seats ?? flow.seats,
        amount: latestFlow.amount || flow.amount || String(parseFloat(flow.fare || "0") * (flow.seats?.length ?? 0)),
        boarding_point_id: latestFlow.boarding_point_id ?? flow.boarding_point_id,
        dropping_point_id: latestFlow.dropping_point_id ?? flow.dropping_point_id,
        contact_phone: latestFlow.contact_phone ?? flow.contact_phone ?? "",
        state_of_residence: latestFlow.state_of_residence ?? flow.state_of_residence ?? "",
        whatsapp_opt_in: latestFlow.whatsapp_opt_in ?? flow.whatsapp_opt_in ?? false,
        passengers: latestFlow.passengers ?? flow.passengers ?? undefined,
      };
      const res = await booking.createPayment(token, payload);
      setFlow((f) => (f ? { ...f, order_id: res.order_id, booking_id: res.booking_id } : f));
      // Redirect to confirmation with simulate; for demo we call webhook and redirect
      await simulatePayment(res.order_id);
      router.push(`/booking/${res.booking_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment creation failed.");
    } finally {
      setLoading(false);
    }
  };

  const simulatePayment = async (orderId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    await fetch(`${apiUrl}/api/payment/webhook/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_demo_123",
              order_id: orderId,
            },
          },
        },
      }),
    });
  };

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Please log in to book.</p>
        <Button onClick={() => router.push("/login")}>Login</Button>
      </div>
    );
  }

  if (flow === null) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Loading…</p>
      </div>
    );
  }

  if (!flow.schedule_id || !flow.seats?.length) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-destructive mb-4">Invalid booking session. Please search and select seats again.</p>
        <Button asChild variant="outline"><Link href="/">Back to search</Link></Button>
      </div>
    );
  }

  const amount = flow.amount || "0";

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex gap-2 text-sm text-muted-foreground mb-6">
          <span>1. Select seats</span>
          <span>→</span>
          <span>2. Board/Drop</span>
          <span>→</span>
          <span>3. Passenger info</span>
          <span>→</span>
          <span className="font-medium text-primary">4. Payment</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Complete payment</CardTitle>
            <CardDescription>
              {flow.from} → {flow.to} · {flow.date} · {flow.seats.length} seat(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg font-semibold">₹{amount}</p>
            <p className="text-sm text-muted-foreground">
              In demo mode, click below to simulate successful payment. With Razorpay enabled, the checkout would open here.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleCreateOrder} disabled={loading}>
              {loading ? "Processing…" : "Simulate payment success"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
