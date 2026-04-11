"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { adminApi, type AdminOperator } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperatorKycWorkspace, type KycChecklistState } from "@/components/admin/operator-kyc-workspace";
import { ChevronDown, ChevronUp, Info, Loader2, Save } from "lucide-react";

/** VERIFIED / APPROVED: operator cleared — new schedules go live without admin trip approval. */
const KYC_OPTIONS = ["PENDING", "VERIFIED", "APPROVED", "REJECTED"];

function humanizeKey(key: string): string {
  if (key.startsWith("_")) return key;
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function KeyValueGrid({ title, data }: { title: string; data: Record<string, unknown> | string }) {
  if (typeof data === "string") {
    const t = data.trim();
    if (!t) return <p className="text-sm text-slate-500">No {title.toLowerCase()} on file.</p>;
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</p>
        <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">{data}</pre>
      </div>
    );
  }
  const unparsed = data._unparsed;
  if (typeof unparsed === "string") {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-2">{title} (could not parse as JSON)</p>
        <pre className="text-xs whitespace-pre-wrap break-words">{unparsed}</pre>
      </div>
    );
  }
  const entries = Object.entries(data).filter(([k]) => !k.startsWith("_"));
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No {title.toLowerCase()} on file.</p>;
  }
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        {title}
      </p>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,30%)_1fr] gap-1 px-4 py-2.5 text-sm">
            <dt className="text-slate-500 dark:text-slate-400 font-medium">{humanizeKey(k)}</dt>
            <dd className="text-slate-800 dark:text-slate-200 break-words">{formatValue(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function checklistFromServer(op: AdminOperator): KycChecklistState {
  const o = (op.kyc_checklist || {}) as Record<string, unknown>;
  return {
    personal_reviewed: Boolean(o.personal_reviewed),
    fleet_reviewed: Boolean(o.fleet_reviewed),
    identity_payout_reviewed: Boolean(o.identity_payout_reviewed),
  };
}

function OperatorsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterPending = searchParams.get("filter") === "pending";
  const { getValidToken } = useAuth();
  const [rows, setRows] = useState<AdminOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, Partial<AdminOperator>>>({});
  const [advancedOpen, setAdvancedOpen] = useState<Record<number, boolean>>({});
  const [advancedDraft, setAdvancedDraft] = useState<Record<number, { contact: string; bank: string }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [clarifyingId, setClarifyingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const token = await getValidToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setLoading(true);
    try {
      const list = await adminApi.operators(token, filterPending ? "PENDING" : undefined);
      setRows(list);
      setEdits({});
      setAdvancedOpen({});
      setAdvancedDraft({});
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getValidToken, router, filterPending]);

  useEffect(() => {
    load();
  }, [load]);

  const field = (id: number, key: keyof AdminOperator, value: string) => {
    setEdits((e) => ({
      ...e,
      [id]: { ...e[id], [key]: value },
    }));
  };

  const mergedChecklist = (op: AdminOperator): KycChecklistState => {
    const e = edits[op.id]?.kyc_checklist;
    if (e && typeof e === "object" && !Array.isArray(e)) {
      const x = e as Record<string, unknown>;
      return {
        personal_reviewed: Boolean(x.personal_reviewed),
        fleet_reviewed: Boolean(x.fleet_reviewed),
        identity_payout_reviewed: Boolean(x.identity_payout_reviewed),
      };
    }
    return checklistFromServer(op);
  };

  const mergedInternalNotes = (op: AdminOperator): string => {
    if (edits[op.id] && "kyc_internal_notes" in edits[op.id]!) {
      return String(edits[op.id]!.kyc_internal_notes ?? "");
    }
    return op.kyc_internal_notes ?? "";
  };

  const display = (op: AdminOperator, key: keyof AdminOperator): string => {
    const o = edits[op.id];
    if (o && key in o && o[key] !== undefined) return String(o[key]);
    return String(op[key] ?? "");
  };

  const toggleAdvanced = (op: AdminOperator) => {
    const open = !advancedOpen[op.id];
    setAdvancedOpen((a) => ({ ...a, [op.id]: open }));
    if (open && !advancedDraft[op.id]) {
      const c = typeof op.contact_info === "object" && op.contact_info && !("_unparsed" in op.contact_info)
        ? op.contact_info
        : {};
      const b = typeof op.bank_details === "object" && op.bank_details && !("_unparsed" in op.bank_details)
        ? op.bank_details
        : {};
      setAdvancedDraft((d) => ({
        ...d,
        [op.id]: {
          contact: JSON.stringify(c, null, 2),
          bank: JSON.stringify(b, null, 2),
        },
      }));
    }
  };

  const save = async (op: AdminOperator) => {
    const ed = edits[op.id] || {};
    const patch: Parameters<typeof adminApi.updateOperator>[2] = {};
    if (ed.name !== undefined && ed.name !== op.name) patch.name = ed.name;
    if (ed.kyc_status !== undefined && ed.kyc_status !== op.kyc_status) patch.kyc_status = ed.kyc_status;
    if (advancedOpen[op.id] && advancedDraft[op.id]) {
      try {
        patch.contact_info = JSON.parse(advancedDraft[op.id].contact || "{}");
      } catch {
        setMsg({ type: "err", text: `Contact info JSON is invalid for ${op.name}.` });
        return;
      }
      try {
        patch.bank_details = JSON.parse(advancedDraft[op.id].bank || "{}");
      } catch {
        setMsg({ type: "err", text: `Bank details JSON is invalid for ${op.name}.` });
        return;
      }
    }
    const chk = mergedChecklist(op);
    const chkServer = checklistFromServer(op);
    if (JSON.stringify(chk) !== JSON.stringify(chkServer)) {
      patch.kyc_checklist = {
        personal_reviewed: chk.personal_reviewed,
        fleet_reviewed: chk.fleet_reviewed,
        identity_payout_reviewed: chk.identity_payout_reviewed,
      };
    }
    const notes = mergedInternalNotes(op);
    if (notes !== (op.kyc_internal_notes ?? "")) {
      patch.kyc_internal_notes = notes;
    }

    const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
    if (keys.length === 0) {
      setMsg({ type: "err", text: "Nothing to save — change KYC, name, checklist, notes, or edit JSON." });
      return;
    }
    setSavingId(op.id);
    setMsg(null);
    const token = await getValidToken();
    if (!token) return;
    try {
      await adminApi.updateOperator(token, op.id, patch);
      setMsg({ type: "ok", text: `Saved ${op.name}.` });
      setEdits((e) => {
        const next = { ...e };
        delete next[op.id];
        return next;
      });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSavingId(null);
    }
  };

  const dirty = (op: AdminOperator) => {
    const e = edits[op.id];
    const hasBasic =
      !!e &&
      (("name" in e && e.name !== op.name) ||
        ("kyc_status" in e && e.kyc_status !== op.kyc_status));
    const hasJson = advancedOpen[op.id] && advancedDraft[op.id];
    const chkDirty = JSON.stringify(mergedChecklist(op)) !== JSON.stringify(checklistFromServer(op));
    const notesDirty = mergedInternalNotes(op) !== (op.kyc_internal_notes ?? "");
    return Boolean(hasBasic || hasJson || chkDirty || notesDirty);
  };

  const sendClarification = async (op: AdminOperator, subject: string, message: string) => {
    setClarifyingId(op.id);
    setMsg(null);
    const token = await getValidToken();
    if (!token) return;
    try {
      await adminApi.requestOperatorInfo(token, op.id, { subject, message });
      setMsg({ type: "ok", text: `Clarification request sent for ${op.name}.` });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Send failed." });
    } finally {
      setClarifyingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Operators</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Review contact &amp; bank details, verify bus layouts, then set KYC to VERIFIED or APPROVED. Only new or
            unverified operators need this; once cleared, their new schedules go live without the trip approval queue.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={filterPending ? "default" : "outline"} size="sm" asChild>
            <Link href="/admin/operators?filter=pending">KYC pending</Link>
          </Button>
          <Button variant={!filterPending ? "default" : "outline"} size="sm" asChild>
            <Link href="/admin/operators">All operators</Link>
          </Button>
        </div>
      </div>

      <Card className="border-indigo-100 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-600 shrink-0" />
            How KYC works (e-GO vs large aggregators)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
          <p>
            <strong className="text-slate-800 dark:text-slate-200">Industry pattern (e.g. redBus-style onboarding):</strong>{" "}
            operators typically submit <strong>PAN</strong>, <strong>GSTIN</strong>, <strong>cancelled cheque</strong> or
            bank proof, and a <strong>payment mandate</strong> — then the platform does a mix of automated checks (where
            APIs exist) and human review. Vehicle <strong>RC</strong> / <strong>fitness (FC)</strong> / permits are not
            always collected in self-serve flows; many marketplaces start with registration number + payout verification
            and add RTO integrations later.
          </p>
          <p>
            <strong className="text-slate-800 dark:text-slate-200">This app today:</strong> we can validate{" "}
            <strong>formats</strong> (PAN, GSTIN, IFSC, Aadhaar last four) — not legitimacy. Real PAN/Aadhaar/bank/GST
            matching needs regulated APIs (NSDL, UIDAI e-KYC, penny-drop, GST portal) or trusted third-party KYC
            vendors. <strong>Admin review</strong> stays responsible for document truth; use the tabs below and “Request
            more information” to close gaps.
          </p>
          <p>
            <strong className="text-slate-800 dark:text-slate-200">Current account + GST-linked bank:</strong> rules like
            “payout must be current account matching GST” are business policy — enforce via manual review and/or later
            payout APIs (bank account verification services return account type / name match hints when available).
          </p>
          <p>
            <strong className="text-slate-800 dark:text-slate-200">Trips:</strong> unverified operators stay in the
            schedule approval queue; after KYC is VERIFIED/APPROVED, new trips can go live without per-trip approval.
          </p>
        </CardContent>
      </Card>

      {msg && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{filterPending ? "KYC queue" : "All operators"}</CardTitle>
          <CardDescription>{loading ? "Loading…" : `${rows.length} operator${rows.length !== 1 ? "s" : ""}`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          {!loading && rows.length === 0 ? (
            <p className="text-center text-slate-500 py-6">No operators in this list.</p>
          ) : (
            rows.map((op) => {
              const contact =
                typeof op.contact_info === "object" && op.contact_info
                  ? op.contact_info
                  : { _unparsed: String(op.contact_info || "") };
              const bank =
                typeof op.bank_details === "object" && op.bank_details
                  ? op.bank_details
                  : { _unparsed: String(op.bank_details || "") };
              const buses = op.buses ?? [];
              const s = savingId === op.id;
              const d = dirty(op);

              return (
                <div
                  key={op.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-5 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{op.name}</p>
                      <p className="text-xs text-slate-500">
                        {op.buses_count} bus{op.buses_count !== 1 ? "es" : ""} · {op.users_count} login account
                        {op.users_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button size="sm" disabled={!d || s} onClick={() => save(op)} className="gap-1">
                      {s ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save changes
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>KYC status</Label>
                      <select
                        value={display(op, "kyc_status")}
                        onChange={(e) => field(op.id, "kyc_status", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {KYC_OPTIONS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Company name</Label>
                      <Input value={display(op, "name")} onChange={(e) => field(op.id, "name", e.target.value)} />
                    </div>
                  </div>

                  <OperatorKycWorkspace
                    contact={contact as Record<string, unknown>}
                    bank={bank as Record<string, unknown>}
                    buses={buses}
                    hints={op.kyc_format_hints ?? null}
                    checklist={mergedChecklist(op)}
                    onChecklistChange={(c) =>
                      setEdits((e) => ({
                        ...e,
                        [op.id]: { ...e[op.id], kyc_checklist: c },
                      }))
                    }
                    internalNotes={mergedInternalNotes(op)}
                    onInternalNotesChange={(notes) =>
                      setEdits((e) => ({
                        ...e,
                        [op.id]: { ...e[op.id], kyc_internal_notes: notes },
                      }))
                    }
                    onSendClarification={(subject, message) => sendClarification(op, subject, message)}
                    sendingClarification={clarifyingId === op.id}
                  />

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <button
                      type="button"
                      onClick={() => toggleAdvanced(op)}
                      className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {advancedOpen[op.id] ? "Hide" : "Edit"} contact &amp; bank as JSON
                      {advancedOpen[op.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {advancedOpen[op.id] && advancedDraft[op.id] && (
                      <div className="mt-3 grid gap-4 sm:grid-cols-1">
                        <div className="space-y-1.5">
                          <Label>Contact info (JSON)</Label>
                          <textarea
                            value={advancedDraft[op.id].contact}
                            onChange={(e) =>
                              setAdvancedDraft((d) => ({
                                ...d,
                                [op.id]: { ...d[op.id]!, contact: e.target.value },
                              }))
                            }
                            rows={12}
                            className="font-mono text-xs w-full rounded-md border border-input bg-background px-3 py-2"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Bank details (JSON)</Label>
                          <textarea
                            value={advancedDraft[op.id].bank}
                            onChange={(e) =>
                              setAdvancedDraft((d) => ({
                                ...d,
                                [op.id]: { ...d[op.id]!, bank: e.target.value },
                              }))
                            }
                            rows={8}
                            className="font-mono text-xs w-full rounded-md border border-input bg-background px-3 py-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOperatorsPage() {
  return (
    <Suspense fallback={<p className="text-center text-slate-500 py-12">Loading…</p>}>
      <OperatorsInner />
    </Suspense>
  );
}
