"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { userApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { Bus, User, Ticket, LogOut, ChevronDown } from "lucide-react";

function AvatarDropdown() {
  const { getValidToken, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [initials, setInitials] = useState("?");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getValidToken().then((t) => {
      if (!t) return;
      userApi.me(t).then((me) => {
        const n = me.name || me.username || me.email || "";
        setName(n.split(" ")[0]);
        const parts = n.trim().split(" ").filter(Boolean);
        setInitials(
          parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : n.slice(0, 2).toUpperCase() || "?"
        );
      }).catch(() => {});
    });
  }, [getValidToken]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 pl-1 pr-2.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold select-none">
          {initials}
        </span>
        <span className="text-sm font-medium max-w-[80px] truncate hidden sm:block">{name}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50 py-1 overflow-hidden">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <User className="h-4 w-4 text-slate-400" /> My account
          </Link>
          <Link
            href="/bookings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Ticket className="h-4 w-4 text-slate-400" /> My trips
          </Link>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { token, isLoading } = useAuth();
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2 font-semibold text-lg">
          <motion.span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
            animate={reduceMotion ? false : { y: [0, -2, 0], rotate: [0, -4, 4, 0] }}
            transition={reduceMotion ? undefined : { duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
            aria-hidden
          >
            <Bus className="h-5 w-5" strokeWidth={2.25} />
          </motion.span>
          <span><span className="text-primary">e</span>-GO</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Search
          </Link>
          <Link href="/operator/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            For operators
          </Link>

          {!isLoading && (
            token ? (
              <AvatarDropdown />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Register</Link>
                </Button>
              </div>
            )
          )}
        </nav>
      </div>
    </motion.header>
  );
}
