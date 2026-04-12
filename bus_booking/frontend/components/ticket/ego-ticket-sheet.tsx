"use client";

import Link from "next/link";
import { Bus, Calendar, Download, MapPin, User, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Booking } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BusTicketStrip } from "@/components/ticket/bus-ticket-strip";

const rowIcon = "mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400";

function pnr(id: number) {
  return `EGO${String(id).padStart(7, "0")}`;
}

function formatSlashDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
}

function formatTripTitleLine(route: { origin: string; destination: string }, departureIso: string) {
  const d = new Date(departureIso);
  const day = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${route.origin} → ${route.destination} · ${day}`;
}

function passengerSubline(booking: Booking): string {
  const seats = booking.seats || [];
  const pd = booking.passenger_details || {};
  const first = seats[0];
  const p = first ? pd[first] : undefined;
  const parts: string[] = [];
  if (p?.age) parts.push(`${p.age} yrs`);
  if (p?.gender) parts.push(String(p.gender).toUpperCase());
  return parts.join(", ") || "—";
}

function dashedRule() {
  return <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-600" />;
}

export function EgoTicketSheet({
  booking,
  open,
  onClose,
  onDownloadPdf,
  downloading,
}: {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  downloading?: boolean;
}) {
  if (!open || !booking) return null;

  const route = booking.schedule.route;
  const bus = booking.schedule.bus;
  const bp = booking.boarding_point;
  const dp = booking.dropping_point;
  const name = booking.passenger_display_name || "Passenger";
  const service = (bus.service_name || "").trim() || "Bus";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-gradient-to-b from-slate-900/55 via-slate-900/45 to-indigo-950/50 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-[61] flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/20 bg-white/95 shadow-2xl shadow-indigo-900/15 ring-1 ring-indigo-900/[0.06] dark:border-slate-600/80 dark:bg-slate-900/95 dark:shadow-black/40 dark:ring-indigo-400/10 sm:rounded-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200 ease-out"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ego-ticket-title"
      >
        <div
          className="pointer-events-none h-1 w-full shrink-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600"
          aria-hidden
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative overflow-hidden border-b border-indigo-100/70 bg-gradient-to-b from-indigo-50/95 via-white to-slate-50 px-4 pb-5 pt-4 dark:border-indigo-900/35 dark:from-indigo-950/45 dark:via-slate-900 dark:to-slate-950 sm:px-6">
            <div
              className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/10"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/5"
              aria-hidden
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200/90 transition hover:bg-white hover:text-indigo-700 hover:ring-indigo-200/80 dark:bg-slate-800/90 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300 dark:hover:ring-indigo-500/30 sm:right-3 sm:top-4"
              aria-label="Close ticket"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative mt-1 pr-11 sm:pr-12">
              <BusTicketStrip
                className="w-full max-w-none shadow-md shadow-indigo-900/8 ring-1 ring-indigo-900/[0.04] dark:shadow-black/30 dark:ring-white/5"
                summary={{
                  routeLine: `${route.origin} → ${route.destination}`,
                  departureLine: formatSlashDateTime(booking.schedule.departure_dt),
                  pnr: pnr(booking.id),
                  seatsLine:
                    booking.seats.length > 0
                      ? `Seat${booking.seats.length > 1 ? "s" : ""}: ${booking.seats.join(", ")}`
                      : "Seat: —",
                  passengerLine: name,
                }}
              />
            </div>
            <h2
              id="ego-ticket-title"
              className="relative mt-4 text-center text-lg font-bold tracking-tight text-indigo-950 dark:text-indigo-50"
            >
              Ticket Information
            </h2>
            <p className="relative mt-1.5 text-center text-sm font-medium leading-snug text-indigo-900/75 dark:text-indigo-200/80">
              {formatTripTitleLine(route, booking.schedule.departure_dt)}
            </p>
          </div>
          <div className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/90 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-900/40 dark:from-indigo-950/50 dark:via-slate-900 dark:to-indigo-950/40 dark:text-indigo-100 sm:text-sm">
            <span className="font-mono font-medium">Trip #{booking.id}</span>
            <span className="text-indigo-200 dark:text-indigo-700">|</span>
            <span>
              PNR <span className="font-mono font-medium">{pnr(booking.id)}</span>
            </span>
          </div>

          <div className="space-y-5 bg-white px-4 py-5 dark:bg-slate-900 sm:px-6">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Hey <span className="font-medium text-slate-900 dark:text-slate-100">{name}</span>, thank you for booking with e-GO.
              Here are the details for your trip from{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">{route.origin}</span> to{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">{route.destination}</span>.
            </p>

            <div className="overflow-hidden rounded-xl border border-indigo-100/90 bg-white shadow-md shadow-indigo-900/5 ring-1 ring-indigo-50 dark:border-indigo-900/40 dark:bg-slate-950 dark:shadow-none dark:ring-indigo-950/60">
              <div className="border-b border-indigo-700/10 bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 py-2.5 text-sm font-semibold tracking-wide text-white shadow-sm dark:from-indigo-700 dark:to-indigo-800">
                Ticket details
              </div>
              <div className="px-3 py-4 sm:px-4">
                <div className="flex gap-3">
                  <Calendar className={rowIcon} aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Journey date &amp; time</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatSlashDateTime(booking.schedule.departure_dt)}
                    </p>
                  </div>
                </div>
                {dashedRule()}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <Bus className={rowIcon} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Travels</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{bus.operator_name}</p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{service}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 sm:text-right">
                    <Wallet className={cn(rowIcon, "sm:order-2")} aria-hidden />
                    <div className="min-w-0 sm:order-1 sm:ml-auto sm:text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ticket price</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">₹{booking.amount}</p>
                      <p className="mt-0.5 text-xs text-slate-500">(Inclusive of GST)</p>
                    </div>
                  </div>
                </div>
                {dashedRule()}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <MapPin className={rowIcon} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Boarding point</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {bp?.location_name || route.origin}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {[bp?.landmark, bp?.time ? `Reporting ${bp.time}` : ""].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {booking.contact_phone ? (
                        <a
                          href={`tel:${booking.contact_phone.replace(/\s/g, "")}`}
                          className="mt-1.5 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {booking.contact_phone}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className={rowIcon} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dropping point</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {dp?.location_name || route.destination}
                      </p>
                      {dp?.description ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{dp.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Arrival</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatSlashDateTime(booking.schedule.arrival_dt)}
                      </p>
                    </div>
                  </div>
                </div>
                {dashedRule()}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <User className={rowIcon} aria-hidden />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Passenger</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{passengerSubline(booking)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Seat no.</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{booking.seats.join(", ")}</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
              <Link href="/cancellation-policy" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Cancellation policy
              </Link>
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
              <Link href="/terms" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Terms &amp; conditions
              </Link>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-indigo-100/80 bg-gradient-to-b from-slate-50 to-white p-3 dark:border-indigo-900/30 dark:from-slate-900 dark:to-slate-950 sm:gap-3 sm:px-6 sm:py-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl border-indigo-200/90 font-medium text-indigo-950 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-100 dark:hover:bg-indigo-950/50"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 font-medium text-white shadow-md shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 dark:from-indigo-500 dark:to-indigo-600 dark:hover:from-indigo-400 dark:hover:to-indigo-500"
            onClick={onDownloadPdf}
            disabled={downloading}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
