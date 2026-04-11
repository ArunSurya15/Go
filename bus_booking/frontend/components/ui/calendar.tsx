"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

/**
 * Single-month calendar with brand-tinted CSS variables over react-day-picker defaults.
 */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <div
      className={cn(
        "calendar-skin rounded-2xl p-1.5",
        "[--rdp-accent-color:#4f46e5] [--rdp-accent-background-color:#eef2ff]",
        "[--rdp-day-height:2.25rem] [--rdp-day-width:2.25rem] [--rdp-day_button-height:2.125rem] [--rdp-day_button-width:2.125rem]",
        "[--rdp-day_button-border-radius:9999px] [--rdp-selected-border:2px_solid_#6366f1]",
        "dark:[--rdp-accent-background-color:rgba(49,46,129,0.35)] dark:[--rdp-today-color:#818cf8]",
        className
      )}
    >
      <DayPicker
        showOutsideDays={showOutsideDays}
        classNames={{
          root: "w-full",
          months: "relative flex flex-col gap-4 sm:flex-row",
          month: "flex w-full flex-col gap-1.5",
          month_caption: "relative mb-0.5 flex h-10 items-center justify-center px-11",
          caption_label: "text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100",
          nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between",
          button_previous:
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300",
          button_next:
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300",
          month_grid: "w-full border-collapse",
          weekdays: "mb-0.5 flex",
          weekday:
            "w-9 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 opacity-100 dark:text-slate-500",
          week: "mt-0.5 flex w-full",
          day: "relative size-9 p-0 text-center",
          day_button:
            "inline-flex size-9 items-center justify-center rounded-full text-sm font-medium text-slate-700 transition hover:bg-violet-100/90 hover:text-violet-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 dark:text-slate-200 dark:hover:bg-violet-950/35 dark:hover:text-violet-50",
          selected:
            "[&_button]:border-transparent [&_button]:bg-gradient-to-br [&_button]:from-indigo-500 [&_button]:to-violet-600 [&_button]:font-semibold [&_button]:text-white [&_button]:shadow-md [&_button]:shadow-indigo-600/25 [&_button]:hover:from-indigo-600 [&_button]:hover:to-violet-700",
          today: "[&_button]:ring-2 [&_button]:ring-indigo-400/70 [&_button]:ring-offset-0 dark:[&_button]:ring-indigo-500/50",
          outside: "opacity-40",
          disabled: "opacity-30",
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation }) => {
            if (orientation === "left") return <ChevronLeft className="h-4 w-4" aria-hidden />;
            if (orientation === "right") return <ChevronRight className="h-4 w-4" aria-hidden />;
            return <ChevronRight className="h-4 w-4 rotate-[-90deg]" aria-hidden />;
          },
        }}
        {...props}
      />
    </div>
  );
}
