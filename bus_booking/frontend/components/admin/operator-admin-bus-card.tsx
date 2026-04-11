"use client";

import { useState } from "react";
import type { AdminOperatorBus } from "@/lib/api";
import { BUS_FEATURES_FALLBACK } from "@/lib/bus-features";
import { OperatorBusSeatPreview } from "@/components/admin/operator-bus-seat-preview";
import { ChevronDown, ChevronUp } from "lucide-react";

export function OperatorAdminBusCard({ bus }: { bus: AdminOperatorBus }) {
  const [open, setOpen] = useState(false);
  const labels = new Map(BUS_FEATURES_FALLBACK.map((f) => [f.id, f.label]));
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{bus.registration_no}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {bus.capacity} seats
            {bus.service_name ? ` · ${bus.service_name}` : ""}
          </p>
          {bus.features?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {bus.features.map((fid) => (
                <span
                  key={fid}
                  className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300"
                >
                  {labels.get(fid) ?? fid}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="text-slate-400 shrink-0 text-sm flex items-center gap-1">
          {open ? (
            <>
              Hide layout <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              View seat layout <ChevronDown className="h-4 w-4" />
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-700 pt-3">
          {bus.extras_note ? (
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              <span className="font-medium">Extras:</span> {bus.extras_note}
            </p>
          ) : null}
          <OperatorBusSeatPreview seatMap={bus.seat_map as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}
