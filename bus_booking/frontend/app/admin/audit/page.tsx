"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { adminApi, type AdminAuditLogEntry } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  schedule_approved: "Schedule approved",
  schedule_rejected: "Schedule rejected",
  operator_updated: "Operator updated",
  operator_clarification_sent: "Operator clarification (email/SMS/WA)",
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminAuditPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [rows, setRows] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | "schedule" | "operator">("");

  const load = useCallback(async () => {
    const token = await getValidToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setLoading(true);
    try {
      const list = await adminApi.auditLog(token, {
        limit: 200,
        ...(filter ? { target_type: filter } : {}),
      });
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getValidToken, router, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-indigo-600" />
            Audit log
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Who approved schedules, rejected trips, or changed operator / KYC details. Newest first.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={filter === "" ? "default" : "outline"} onClick={() => setFilter("")}>
            All
          </Button>
          <Button size="sm" variant={filter === "schedule" ? "default" : "outline"} onClick={() => setFilter("schedule")}>
            Schedules only
          </Button>
          <Button size="sm" variant={filter === "operator" ? "default" : "outline"} onClick={() => setFilter("operator")}>
            Operators only
          </Button>
          <Button size="sm" variant="outline" onClick={() => load()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent actions</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "entry" : "entries"} (last 200)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-500">No audit entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Admin</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium min-w-[200px]">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {fmtTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                        {r.actor_username || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {ACTION_LABELS[r.action] || r.action}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {r.target_type} #{r.target_id}
                      </td>
                      <td className="px-4 py-3">
                        <AuditDetails details={r.details} action={r.action} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditDetails({ details, action }: { details: Record<string, unknown>; action: string }) {
  if (!details || typeof details !== "object") return <span className="text-slate-400">—</span>;

  if (action === "operator_updated" && details.changes && typeof details.changes === "object") {
    const ch = details.changes as Record<string, { from: string; to: string }>;
    return (
      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
        {Object.entries(ch).map(([k, v]) => (
          <li key={k}>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{k}</span>:{" "}
            <span className="line-through opacity-70">{String(v.from)}</span>
            {" → "}
            <span className="text-indigo-600 dark:text-indigo-400">{String(v.to)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (action === "operator_clarification_sent" && details.subject != null) {
    const on = details.operator_name;
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
        <p>
          <span className="text-slate-400">Subject:</span> {String(details.subject)}
        </p>
        {on != null && String(on) !== "" ? (
          <p>
            <span className="text-slate-400">Operator:</span> {String(on)}
          </p>
        ) : null}
      </div>
    );
  }

  const route = details.route;
  const op = details.operator_name;
  const dep = details.departure_dt;
  const bus = details.bus_registration;
  if (route || op || dep) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
        {route != null && String(route) !== "" ? (
          <p>
            <span className="text-slate-400">Route:</span> {String(route)}
          </p>
        ) : null}
        {dep != null && String(dep) !== "" ? (
          <p>
            <span className="text-slate-400">Departure:</span> {String(dep)}
          </p>
        ) : null}
        {op != null && String(op) !== "" ? (
          <p>
            <span className="text-slate-400">Operator:</span> {String(op)}
          </p>
        ) : null}
        {bus != null && String(bus) !== "" ? (
          <p>
            <span className="text-slate-400">Bus:</span> {String(bus)}
          </p>
        ) : null}
        {details.previous_status != null && details.new_status != null && (
          <p>
            <span className="text-slate-400">Status:</span>{" "}
            {String(details.previous_status)} → <strong>{String(details.new_status)}</strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <pre className="text-[10px] text-slate-500 max-w-md overflow-x-auto whitespace-pre-wrap break-all">
      {JSON.stringify(details)}
    </pre>
  );
}
