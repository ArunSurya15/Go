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
import { Shield } from "lucide-react";

export default function AdminLoginPage() {
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
      if (me.role === "ADMIN") {
        router.push("/admin/dashboard");
      } else {
        setError("This account is not an admin. Use the passenger or operator login instead.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 rounded-xl bg-slate-900 p-6 text-white shadow-lg flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">e-GO Admin</h1>
          <p className="mt-2 text-sm text-slate-300">
            Approve schedules and manage operator accounts. Restricted access.
          </p>
        </div>
      </div>
      <Card className="border-slate-200 shadow-md dark:border-slate-800">
        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>
            Restricted area: your user must have role <strong>ADMIN</strong>. Use that account&apos;s email, mobile, or
            username with a strong password (same sign-in API as passengers and operators).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-user">Email or mobile number</Label>
              <Input
                id="admin-user"
                type="text"
                autoComplete="username"
                placeholder="admin@yourcompany.com or staff mobile"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Industry norm: identifier + password (and MFA for production). Magic links / SSO are optional add-ons;
                separate &quot;token-only&quot; admin URLs are uncommon compared to staff accounts with audit trails.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-pass">Password</Label>
              <Input
                id="admin-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            <Link href="/" className="text-indigo-600 hover:underline">Back to site</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
