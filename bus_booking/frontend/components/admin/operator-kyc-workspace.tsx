"use client";

import { useState } from "react";
import type { AdminOperatorBus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { OperatorAdminBusCard } from "@/components/admin/operator-admin-bus-card";

export type KycChecklistState = {
  personal_reviewed: boolean;
  fleet_reviewed: boolean;
  identity_payout_reviewed: boolean;
};

export type KycFormatHints = {
  pan?: { provided?: boolean; format_ok?: boolean | null };
  gstin?: { provided?: boolean; format_ok?: boolean | null };
  aadhaar_last_four?: { provided?: boolean; format_ok?: boolean | null };
  ifsc?: { provided?: boolean; format_ok?: boolean | null };
  compliance_notes?: string[];
};

const TABS = [
  { id: "personal" as const, label: "Personal & business" },
  { id: "fleet" as const, label: "Fleet & layout" },
  { id: "identity" as const, label: "IDs & payout" },
  { id: "review" as const, label: "Review & notify" },
];

function HintRow({ label, ok, missing }: { label: string; ok: boolean | null | undefined; missing?: boolean }) {
  if (missing) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300">
        <span className="font-medium">{label}:</span> not provided
      </p>
    );
  }
  if (ok === true) {
    return (
      <p className="text-xs text-emerald-700 dark:text-emerald-300">
        <span className="font-medium">{label}:</span> format looks valid (not verified with government / bank APIs).
      </p>
    );
  }
  if (ok === false) {
    return (
      <p className="text-xs text-red-700 dark:text-red-300">
        <span className="font-medium">{label}:</span> format does not match expected pattern.
      </p>
    );
  }
  return null;
}

function KeyValueGrid({ title, data }: { title: string; data: Record<string, unknown> }) {
  const unparsed = data._unparsed;
  if (typeof unparsed === "string") {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-xs">
        {title ? `${title}: ` : ""}raw / unparsed data
        <pre className="mt-2 whitespace-pre-wrap break-words">{unparsed}</pre>
      </div>
    );
  }
  const entries = Object.entries(data).filter(([k]) => !k.startsWith("_"));
  if (!entries.length) return <p className="text-xs text-slate-500">No fields.</p>;
  return (
    <dl className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-1 sm:grid-cols-[minmax(7rem,32%)_1fr] gap-1 px-3 py-2">
          <dt className="text-slate-500 capitalize">{k.replace(/_/g, " ")}</dt>
          <dd className="text-slate-800 dark:text-slate-200 break-words">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OperatorKycWorkspace({
  contact,
  bank,
  buses,
  hints,
  checklist,
  onChecklistChange,
  internalNotes,
  onInternalNotesChange,
  onSendClarification,
  sendingClarification,
}: {
  contact: Record<string, unknown>;
  bank: Record<string, unknown>;
  buses: AdminOperatorBus[];
  hints?: KycFormatHints | null;
  checklist: KycChecklistState;
  onChecklistChange: (c: KycChecklistState) => void;
  internalNotes: string;
  onInternalNotesChange: (s: string) => void;
  onSendClarification: (subject: string, message: string) => Promise<void>;
  sendingClarification: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("personal");
  const [clarSubj, setClarSubj] = useState("");
  const [clarBody, setClarBody] = useState("");

  const pan = hints?.pan;
  const gst = hints?.gstin;
  const a4 = hints?.aadhaar_last_four;
  const ifsc = hints?.ifsc;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === "personal" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Owner / business address and contact numbers. Cross-check with PAN card name where possible.
            </p>
            <KeyValueGrid title="Contact" data={contact} />
          </div>
        )}

        {tab === "fleet" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Registration numbers and seat layouts. Public aggregators usually trust registration + operator; RTO
              fitness (FC) / permit depth varies — often not collected in v1 self-serve onboarding.
            </p>
            {buses.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">No buses registered yet.</p>
            ) : (
              <div className="space-y-2">
                {buses.map((bus) => (
                  <OperatorAdminBusCard key={bus.id} bus={bus} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "identity" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              PAN / GSTIN / bank are format-checked here only. True verification needs NSDL / GST APIs, penny-drop
              payout tests, or manual document review (upload links in JSON if you add fields like{" "}
              <code className="text-[10px]">doc_pan_url</code>).
            </p>
            {hints?.compliance_notes?.length ? (
              <ul className="text-xs text-amber-800 dark:text-amber-200 list-disc pl-4 space-y-1">
                {hints.compliance_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : null}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 space-y-2 border border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                Format hints (automatic)
              </p>
              <HintRow label="PAN" ok={pan?.format_ok} missing={!pan?.provided} />
              <HintRow label="GSTIN" ok={gst?.format_ok} missing={!gst?.provided} />
              <HintRow label="Aadhaar last 4" ok={a4?.format_ok} missing={!a4?.provided} />
              <HintRow label="IFSC" ok={ifsc?.format_ok} missing={!ifsc?.provided} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Contact JSON (identity fields)</p>
                <KeyValueGrid title="" data={contact} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Bank / payout</p>
                <KeyValueGrid title="" data={bank} />
              </div>
            </div>
          </div>
        )}

        {tab === "review" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Review checklist (saved with operator)</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.personal_reviewed}
                  onChange={(e) =>
                    onChecklistChange({ ...checklist, personal_reviewed: e.target.checked })
                  }
                  className="rounded border-slate-300"
                />
                Personal &amp; business details reviewed
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.fleet_reviewed}
                  onChange={(e) => onChecklistChange({ ...checklist, fleet_reviewed: e.target.checked })}
                  className="rounded border-slate-300"
                />
                Fleet / seat layouts reviewed
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.identity_payout_reviewed}
                  onChange={(e) =>
                    onChecklistChange({ ...checklist, identity_payout_reviewed: e.target.checked })
                  }
                  className="rounded border-slate-300"
                />
                Identity &amp; payout details reviewed
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Internal notes (not sent to operator)</Label>
              <textarea
                value={internalNotes}
                onChange={(e) => onInternalNotesChange(e.target.value)}
                rows={4}
                placeholder="Private notes for other admins…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Request more information</p>
              <p className="text-xs text-slate-500">
                Sends <strong>email</strong>, <strong>SMS</strong>, and <strong>WhatsApp</strong> to operator contacts on file (same as KYC approval
                notifications). For a phone call, use the numbers in the Personal tab — this form does not dial.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input value={clarSubj} onChange={(e) => setClarSubj(e.target.value)} placeholder="e.g. PAN copy needed" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <textarea
                  value={clarBody}
                  onChange={(e) => setClarBody(e.target.value)}
                  rows={5}
                  placeholder="Explain what documents or corrections you need…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={sendingClarification || !clarSubj.trim() || !clarBody.trim()}
                onClick={async () => {
                  await onSendClarification(clarSubj.trim(), clarBody.trim());
                  setClarSubj("");
                  setClarBody("");
                }}
              >
                {sendingClarification ? "Sending…" : "Send email, SMS & WhatsApp"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
