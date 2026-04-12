"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorStaffInviteRow, type OperatorStaffRow } from "@/lib/api";
import { CompanyOwnerGate } from "@/app/operator/capability-gates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function roleLabel(r: string) {
  const x = (r || "").trim();
  if (x === "MANAGER") return "Manager";
  if (x === "DISPATCHER") return "Dispatcher";
  if (x === "OWNER") return "Owner";
  return "Owner (legacy)";
}

function fmtInviteExpiry(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function TeamInner() {
  const { getValidToken } = useAuth();
  const [rows, setRows] = useState<OperatorStaffRow[]>([]);
  const [pending, setPending] = useState<OperatorStaffInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MANAGER" | "DISPATCHER">("MANAGER");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState("");
  const [pendingActionId, setPendingActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;
    setLoading(true);
    setErr("");
    try {
      const res = await operatorApi.staffList(token);
      setRows(res.results || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load team.");
    } finally {
      setLoading(false);
    }
  }, [getValidToken]);

  const loadPending = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;
    setPendingLoading(true);
    try {
      const res = await operatorApi.staffInvitesList(token);
      setPending(res.results || []);
    } catch {
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  }, [getValidToken]);

  useEffect(() => {
    void load();
    void loadPending();
  }, [load, loadPending]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getValidToken();
    if (!token) return;
    setInviting(true);
    setInviteMsg("");
    setInviteUrl(null);
    try {
      const res = await operatorApi.createStaffInvite(token, {
        email: email.trim().toLowerCase(),
        role,
      });
      setInviteMsg(res.detail || "Invite created.");
      setInviteUrl(res.invite_url);
      setEmail("");
      await load();
      await loadPending();
    } catch (ex) {
      setInviteMsg(ex instanceof Error ? ex.message : "Invite failed.");
    } finally {
      setInviting(false);
    }
  };

  const copy = () => {
    if (!inviteUrl || typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(inviteUrl);
  };

  const copyRowUrl = (url: string) => {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(url);
  };

  const revokeInvite = async (id: number) => {
    if (!confirm("Revoke this invite? The link will stop working.")) return;
    const token = await getValidToken();
    if (!token) return;
    setPendingActionId(id);
    try {
      await operatorApi.revokeStaffInvite(token, id);
      await loadPending();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not revoke.");
    } finally {
      setPendingActionId(null);
    }
  };

  const resendInvite = async (id: number) => {
    const token = await getValidToken();
    if (!token) return;
    setPendingActionId(id);
    try {
      const res = await operatorApi.resendStaffInvite(token, id);
      setInviteMsg(res.detail);
      await loadPending();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not resend.");
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <div>
        <Link href="/operator/dashboard" className="text-sm text-slate-500 hover:text-indigo-600">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Team &amp; roles</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          <strong>Owner</strong> — company profile, bank/KYC, invites.{" "}
          <strong>Manager</strong> — day-to-day fares, schedules, refunds, sales.{" "}
          <strong>Dispatcher</strong> — view trips, manifests, exports only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite teammate</CardTitle>
          <CardDescription>
            We email a one-time link when Resend is configured (RESEND_API_KEY). You can always copy the link here.
            Invites last 7 days — use Resend on a pending invite to extend and email again. Use a fresh email not
            already registered on e-GO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Role</Label>
              <select
                id="inv-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "MANAGER" | "DISPATCHER")}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="MANAGER">Manager — pricing, fleet, refunds, sales</option>
                <option value="DISPATCHER">Dispatcher — view-only + manifests</option>
              </select>
            </div>
            {inviteMsg && (
              <p className={`text-sm ${inviteUrl ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {inviteMsg}
              </p>
            )}
            {inviteUrl && (
              <div className="space-y-1.5">
                <Label>Share this link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={inviteUrl} className="rounded-xl font-mono text-xs" />
                  <Button type="button" variant="outline" className="shrink-0 rounded-xl" onClick={copy}>
                    Copy
                  </Button>
                </div>
              </div>
            )}
            <Button type="submit" disabled={inviting} className="rounded-full bg-indigo-600">
              {inviting ? "Creating…" : "Create invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>
            Not yet accepted. Revoke removes the link; Resend emails again and adds 7 days from today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-slate-500">No pending invites.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{p.email}</p>
                    <p className="text-xs text-slate-500">
                      {roleLabel(p.role)} · expires {fmtInviteExpiry(p.expires_at)}
                      {p.expired ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Expired
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={pendingActionId === p.id}
                      onClick={() => copyRowUrl(p.invite_url)}
                    >
                      Copy link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={pendingActionId === p.id}
                      onClick={() => void resendInvite(p.id)}
                    >
                      {pendingActionId === p.id ? "…" : "Resend"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-red-600 hover:text-red-700 dark:text-red-400"
                      disabled={pendingActionId === p.id}
                      onClick={() => void revokeInvite(p.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operator logins</CardTitle>
          <CardDescription>Everyone linked to your operator account.</CardDescription>
        </CardHeader>
        <CardContent>
          {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No operator users found.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{r.email || r.username}</p>
                    <p className="text-xs text-slate-500">{r.username}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {roleLabel(r.operator_staff_role)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OperatorTeamPage() {
  return (
    <CompanyOwnerGate>
      <TeamInner />
    </CompanyOwnerGate>
  );
}
