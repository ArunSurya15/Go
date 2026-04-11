"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatLocalYMD, parseLocalYMD } from "@/lib/date-ymd";

type DatePickerFieldProps = {
  id?: string;
  /** `YYYY-MM-DD` in local calendar semantics. */
  value: string;
  onChange: (ymd: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Shows Clear — only use when parent can store an empty string. */
  allowClear?: boolean;
};

export function DatePickerField({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Pick date",
  className,
  allowClear,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalYMD(value);
  const fromDate = parseLocalYMD(min);
  const toDate = parseLocalYMD(max);

  const pickToday = () => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    if (fromDate && t < fromDate) return;
    if (toDate && t > toDate) return;
    onChange(formatLocalYMD(t));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "group flex h-9 w-full min-w-[9.5rem] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-left text-sm shadow-sm transition",
            "hover:border-indigo-200 hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-slate-600 dark:bg-slate-950/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/25",
            className
          )}
        >
          <span
            className={cn(
              "truncate tabular-nums",
              selected ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
            )}
          >
            {selected ? format(selected, "d MMM yyyy") : placeholder}
          </span>
          <CalendarDays
            className="h-4 w-4 shrink-0 text-indigo-500/85 transition group-hover:scale-105 group-hover:text-indigo-600 dark:text-indigo-400 dark:group-hover:text-indigo-300"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden border-slate-200/95 p-0 shadow-2xl dark:border-slate-700" align="start">
        <div className="bg-gradient-to-b from-white to-slate-50/80 p-2 dark:from-slate-900 dark:to-slate-950/90">
          <Calendar
            mode="single"
            required={false}
            selected={selected}
            defaultMonth={selected ?? fromDate ?? new Date()}
            onSelect={(d) => {
              if (d) {
                onChange(formatLocalYMD(d));
                setOpen(false);
              }
            }}
            fromDate={fromDate}
            toDate={toDate}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-gradient-to-r from-indigo-50/60 via-white to-violet-50/50 px-3 py-2.5 dark:border-slate-800 dark:from-indigo-950/30 dark:via-slate-900 dark:to-violet-950/20">
          <button
            type="button"
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {allowClear ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs font-semibold text-slate-600 hover:bg-white/90 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-indigo-200/90 bg-white px-3 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
              onClick={pickToday}
            >
              Today
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
