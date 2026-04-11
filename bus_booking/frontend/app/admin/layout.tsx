"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { auth as authApi, type MeResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, logout, isLoading, getValidToken } = useAuth();
  const isLogin = pathname === "/admin/login";
  const [roleOk, setRoleOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (isLogin) {
      setRoleOk(null);
      return;
    }
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    let cancelled = false;
    (async () => {
      const t = await getValidToken();
      if (!t || cancelled) {
        if (!cancelled) router.replace("/admin/login");
        return;
      }
      try {
        const me = await authApi.me(t) as MeResponse;
        if (cancelled) return;
        if (me.role !== "ADMIN") {
          setRoleOk(false);
          router.replace("/admin/login");
          return;
        }
        setRoleOk(true);
      } catch {
        if (!cancelled) router.replace("/admin/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isLoading, isLogin, router, getValidToken]);

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
    router.refresh();
  };

  const showShell = !isLogin && token && roleOk;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b bg-white dark:bg-slate-900 shadow-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href={showShell ? "/admin/dashboard" : "/admin/login"} className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            <span className="rounded bg-slate-900 px-2 py-0.5 text-sm text-white">e-GO</span>
            <span className="hidden sm:inline text-sm text-slate-500">Admin</span>
          </Link>
          {showShell && (
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/admin/dashboard" className="text-slate-600 hover:text-indigo-600 dark:text-slate-400">
                Dashboard
              </Link>
              <Link href="/admin/schedules" className="text-slate-600 hover:text-indigo-600 dark:text-slate-400">
                Schedules
              </Link>
              <Link href="/admin/operators" className="text-slate-600 hover:text-indigo-600 dark:text-slate-400">
                Operators
              </Link>
              <Link href="/admin/audit" className="text-slate-600 hover:text-indigo-600 dark:text-slate-400">
                Audit log
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </nav>
          )}
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">
        {isLogin ? (
          children
        ) : !token || isLoading || roleOk === null ? (
          <div className="flex justify-center py-16 text-slate-500">Loading…</div>
        ) : roleOk === false ? (
          <div className="flex justify-center py-16 text-slate-500">Redirecting…</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
