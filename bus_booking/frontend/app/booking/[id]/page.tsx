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
import { EgoTicketSheet } from "@/components/ticket/ego-ticket-sheet";
import { booking, downloadBookingTicketPdf, type Booking } from "@/lib/api";

function isPastDeparture(iso: string) {
  return new Date(iso) < new Date();
}

export default function BookingSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const { token, getValidToken } = useAuth();
  const id = Number(params.id);
  const [bookingData, setBookingData] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token || isNaN(id)) {
      setLoading(false);
      return;
    }
    Promise.all([
      booking.ticket(token, id).catch(() => undefined),
      booking.get(token, id).then((b) => setBookingData(b)),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load booking."))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleDownloadTicket = async () => {
    const t = await getValidToken();
    if (!t) return;
    setDownloading(true);
    setError("");
    try {
      await downloadBookingTicketPdf(t, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const trackable =
    bookingData?.status === "CONFIRMED" && !isPastDeparture(bookingData.schedule.departure_dt);

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Please log in to view this booking.</p>
        <Button onClick={() => router.push("/login")}>Login</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-12">
      <EgoTicketSheet
        booking={bookingData}
        open={ticketOpen && !!bookingData}
        onClose={() => setTicketOpen(false)}
        onDownloadPdf={() => void handleDownloadTicket()}
        downloading={downloading}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Booking confirmed</CardTitle>
            <CardDescription>
              Your booking #{id} is confirmed. View your ticket or download a PDF copy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && bookingData?.status === "CONFIRMED" && (
              <>
                <Button className="w-full rounded-xl" variant="outline" onClick={() => setTicketOpen(true)}>
                  Show ticket
                </Button>
                <Button className="w-full rounded-xl" onClick={() => void handleDownloadTicket()} disabled={downloading}>
                  {downloading ? "Preparing…" : "Download ticket (PDF)"}
                </Button>
              </>
            )}
            {!loading && bookingData && bookingData.status !== "CONFIRMED" && (
              <p className="text-sm text-muted-foreground">Ticket download is only available for confirmed bookings.</p>
            )}
            {trackable && (
              <Button variant="outline" className="w-full rounded-xl" asChild>
                <Link href={`/track?schedule_id=${bookingData.schedule.id}`}>Track bus</Link>
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" asChild>
                <Link href="/bookings">My Trips</Link>
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl" asChild>
                <Link href="/">Search again</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
