"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { routes } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  value: string;
  onChange: (v: string) => void;
  field: "origin" | "destination";
  /** When field is `destination`, optional origin to limit suggestions to served pairs. */
  originNarrow?: string;
  placeholder?: string;
  className?: string;
};

export function CityAutocompleteInput({
  id,
  value,
  onChange,
  field,
  originNarrow,
  placeholder,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const q = value.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      routes
        .suggestPlaces({
          q,
          field,
          from: field === "destination" ? originNarrow?.trim() || undefined : undefined,
          signal: ac.signal,
        })
        .then((r) => {
          if (!ac.signal.aborted) setSuggestions(r.results ?? []);
        })
        .catch(() => {
          if (!ac.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [value, field, originNarrow]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
    },
    [onChange]
  );

  const showEmptyHint =
    open && !loading && value.trim().length >= 2 && suggestions.length === 0;
  const showList = open && (loading || suggestions.length > 0 || showEmptyHint);

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={cn("h-11", className)}
        autoComplete="off"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[80] mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          ) : null}
          {showEmptyHint ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No cities in our routes match that text yet.
            </li>
          ) : null}
          {suggestions.map((name) => (
            <li key={name} role="option">
              <button
                type="button"
                tabIndex={-1}
                className="flex w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
