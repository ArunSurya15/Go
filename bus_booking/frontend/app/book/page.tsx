"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { booking } from "@/lib/api";

export default function BookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const scheduleId = Number(searchParams.get("schedule_id"));
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fare = searchParams.get("fare") || "0";

  const [seatsInput, setSeatsInput] = useState("1A, 1B");
  const [step, setStep] = useState<"reserve" | "payment" | "done">("reserve");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState("");

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md text-center">
        <p className="text-muted-foreground mb-4">Please log in to book.</p>
        <Button onClick={() => router.push("/login")}>Login</Button>
      </div>
    );
  }

  if (!scheduleId || !date) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-destructive">Invalid booking link.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
          Back to search
        </Button>
      </div>
    );
  }

  const seats = seatsInput.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const amount = (parseFloat(fare) * seats.length).toFixed(2);

  const handleReserveAndPayment = async () => {
    if (seats.length === 0) {
      setError("Enter at least one seat (e.g. 1A, 1B).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await booking.reserve(token, scheduleId, seats);
      const payment = await booking.createPayment(token, scheduleId, seats, amount);
      setBookingId(payment.booking_id);
      setOrderId(payment.order_id);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!bookingId) return;
    setLoading(true);
    setError("");
    try {
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
      setStep("done");
      router.push(`/booking/${bookingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Webhook failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              {step === "reserve" && "Select seats"}
              {step === "payment" && "Complete payment"}
              {step === "done" && "Done"}
            </CardTitle>
            <CardDescription>
              {step === "reserve" && `${from} → ${to} · ${date}`}
              {step === "payment" && `Booking #${bookingId} · ₹${amount}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "reserve" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="seats">Seats (comma-separated, e.g. 1A, 1B)</Label>
                  <Input
                    id="seats"
                    value={seatsInput}
                    onChange={(e) => setSeatsInput(e.target.value)}
                    placeholder="1A, 1B"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: ₹{amount} ({seats.length} seat(s) × ₹{fare})
                </p>
              </>
            )}
            {step === "payment" && (
              <p className="text-sm">
                Order created. In demo mode, click below to simulate successful payment.
                With real Razorpay, you would open the checkout here.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {step === "reserve" && (
              <Button className="w-full" onClick={handleReserveAndPayment} disabled={loading}>
                {loading ? "Reserving…" : "Reserve & proceed to payment"}
              </Button>
            )}
            {step === "payment" && (
              <Button className="w-full" onClick={handleSimulatePayment} disabled={loading}>
                {loading ? "Processing…" : "Simulate payment success"}
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
