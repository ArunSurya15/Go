"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { operatorApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperatorJoinPage() {
  const [token, setToken] = useState("");
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewErr, setPreviewErr] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    setToken(q.get("token") || "");
  }, []);

  useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      setPreviewErr("Missing invite token. Open the link from your invite email or ask your owner to resend.");
      return;
    }
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      setPreviewErr("");
      try {
        const p = await operatorApi.staffInvitePreview(token);
        if (cancelled) return;
        if (!p.valid) {
          setPreviewErr(p.detail || "Invalid invite.");
          return;
        }
        setEmail(p.email || "");
        setRole(p.role || "");
        setOperatorName(p.operator_name || "");
      } catch (e) {
        if (!cancelled) setPreviewErr(e instanceof Error ? e.message : "Could not load invite.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setDoneMsg("");
    try {
      const res = await operatorApi.staffInviteAccept({
        token,
        password,
        name: name.trim() || undefined,
      });
      setDoneMsg(res.detail || "Success.");
    } catch (ex) {
      setDoneMsg(ex instanceof Error ? ex.message : "Failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Card className="border-slate-200 shadow-lg dark:border-slate-800">
        <CardHeader>
          <CardTitle>Join {operatorName || "operator"} workspace</CardTitle>
          <CardDescription>
            {previewLoading
              ? "Checking your invite…"
              : previewErr
                ? previewErr
                : `You’re invited as ${role === "MANAGER" ? "Manager" : "Dispatcher"} (${email}). Set a password to finish.`}
          </CardDescription>
        </CardHeader>
        {!previewLoading && !previewErr && email && (
          <CardContent>
            {doneMsg && (
              <div className="mb-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                <p>{doneMsg}</p>
                <Button asChild className="w-full rounded-full bg-indigo-600">
                  <Link href="/operator/login">Go to operator sign in</Link>
                </Button>
              </div>
            )}
            {!doneMsg && (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="join-name">Your name (optional)</Label>
                  <Input id="join-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="join-pw">Password</Label>
                  <Input
                    id="join-pw"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-slate-500">At least 8 characters.</p>
                </div>
                <Button type="submit" disabled={saving} className="w-full rounded-full bg-indigo-600">
                  {saving ? "Creating account…" : "Create account"}
                </Button>
              </form>
            )}
          </CardContent>
        )}
      </Card>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/operator/login" className="text-indigo-600 hover:underline">
          Already have an account? Sign in
        </Link>
      </p>
    </div>
  );
}
