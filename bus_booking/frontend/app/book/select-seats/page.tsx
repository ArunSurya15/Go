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
import { SeatLayout } from "@/components/seat-layout";
import { booking, routes, type SeatMapResponse } from "@/lib/api";

const FLOW_KEY = "bus_booking_flow";

export default function SelectSeatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, getValidToken } = useAuth();
  const scheduleId = Number(searchParams.get("schedule_id"));
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fareParam = searchParams.get("fare") || "0";

  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [seatMapError, setSeatMapError] = useState("");
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scheduleId) return;
    routes.scheduleSeatMap(scheduleId)
      .then(setSeatMap)
      .catch((err) => setSeatMapError(err instanceof Error ? err.message : "Failed to load seat map"));
  }, [scheduleId]);

  const fare = seatMap?.fare ?? fareParam;
  const seats = selectedSeats;
  const amount = Math.round(parseFloat(fare) * seats.length);

  const handleToggleSeat = (seat: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat]
    );
  };

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

  const handleContinue = async () => {
    if (seats.length === 0) {
      setError("Please select at least one seat.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const validToken = await getValidToken();
      if (!validToken) {
        setError("Your session has expired. Please log in again.");
        setLoading(false);
        return;
      }
      await booking.reserve(validToken, scheduleId, seats);
      const flow = {
        schedule_id: scheduleId,
        date: date || "",
        from: from || "",
        to: to || "",
        fare,
        seats,
        amount,
      };
      if (typeof window !== "undefined") {
        sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
      }
      router.push(`/book/board-drop?schedule_id=${scheduleId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reserve failed.";
      setError(
        msg.toLowerCase().includes("token") || msg.includes("401")
          ? "Your session has expired. Please log in again."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (seatMapError) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md text-center">
        <p className="text-destructive mb-4">{seatMapError}</p>
        <Button variant="outline" onClick={() => router.push("/schedules")}>Back to schedules</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-4">
          <span className="font-medium text-primary">1. Select seats</span>
          <span>→</span>
          <span>2. Board/Drop point</span>
          <span>→</span>
          <span>3. Passenger info</span>
          <span>→</span>
          <span>4. Payment</span>
        </div>

        <div className="mb-4">
          <h1 className="text-xl font-bold">{from} → {to}</h1>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>

        {!seatMap ? (
          <p className="text-muted-foreground py-8">Loading seat layout…</p>
        ) : (
          <>
            <SeatLayout
              layout={seatMap.layout}
              occupied={seatMap.occupied}
              occupiedDetails={seatMap.occupied_details}
              fare={seatMap.fare}
              selected={selectedSeats}
              onSelect={handleToggleSeat}
            />

            <div className="mt-6 sticky bottom-4 bg-amber-50 dark:bg-amber-950/30 border rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-medium">{seats.length} seat(s)</span>
                {seats.length > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ₹{amount} (₹{Math.round(Number(fare))} × {seats.length})
                  </span>
                )}
              </div>
              {error && (
                <div className="w-full">
                  <p className="text-sm text-destructive">{error}</p>
                  {error.includes("session has expired") && (
                    <Button variant="outline" size="sm" className="mt-1" asChild>
                      <Link href="/login">Log in again</Link>
                    </Button>
                  )}
                </div>
              )}
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={handleContinue}
                disabled={loading || seats.length === 0}
              >
                {loading ? "Reserving…" : "Select boarding & dropping points"}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
