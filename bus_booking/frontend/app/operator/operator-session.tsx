"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { auth as authApi, type MeResponse } from "@/lib/api";
import { operatorCanManageCompany, operatorCanManageOperations } from "@/lib/operator-staff";

type OperatorSessionValue = {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Fares, fleet, schedules, sales, refunds */
  canManageOperations: boolean;
  /** KYC / bank / team invites */
  canManageCompany: boolean;
  /** @deprecated alias for canManageOperations */
  canManageMoney: boolean;
};

const OperatorSessionContext = createContext<OperatorSessionValue | null>(null);

export function OperatorSessionProvider({ children }: { children: ReactNode }) {
  const { token, getValidToken } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const t = await getValidToken();
      if (!t) {
        setMe(null);
        return;
      }
      const m = await authApi.me(t);
      setMe(m);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [token, getValidToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canManageOperations = operatorCanManageOperations(me);
  const canManageCompany = operatorCanManageCompany(me);

  const value: OperatorSessionValue = {
    me,
    loading,
    refresh,
    canManageOperations,
    canManageCompany,
    canManageMoney: canManageOperations,
  };

  return (
    <OperatorSessionContext.Provider value={value}>
      {children}
    </OperatorSessionContext.Provider>
  );
}

export function useOperatorSession(): OperatorSessionValue {
  const ctx = useContext(OperatorSessionContext);
  if (!ctx) {
    return {
      me: null,
      loading: false,
      refresh: async () => {},
      canManageOperations: false,
      canManageCompany: false,
      canManageMoney: false,
    };
  }
  return ctx;
}
