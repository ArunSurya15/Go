"use client";

import Link from "next/link";
import { Bus, Calendar, Download, MapPin, User, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Booking } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Row icons — indigo (e-GO brand). */
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
  return <div className="my-3 border-t border-dashed border-indigo-100 dark:border-indigo-900/50" />;
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-[61] flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ego-ticket-title"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-4 pb-3 pt-3 text-center text-white shadow-inner shadow-indigo-950/20 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-2 rounded-full p-1.5 text-white/90 hover:bg-white/10 sm:right-3 sm:top-3"
              aria-label="Close ticket"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-100">e-GO</p>
            <h2 id="ego-ticket-title" className="mt-1 text-lg font-bold leading-tight sm:text-xl">
              Ticket Information
            </h2>
            <p className="mt-1 text-xs text-indigo-50/95 sm:text-sm">{formatTripTitleLine(route, booking.schedule.departure_dt)}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-t border-white/10 bg-indigo-950/50 px-4 py-2 text-center text-xs text-white sm:text-sm">
            <span className="font-mono font-semibold">Trip #{booking.id}</span>
            <span className="text-indigo-200/70">|</span>
            <span>
              PNR <span className="font-mono font-semibold">{pnr(booking.id)}</span>
            </span>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-6">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Hey <span className="font-semibold text-slate-900 dark:text-slate-100">{name}</span>, thank you for booking with e-GO.
              Here are the details for your trip from{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">{route.origin}</span> to{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">{route.destination}</span>.
            </p>

            <div className="overflow-hidden rounded-lg border border-indigo-100/90 bg-white shadow-sm ring-1 ring-indigo-50 dark:border-indigo-900/50 dark:bg-slate-950 dark:ring-indigo-950/30">
              <div className="border-b border-indigo-100/80 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-50">
                Ticket details
              </div>
              <div className="px-3 py-3 sm:px-4">
                <div className="flex gap-3">
                  <Calendar className={rowIcon} aria-hidden />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Journey date &amp; time</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {formatSlashDateTime(booking.schedule.departure_dt)}
                    </p>
                  </div>
                </div>
                {dashedRule()}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <Bus className={rowIcon} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Travels</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{bus.operator_name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{service}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 sm:text-right">
                    <Wallet className={cn(rowIcon, "sm:order-2")} aria-hidden />
                    <div className="min-w-0 sm:order-1 sm:ml-auto sm:text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket price</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">₹{booking.amount}</p>
                      <p className="text-xs text-slate-500">(Inclusive of GST)</p>
                    </div>
                  </div>
                </div>
                {dashedRule()}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <MapPin className={rowIcon} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Boarding point</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {bp?.location_name || route.origin}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {[bp?.landmark, bp?.time ? `Reporting ${bp.time}` : ""].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {booking.contact_phone ? (
                        <a
                          href={`tel:${booking.contact_phone.replace(/\s/g, "")}`}
                          className="mt-1 inline-block text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {booking.contact_phone}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className={rowIcon} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dropping point</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {dp?.location_name || route.destination}
                      </p>
                      {dp?.description ? (
                        <p className="text-xs text-slate-600 dark:text-slate-400">{dp.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Arrival</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passenger</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{passengerSubline(booking)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seat no.</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{booking.seats.join(", ")}</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <Link href="/cancellation-policy" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Cancellation policy
              </Link>
              {" · "}
              <Link href="/terms" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Terms &amp; conditions
              </Link>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-indigo-100/80 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl border-indigo-200/80 dark:border-indigo-800"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-md shadow-indigo-600/25 hover:from-indigo-700 hover:to-violet-700 dark:shadow-indigo-900/30"
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
