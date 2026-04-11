"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INDIAN_STATES_GST, stateCodeForName } from "@/lib/indian-states-gst";
import { Check, Plus, Trash2 } from "lucide-react";

const BUSINESS_BACKGROUND_OPTIONS = [
  { value: "", label: "Select" },
  { value: "traditionally_bo", label: "Traditionally BO" },
  { value: "travel_agent", label: "Travel Agent" },
  { value: "logistics", label: "Logistics" },
  { value: "aggregator", label: "Aggregator" },
  { value: "distributor", label: "Distributor" },
  { value: "others", label: "Others" },
];

const MSME_OPTIONS = [
  { value: "", label: "Select" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const ACCOUNT_TYPES = ["Savings", "Current"] as const;

type GstinRow = { id: string; state_name: string; state_code: string; gstin: string; is_head_office: boolean };

const STEPS = [
  { id: 1, title: "Personal details" },
  { id: 2, title: "Bank details" },
  { id: 3, title: "GST details" },
  { id: 4, title: "Documents & IDs" },
  { id: 5, title: "Success" },
];

function newRow(): GstinRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    state_name: "",
    state_code: "",
    gstin: "",
    is_head_office: false,
  };
}

function gstinPrefixMatchesState(gstin: string, stateCode: string): boolean {
  const g = (gstin || "").trim().toUpperCase();
  const c = (stateCode || "").trim();
  if (g.length < 2 || c.length !== 2) return true;
  return g.slice(0, 2) === c;
}

