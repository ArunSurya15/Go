"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { booking, ticketDownloadUrl, type Booking } from "@/lib/api";

export default function BookingSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const id = Number(params.id);
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || isNaN(id)) {
      setLoading(false);
      return;
    }
    Promise.all([
      booking.ticket(token, id).then((res) => setTicketUrl(res.ticket_url)),
      booking.list(token).then((list) => {
        const b = list.find((x) => x.id === id);
        if (b) setBookingData(b);
      }),
    ]).catch((err) => setError(err instanceof Error ? err.message : "Failed to load booking."))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleDownloadTicket = async () => {
    if (!token) return;
    const url = ticketDownloadUrl(id);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ticket_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  };

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Please log in to view this booking.</p>
        <Button onClick={() => router.push("/login")}>Login</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Booking confirmed</CardTitle>
            <CardDescription>
              Your booking #{id} is confirmed. You can download your ticket below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && ticketUrl && (
              <Button className="w-full" onClick={handleDownloadTicket}>
                Download ticket (PDF)
              </Button>
            )}
            {bookingData && bookingData.status === "CONFIRMED" && (
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/track?schedule_id=${bookingData.schedule.id}`}>
                  Track bus
                </Link>
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/bookings">My Bookings</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/">Search again</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
