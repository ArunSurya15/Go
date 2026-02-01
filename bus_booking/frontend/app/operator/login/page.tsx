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

export default function OperatorLoginPage() {
  const router = useRouter();
  const { login, getValidToken } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
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
    <div className="mx-auto max-w-lg">
      <div className="mb-8 rounded-xl bg-indigo-600 p-6 text-white shadow-lg">
        <h1 className="text-xl font-bold">Partner with e-GO</h1>
        <p className="mt-2 text-sm text-indigo-100">
          Reach more passengers. Manage your buses and schedules in one place.
        </p>
      </div>
      <Card className="border-slate-200 shadow-md">
        <CardHeader>
          <CardTitle>Operator sign in</CardTitle>
          <CardDescription>Use your operator account to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="border-slate-300"
              />
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
                className="border-slate-300"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            Don&apos;t have an operator account?{" "}
            <Link href="/operator/register" className="text-indigo-600 hover:underline">Register as operator</Link>
            {" · "}
            <Link href="/" className="text-indigo-600 hover:underline">Book as passenger</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
