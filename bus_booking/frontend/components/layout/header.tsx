"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { Bus } from "lucide-react";

export function Header() {
  const { token, logout, isLoading } = useAuth();
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
            animate={
              reduceMotion
                ? false
                : { y: [0, -2, 0], rotate: [0, -4, 4, 0] }
            }
            transition={
              reduceMotion
                ? undefined
                : { duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }
            }
            aria-hidden
          >
            <Bus className="h-5 w-5" strokeWidth={2.25} />
          </motion.span>
          <span>
            <span className="text-primary">Bus</span>Go
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Search
          </Link>
          {token && (
            <Link
              href="/bookings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              My Bookings
            </Link>
          )}
          <Link
            href="/operator/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            For operators
          </Link>
          {!isLoading && (
            <>
              {token ? (
                <Button variant="ghost" size="sm" onClick={logout}>
                  Logout
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/register">Register</Link>
                  </Button>
                </>
              )}
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
}