export default function OperatorOnboardingPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [step, setStep] = useState(1);
  const [, setProfile] = useState<OperatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    owner_name: "",
    business_background: "",
    business_background_other: "",
    phone: "",
    alternate_phone: "",
    email: "",
    alternate_email: "",
    address: "",
    city: "",
    state: "",
    district: "",
    pincode: "",
    country: "India",
    pan: "",
    msme: "",
    msme_number: "",
    cin: "",
    gst_number: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc: "",
    account_type: "" as "" | "Savings" | "Current",
    gst_has_gstin: true,
    gst_turnover_exceeds_20lakh: false,
    gstin_rows: [] as GstinRow[],
    pan_doc_note: "",
    gst_doc_note: "",
  });

  const hydrateFromProfile = useCallback((p: OperatorProfile) => {
    const ci = (typeof p.contact_info === "object" && p.contact_info ? p.contact_info : {}) as Record<string, unknown>;
    const bd = (typeof p.bank_details === "object" && p.bank_details ? p.bank_details : {}) as Record<string, unknown>;
    let rows: GstinRow[] = [];
    if (Array.isArray(ci.gstin_registrations)) {
      rows = (ci.gstin_registrations as unknown[]).map((r, i) => {
        const x = r as Record<string, unknown>;
        return {
          id: String(x.id ?? `row-${i}`),
          state_name: String(x.state_name ?? ""),
          state_code: String(x.state_code ?? ""),
          gstin: String(x.gstin ?? "").toUpperCase(),
          is_head_office: Boolean(x.is_head_office),
        };
      });
    }
    if (!rows.length && typeof ci.gst_number === "string" && (ci.gst_number as string).trim()) {
      rows = [
        {
          id: "migrated-1",
          state_name: String(ci.state ?? ""),
          state_code: stateCodeForName(String(ci.state ?? "")),
          gstin: String(ci.gst_number).toUpperCase(),
          is_head_office: true,
        },
      ];
    }
    if (!rows.length) rows = [newRow()];

    setForm((f) => ({
      ...f,
      name: p.name || "",
      owner_name: String(ci.owner_name ?? ""),
      business_background: String(ci.business_background ?? ""),
      business_background_other: String(ci.business_background_other ?? ""),
      phone: String(ci.phone ?? ""),
      alternate_phone: String(ci.alternate_phone ?? ""),
      email: String(ci.email ?? ""),
      alternate_email: String(ci.alternate_email ?? ""),
      address: String(ci.address ?? ""),
      city: String(ci.city ?? ""),
      state: String(ci.state ?? ""),
      district: String(ci.district ?? ""),
      pincode: String(ci.pincode ?? ""),
      country: String(ci.country ?? "India"),
      pan: String(ci.pan ?? "").toUpperCase(),
      msme: String(ci.msme ?? ""),
      msme_number: String(ci.msme_number ?? ""),
      cin: String(ci.cin ?? ""),
      gst_number: String(ci.gst_number ?? ""),
      bank_name: String(bd.bank_name ?? ""),
      account_name: String(bd.account_name ?? bd.beneficiary_name ?? ""),
      account_number: String(bd.account_number ?? ""),
      ifsc: String(bd.ifsc ?? "").toUpperCase(),
      account_type: (bd.account_type === "Current" || bd.account_type === "Savings"
        ? bd.account_type
        : "") as "" | "Savings" | "Current",
      gst_has_gstin: ci.gst_has_gstin === false ? false : true,
      gst_turnover_exceeds_20lakh: Boolean(ci.gst_turnover_exceeds_20lakh),
      gstin_rows: rows,
      pan_doc_note: String(ci.pan_doc_note ?? ""),
      gst_doc_note: String(ci.gst_doc_note ?? ""),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      try {
        const p = await operatorApi.profile(token);
        if (!cancelled) {
          setProfile(p);
          hydrateFromProfile(p);
        }
      } catch {
        if (!cancelled) setError("Could not load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getValidToken, router, hydrateFromProfile]);

  const buildContactInfo = (): Record<string, unknown> => {
    const regs = form.gstin_rows
      .filter((r) => r.state_name || r.gstin.trim())
      .map((r) => ({
        id: r.id,
        state_name: r.state_name,
        state_code: r.state_code || stateCodeForName(r.state_name),
        gstin: r.gstin.trim().toUpperCase(),
        is_head_office: r.is_head_office,
      }));
    const head = regs.find((r) => r.is_head_office) ?? regs[0];
    return {
      owner_name: form.owner_name,
      phone: form.phone,
      alternate_phone: form.alternate_phone,
      email: form.email,
      alternate_email: form.alternate_email,
      address: form.address,
      city: form.city,
      state: form.state,
      district: form.district,
      pincode: form.pincode,
      country: form.country,
      business_background: form.business_background,
      business_background_other: form.business_background_other,
      gst_has_gstin: form.gst_has_gstin,
      gst_turnover_exceeds_20lakh: form.gst_turnover_exceeds_20lakh,
      gstin_registrations: regs,
      gst_number: head?.gstin ?? form.gst_number,
      pan: form.pan.trim().toUpperCase(),
      msme: form.msme,
      msme_number: form.msme_number,
      cin: form.cin,
      pan_doc_note: form.pan_doc_note,
      gst_doc_note: form.gst_doc_note,
    };
  };

  const buildBankDetails = () => ({
    bank_name: form.bank_name.trim(),
    account_name: form.account_name.trim(),
    beneficiary_name: form.account_name.trim(),
    account_number: form.account_number.trim(),
    ifsc: form.ifsc.trim().toUpperCase(),
    account_type: form.account_type || "Savings",
  });

  const persistProfile = async (patch: Partial<{ name: string; contact_info: Record<string, unknown>; bank_details: Record<string, unknown> }>) => {
    const token = await getValidToken();
    if (!token) return;
    const p = await operatorApi.updateProfile(token, patch);
    setProfile(p);
    hydrateFromProfile(p);
  };

  const saveStep1 = async () => {
    setError("");
    if (!form.name.trim() || !form.business_background) {
      setError("Company name and business background are required.");
      return;
    }
    setSaving(true);
    try {
      await persistProfile({ name: form.name, contact_info: buildContactInfo() });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const saveStep2 = async () => {
    setError("");
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim() || !form.ifsc.trim()) {
      setError("All bank fields are required.");
      return;
    }
    if (!form.account_type) {
      setError("Select bank account type.");
      return;
    }
    setSaving(true);
    try {
      await persistProfile({ bank_details: buildBankDetails() });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const saveStep3 = async () => {
    setError("");
    if (form.gst_has_gstin) {
      const regs = form.gstin_rows.filter((r) => r.state_name || r.gstin.trim());
      if (!regs.length) {
        setError("Add at least one GST registration or mark that you do not have a GSTIN.");
        return;
      }
      for (const r of regs) {
        if (!r.state_name || !r.gstin.trim()) {
          setError("Each GST row needs state and GSTIN.");
          return;
        }
        const code = r.state_code || stateCodeForName(r.state_name);
        if (!code) {
          setError(`Unknown state code for ${r.state_name}.`);
          return;
        }
        if (r.gstin.trim().length !== 15) {
          setError(`GSTIN must be 15 characters (${r.gstin}).`);
          return;
        }
        if (!gstinPrefixMatchesState(r.gstin, code)) {
          setError(`GSTIN must start with state code ${code} for ${r.state_name}.`);
          return;
        }
      }
      if (!regs.some((r) => r.is_head_office)) {
        setError("Mark one registration as head office.");
        return;
      }
    }
    setSaving(true);
    try {
      await persistProfile({ name: form.name, contact_info: buildContactInfo() });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const saveStep4 = async () => {
    setError("");
    if (!form.pan.trim()) {
      setError("PAN is required.");
      return;
    }
    if (form.pan.trim().length !== 10) {
      setError("PAN must be 10 characters.");
      return;
    }
    setSaving(true);
    try {
      await persistProfile({ name: form.name, contact_info: buildContactInfo() });
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateGstRow = (id: string, patch: Partial<GstinRow>) => {
    setForm((f) => ({
      ...f,
      gstin_rows: f.gstin_rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.state_name !== undefined) {
          next.state_code = stateCodeForName(patch.state_name);
        }
        return next;
      }),
    }));
  };

  const setHeadOffice = (id: string) => {
    setForm((f) => ({
      ...f,
      gstin_rows: f.gstin_rows.map((r) => ({ ...r, is_head_office: r.id === id })),
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin dark:border-indigo-900 dark:border-t-indigo-400" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Onboarding</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Complete your profile</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        A few quick steps — we save after each step so you can pause anytime.
      </p>

      {/* Stepper — similar to redBus vendor flow */}
      <div className="mb-10 mt-8 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          {STEPS.filter((s) => s.id < 5).map((s, idx, arr) => (
            <div key={s.id} className="flex min-w-[4.5rem] flex-1 items-center">
              <button
                type="button"
                disabled={step <= s.id}
                onClick={() => step > s.id && setStep(s.id)}
                className={`flex w-full flex-col items-center gap-2 ${step > s.id ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-all ${
                    step === s.id
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/50"
                      : step > s.id
                        ? "border-2 border-indigo-500 bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-400"
                        : "border-2 border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/80"
                  }`}
                >
                  {step > s.id ? <Check className="h-4 w-4" strokeWidth={2.5} /> : s.id}
                </span>
                <span className="px-0.5 text-center text-[10px] font-semibold leading-tight text-slate-600 dark:text-slate-400 sm:text-xs">
                  {s.title}
                </span>
              </button>
              {idx < arr.length - 1 && (
                <div
                  className={`mt-[-2.25rem] hidden h-0.5 flex-1 sm:block mx-1 rounded-full ${step > s.id ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-200 dark:bg-slate-700"}`}
                  style={{ minWidth: "0.5rem" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/60">
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Company, owner and address. Used for display and compliance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Travels / company name *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_background">Business background *</Label>
                <select
                  id="business_background"
                  value={form.business_background}
                  onChange={(e) => setForm((f) => ({ ...f, business_background: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {BUSINESS_BACKGROUND_OPTIONS.map((o) => (
                    <option key={o.value || "empty"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {form.business_background === "others" && (
              <div className="space-y-2">
                <Label htmlFor="business_background_other">Describe your business</Label>
                <Input
                  id="business_background_other"
                  value={form.business_background_other}
                  onChange={(e) => setForm((f) => ({ ...f, business_background_other: e.target.value }))}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner name *</Label>
                <Input id="owner_name" value={form.owner_name} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input id="country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile *</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alternate_phone">Alternate phone</Label>
                <Input
                  id="alternate_phone"
                  type="tel"
                  value={form.alternate_phone}
                  onChange={(e) => setForm((f) => ({ ...f, alternate_phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alternate_email">Alternate email</Label>
                <Input
                  id="alternate_email"
                  type="email"
                  value={form.alternate_email}
                  onChange={(e) => setForm((f) => ({ ...f, alternate_email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input id="pincode" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input id="state" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District *</Label>
                <Input id="district" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={saveStep1} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Saving…" : "Next: Bank details"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/60">
          <CardHeader>
            <CardTitle>Bank details</CardTitle>
            <CardDescription>Payout account. Use a business current account where possible for GST settlements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank name *</Label>
                <Input id="bank_name" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account number *</Label>
                <Input
                  id="account_number"
                  value={form.account_number}
                  onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account_name">Beneficiary name *</Label>
                <Input id="account_name" value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_type">Bank account type *</Label>
                <select
                  id="account_type"
                  value={form.account_type}
                  onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value as "Savings" | "Current" }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select</option>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifsc">Bank account identifier (IFSC) *</Label>
              <Input id="ifsc" value={form.ifsc} onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))} maxLength={11} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back to personal details
              </Button>
              <Button onClick={saveStep2} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Saving…" : "Next: GST details"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/60">
          <CardHeader>
            <CardTitle>GST details</CardTitle>
            <CardDescription>As per your tax registration. GSTIN first two digits must match the state code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={form.gst_has_gstin}
                  onChange={() => setForm((f) => ({ ...f, gst_has_gstin: true }))}
                  className="text-indigo-600"
                />
                I have GSTIN
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={!form.gst_has_gstin}
                  onChange={() => setForm((f) => ({ ...f, gst_has_gstin: false }))}
                  className="text-indigo-600"
                />
                I don&apos;t have GSTIN
              </label>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/40">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Aggregate turnover (PAN India)</p>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={form.gst_turnover_exceeds_20lakh}
                  onChange={() => setForm((f) => ({ ...f, gst_turnover_exceeds_20lakh: true }))}
                  className="mt-1"
                />
                <span>My aggregate turnover has exceeded ₹20 lakhs</span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={!form.gst_turnover_exceeds_20lakh}
                  onChange={() => setForm((f) => ({ ...f, gst_turnover_exceeds_20lakh: false }))}
                  className="mt-1"
                />
                <span>My aggregate turnover has not exceeded ₹20 lakhs</span>
              </label>
            </div>

            {form.gst_has_gstin && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-base">GSTIN registrations</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setForm((f) => ({ ...f, gstin_rows: [...f.gstin_rows, newRow()] }))}
                  >
                    <Plus className="h-4 w-4" /> Add GSTIN
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-left text-xs uppercase text-slate-500">
                        <th className="p-2">State</th>
                        <th className="p-2 w-16">Code</th>
                        <th className="p-2 min-w-[10rem]">GSTIN</th>
                        <th className="p-2">Head office</th>
                        <th className="p-2 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.gstin_rows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2 align-top">
                            <select
                              value={row.state_name}
                              onChange={(e) => updateGstRow(row.id, { state_name: e.target.value })}
                              className="w-full max-w-[10rem] rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                            >
                              <option value="">State</option>
                              {INDIAN_STATES_GST.map((s) => (
                                <option key={s.code} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.state_code || stateCodeForName(row.state_name)}
                              readOnly
                              className="h-9 text-xs bg-slate-100 dark:bg-slate-800"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.gstin}
                              onChange={(e) => updateGstRow(row.id, { gstin: e.target.value.toUpperCase() })}
                              maxLength={15}
                              placeholder="15-char GSTIN"
                              className="h-9 font-mono text-xs uppercase"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <select
                              value={row.is_head_office ? "yes" : "no"}
                              onChange={(e) => {
                                if (e.target.value === "yes") setHeadOffice(row.id);
                                else updateGstRow(row.id, { is_head_office: false });
                              }}
                              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                            >
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>
                          </td>
                          <td className="p-2 align-top">
                            {form.gstin_rows.length > 1 && (
                              <button
                                type="button"
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                aria-label="Remove row"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    gstin_rows: f.gstin_rows.filter((x) => x.id !== row.id),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back to bank details
              </Button>
              <Button onClick={saveStep3} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Saving…" : "Next: Documents & IDs"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/60">
          <CardHeader>
            <CardTitle>Documents &amp; IDs</CardTitle>
            <CardDescription>PAN and optional notes. Upload scans to secure storage and paste links here if you have them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pan">PAN *</Label>
              <Input
                id="pan"
                value={form.pan}
                onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))}
                maxLength={10}
                className="uppercase font-mono"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="msme">MSME registered?</Label>
                <select
                  id="msme"
                  value={form.msme}
                  onChange={(e) => setForm((f) => ({ ...f, msme: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {MSME_OPTIONS.map((o) => (
                    <option key={o.value || "empty"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.msme === "yes" && (
                <div className="space-y-2">
                  <Label htmlFor="msme_number">MSME number</Label>
                  <Input id="msme_number" value={form.msme_number} onChange={(e) => setForm((f) => ({ ...f, msme_number: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cin">CIN (optional)</Label>
              <Input id="cin" value={form.cin} onChange={(e) => setForm((f) => ({ ...f, cin: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pan_doc_note">PAN / ID document (notes or link)</Label>
              <Input
                id="pan_doc_note"
                value={form.pan_doc_note}
                onChange={(e) => setForm((f) => ({ ...f, pan_doc_note: e.target.value }))}
                placeholder="e.g. secure link to scanned PAN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst_doc_note">GST certificate (notes or link)</Label>
              <Input
                id="gst_doc_note"
                value={form.gst_doc_note}
                onChange={(e) => setForm((f) => ({ ...f, gst_doc_note: e.target.value }))}
                placeholder="Optional until you upload files in a future release"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back to GST details
              </Button>
              <Button onClick={saveStep4} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Saving…" : "Finish"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/60">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400">
              <Check className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Profile complete</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Your details are saved. Admin may verify bank, GSTIN, and documents before payouts go live.
            </p>
            <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700" onClick={() => router.push("/operator/dashboard")}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
