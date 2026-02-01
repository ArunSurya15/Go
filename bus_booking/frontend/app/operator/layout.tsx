"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function OperatorLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, logout, isLoading } = useAuth();
  const isLoginPage = pathname === "/operator/login";

  useEffect(() => {
    if (isLoading) return;
    if (!isLoginPage && !token) router.replace("/operator/login");
  }, [token, isLoading, isLoginPage, router]);

  const showContent = isLoginPage || token;

  const handleLogout = () => {
    logout();
    router.push("/operator/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/operator/dashboard" className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="rounded bg-indigo-600 px-2 py-0.5 text-sm text-white">e-GO</span>
            <span className="hidden sm:inline">for Operators</span>
          </Link>
          <nav className="flex items-center gap-2">
            {token && !isLoginPage && (
              <>
                <Link
                  href="/operator/dashboard"
                  className="text-sm text-slate-600 hover:text-indigo-600"
                >
                  Dashboard
                </Link>
                <Link
                  href="/operator/onboarding"
                  className="text-sm text-slate-600 hover:text-indigo-600"
                >
                  Profile
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            )}
            {!token && (
              <Link href="/operator/login">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">
        {showContent ? children : <div className="flex justify-center py-12 text-slate-500">Loading…</div>}
      </div>
    </div>
  );
}
