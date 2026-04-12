"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { Bus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { operatorStaffLabel } from "@/lib/operator-staff";
import { OperatorSessionProvider, useOperatorSession } from "./operator-session";

type NavFilter = "all" | "operations" | "company";

const NAV: readonly {
  href: string;
  label: string;
  match: (p: string) => boolean;
  filter: NavFilter;
}[] = [
  { href: "/operator/dashboard", label: "Dashboard", match: (p: string) => p === "/operator/dashboard", filter: "all" },
  { href: "/operator/buses", label: "Buses", match: (p: string) => p.startsWith("/operator/buses"), filter: "all" },
  { href: "/operator/schedules", label: "Schedules", match: (p: string) => p.startsWith("/operator/schedules"), filter: "all" },
  { href: "/operator/sales", label: "Sales", match: (p: string) => p.startsWith("/operator/sales"), filter: "operations" },
  { href: "/operator/team", label: "Team", match: (p: string) => p.startsWith("/operator/team"), filter: "company" },
  { href: "/operator/onboarding", label: "Profile", match: (p: string) => p.startsWith("/operator/onboarding"), filter: "company" },
] as const;

function OperatorMainNav() {
  const pathname = usePathname();
  const { canManageOperations, canManageCompany } = useOperatorSession();
  const items = NAV.filter((n) => {
    if (n.filter === "operations") return canManageOperations;
    if (n.filter === "company") return canManageCompany;
    return true;
  });

  return (
    <>
      <nav className="hidden min-w-0 items-center gap-1 md:flex">
        {items.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                  : "text-slate-600 hover:bg-white/80 hover:text-indigo-700 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-indigo-300"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <nav className="flex max-w-[55vw] items-center gap-0.5 overflow-x-auto pb-0.5 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                active ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-400"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function OperatorLayoutInner({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, logout, isLoading } = useAuth();
  const { loading: sessionLoading, me } = useOperatorSession();
  const isLoginPage = pathname === "/operator/login";
  const isRegisterPage = pathname === "/operator/register";
  const isJoinPage = pathname === "/operator/join";
  const isAuthLite = isLoginPage || isRegisterPage || isJoinPage;

  useEffect(() => {
    if (isLoading) return;
    if (!isLoginPage && !isJoinPage && !token) router.replace("/operator/login");
  }, [token, isLoading, isLoginPage, isJoinPage, router]);

  const showContent = isLoginPage || isRegisterPage || isJoinPage || token;

  const handleLogout = () => {
    logout();
    router.push("/operator/login");
    router.refresh();
  };

  const subRole = (me?.operator_staff_role || "").trim();
  const showRoleBadge = Boolean(
    token &&
      !isLoginPage &&
      !sessionLoading &&
      me?.role === "OPERATOR" &&
      me.operator_id != null &&
      (subRole === "MANAGER" || subRole === "DISPATCHER")
  );
  const roleChipLabel = operatorStaffLabel(me);

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden",
        "bg-gradient-to-br from-slate-50 via-indigo-50/35 to-violet-50/50",
        "dark:from-slate-950 dark:via-indigo-950/25 dark:to-slate-950"
      )}
    >
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute -top-24 right-[-10%] h-[min(28rem,50vw)] w-[min(28rem,50vw)] rounded-full bg-violet-200/35 blur-3xl dark:bg-violet-900/15" />
        <div className="absolute bottom-[-15%] left-[-8%] h-[min(24rem,45vw)] w-[min(24rem,45vw)] rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/12" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-100/20 blur-3xl dark:bg-sky-900/10" />
      </div>

      <header
        className={cn(
          "sticky top-0 z-50 border-b backdrop-blur-xl",
          "border-slate-200/70 bg-white/80 shadow-sm shadow-slate-900/[0.04]",
          "dark:border-slate-800/80 dark:bg-slate-950/75 dark:shadow-black/20"
        )}
      >
        <div className="mx-auto flex h-[3.25rem] sm:h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={token ? "/operator/dashboard" : "/operator/login"}
            className="group flex min-w-0 items-center gap-2.5 rounded-2xl py-1 pr-2 transition-opacity hover:opacity-90"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25",
                "ring-2 ring-white/50 dark:ring-indigo-400/20"
              )}
            >
              <Bus className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.25} />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="flex items-center gap-1 text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                e-GO
                <Sparkles className="h-3 w-3 text-amber-400 opacity-80" aria-hidden />
              </span>
              <span className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">
                Operator workspace
              </span>
            </span>
          </Link>

          {token ? (
            !isLoginPage ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
                {showRoleBadge && roleChipLabel && (
                  <span
                    className="hidden max-w-[10rem] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 sm:inline-block"
                    title={
                      subRole === "DISPATCHER"
                        ? "View trips and bookings. Owners or managers change fares and refunds."
                        : "Manage trips and pricing. Company profile and invites: owner only."
                    }
                  >
                    {roleChipLabel}
                  </span>
                )}
                <OperatorMainNav />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full border-slate-200/90 bg-white/60 text-xs font-medium dark:border-slate-700 dark:bg-slate-900/50"
                  onClick={handleLogout}
                >
                  Log out
                </Button>
              </div>
            ) : (
              <Link href="/operator/dashboard">
                <Button size="sm" className="rounded-full bg-indigo-600 px-4 shadow-sm shadow-indigo-600/20 hover:bg-indigo-700">
                  Go to dashboard
                </Button>
              </Link>
            )
          ) : (
            <div className="flex items-center gap-2">
              {!isRegisterPage && (
                <Link href="/operator/register">
                  <Button variant="ghost" size="sm" className="rounded-full text-slate-600 dark:text-slate-400">
                    Register
                  </Button>
                </Link>
              )}
              {!isLoginPage && (
                <Link href="/operator/login">
                  <Button size="sm" className="rounded-full bg-indigo-600 px-4 shadow-sm shadow-indigo-600/20 hover:bg-indigo-700">
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto max-w-6xl px-4 sm:px-6",
          isAuthLite ? "py-10 sm:py-14" : "py-8 lg:py-10"
        )}
      >
        {showContent ? children : <div className="flex justify-center py-16 text-sm text-slate-500">Loading…</div>}
      </main>
    </div>
  );
}

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorSessionProvider>
      <OperatorLayoutInner>{children}</OperatorLayoutInner>
    </OperatorSessionProvider>
  );
}
