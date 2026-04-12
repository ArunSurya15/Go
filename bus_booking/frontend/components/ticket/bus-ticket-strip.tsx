import { cn } from "@/lib/utils";
import { BusSilhouette } from "@/components/icons/bus-silhouette";

export type BusTicketStripSummary = {
  routeLine: string;
  departureLine: string;
  pnr: string;
  seatsLine: string;
  passengerLine?: string;
};

function PerforationColumn() {
  return (
    <div
      className="flex w-2.5 shrink-0 flex-col items-center justify-between border-x border-slate-200/90 bg-slate-200/40 py-1.5 dark:border-slate-600 dark:bg-slate-700/50"
      aria-hidden
    >
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full border border-slate-300/80 bg-white shadow-sm dark:border-slate-500 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}

/** Horizontal bars distributed over full stub height (`flex-1` rows). */
function BarcodeStub({ rows = 32 }: { rows?: number }) {
  const pattern = [2, 3.5, 1.5, 4, 2.5, 1, 3, 2, 4.5, 1.5, 3.5, 2, 1, 3, 2.5, 4, 2, 3, 1.5, 2.5];
  const widthPct = [96, 98, 97, 99, 96, 97, 98, 96, 99, 97, 98, 96, 97, 99, 96, 98, 97, 99, 96, 98];
  const thickness = Array.from({ length: rows }, (_, i) => pattern[i % pattern.length]);
  return (
    <div
      className="flex h-full min-h-0 w-[2.65rem] shrink-0 flex-col bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800/60"
      aria-hidden
    >
      {thickness.map((th, i) => (
        <div key={i} className="flex min-h-0 flex-1 flex-col justify-center py-[0.5px]">
          <div
            className="self-center rounded-[1px] bg-slate-600/90 dark:bg-slate-400/85"
            style={{ width: `${widthPct[i % widthPct.length]}%`, height: `${th}px` }}
          />
        </div>
      ))}
    </div>
  );
}

type BusTicketStripProps = {
  className?: string;
  /** When set, shows route / time / PNR / seats beside the bus (modal ticket). */
  summary?: BusTicketStripSummary;
};

/**
 * Ticket visual: header, main row (bus + optional summary | perf | full-height barcode).
 */
export function BusTicketStrip({ className, summary }: BusTicketStripProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-indigo-200/80 shadow-sm dark:border-indigo-800/60",
        className
      )}
    >
      <div className="bg-indigo-700 py-1.5 text-center dark:bg-indigo-800">
        <p className="text-[9px] font-semibold uppercase tracking-[0.26em] text-indigo-100/90">e-GO</p>
        <p className="mt-0.5 text-[11px] font-bold tracking-[0.16em] text-white">Bus ticket</p>
      </div>
      <div className="flex min-h-[6.75rem] items-stretch bg-slate-100 dark:bg-slate-800/80 sm:min-h-[7.25rem]">
        <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-2.5 px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5">
          <div className="flex shrink-0 items-center">
            <BusSilhouette className="h-[4.5rem] w-auto sm:h-24" />
          </div>
          {summary ? (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-[10px] leading-snug text-slate-600 dark:text-slate-400 sm:text-[11px]">
              <p className="line-clamp-2 font-semibold text-slate-800 dark:text-slate-100">{summary.routeLine}</p>
              <p className="text-slate-600 dark:text-slate-400">{summary.departureLine}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-300">
                PNR <span className="font-semibold">{summary.pnr}</span>
              </p>
              <p className="font-medium text-slate-700 dark:text-slate-300">{summary.seatsLine}</p>
              {summary.passengerLine ? (
                <p className="line-clamp-1 text-slate-500 dark:text-slate-500">{summary.passengerLine}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1" />
          )}
        </div>
        <PerforationColumn />
        <BarcodeStub />
      </div>
    </div>
  );
}
