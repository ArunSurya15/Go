"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { booking, type Booking } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MyBookingsPage() {
  const router = useRouter();
  const { token, getValidToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const validToken = await getValidToken();
      if (!validToken) {
        router.replace("/login");
        return;
      }
      try {
        const b = await booking.list(validToken);
        if (!cancelled) setBookings(b);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load bookings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getValidToken, router]);

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Please log in to view your bookings.</p>
        <Button onClick={() => router.push("/login")}>Login</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Loading bookings…
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <Button asChild>
          <Link href="/">Search buses</Link>
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="py-4 text-red-700">{error}</CardContent>
        </Card>
      )}

      {bookings.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-4">No bookings yet.</p>
            <Button asChild>
              <Link href="/">Search and book a bus</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {bookings.map((b) => {
          const dep = new Date(b.schedule.departure_dt);
          const arr = new Date(b.schedule.arrival_dt);
          const route = b.schedule.route;
          return (
            <Card key={b.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {route.origin} → {route.destination}
                    </CardTitle>
                    <CardDescription>
                      Booking #{b.id} · {b.schedule.bus.operator_name}
                    </CardDescription>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      b.status === "CONFIRMED"
                        ? "bg-green-100 text-green-700"
                        : b.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Departure</p>
                    <p className="font-medium">
                      {dep.toLocaleDateString()} {dep.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Arrival</p>
                    <p className="font-medium">
                      {arr.toLocaleDateString()} {arr.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seats</p>
                  <p className="font-medium">{b.seats.join(", ")}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-lg font-semibold">₹{b.amount}</p>
                  <div className="flex gap-2">
                    {b.status === "CONFIRMED" && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/booking/${b.id}`}>View ticket</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/track?schedule_id=${b.schedule.id}`}>Track bus</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
