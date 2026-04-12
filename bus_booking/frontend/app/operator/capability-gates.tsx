"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useOperatorSession } from "./operator-session";

/** Fares, fleet, schedules, sales, refunds (owner, manager, legacy). */
export function OperationsGate({ children }: { children: ReactNode }) {
  const { canManageOperations, loading } = useOperatorSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!canManageOperations) {
      router.replace("/operator/dashboard?mode=staff");
    }
  }, [loading, canManageOperations, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }
  if (!canManageOperations) return null;
  return <>{children}</>;
}

/** Company profile / KYC / team invites (owner or legacy only). */
export function CompanyOwnerGate({ children }: { children: ReactNode }) {
  const { canManageCompany, loading } = useOperatorSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!canManageCompany) {
      router.replace("/operator/dashboard?mode=staff");
    }
  }, [loading, canManageCompany, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }
  if (!canManageCompany) return null;
  return <>{children}</>;
}
