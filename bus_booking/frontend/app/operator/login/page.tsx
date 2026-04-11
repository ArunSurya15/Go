"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { auth as authApi, type MeResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default function OperatorLoginPage() {
  const router = useRouter();
  const { login, getValidToken } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
      const token = await getValidToken();
      if (!token) {
        setError("Could not get session.");
        setLoading(false);
        return;
      }
      const me = await authApi.me(token) as MeResponse;
      if (me.role === "OPERATOR" && me.operator_id) {
        router.push("/operator/dashboard");
      } else {
        setError("This account is not set up as an operator. Contact admin to link your account.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[min(70vh,36rem)] max-w-lg flex-col justify-center">
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 p-7 text-white shadow-xl shadow-indigo-600/20 ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 left-1/4 h-24 w-40 rounded-full bg-violet-400/20 blur-2xl" />
        <p className="relative flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-100/90">
          <Heart className="h-3.5 w-3.5 fill-current text-pink-200" aria-hidden />
          Welcome back
        </p>
        <h1 className="relative mt-2 text-2xl font-bold tracking-tight">Partner with e-GO</h1>
        <p className="relative mt-2 max-w-md text-sm leading-relaxed text-indigo-100/95">
          Reach more passengers and run buses, schedules, and payouts from one calm, clear workspace.
        </p>
      </div>
      <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/60 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/80">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg">Operator sign in</CardTitle>
          <CardDescription>Use the email or mobile number on your operator account (same as at sign-up).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="operator-login-id">Email or mobile number</Label>
              <Input
                id="operator-login-id"
                type="text"
                autoComplete="username"
                placeholder="you@company.com or 9876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="h-11 rounded-xl border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-950/50"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Older accounts may still sign in with a username if one was chosen at registration.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-xl border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-950/50"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-md shadow-indigo-600/25 hover:from-indigo-700 hover:to-violet-700"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            New here?{" "}
            <Link href="/operator/register" className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline dark:text-indigo-400">
              Create an operator account
            </Link>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            <Link href="/" className="font-medium text-slate-600 hover:underline dark:text-slate-300">
              Passenger booking
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
