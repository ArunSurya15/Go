"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const STEPS = [
  { id: 1, title: "Personal details", key: "company" },
  { id: 2, title: "Business & tax", key: "tax" },
  { id: 3, title: "Bank details", key: "bank" },
  { id: 4, title: "Done", key: "done" },
];

export default function OperatorOnboardingPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
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
  });

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
          setForm((f) => ({
            ...f,
            name: p.name || "",
            ...(typeof p.contact_info === "object" && p.contact_info ? p.contact_info : {}),
            ...(typeof p.bank_details === "object" && p.bank_details ? p.bank_details : {}),
          }));
        }
      } catch {
        if (!cancelled) setError("Could not load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getValidToken, router]);

  const contactInfoStep1 = () => ({
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
  });

  const contactInfoFull = () => ({
    ...contactInfoStep1(),
    pan: form.pan,
    msme: form.msme,
    msme_number: form.msme_number,
    cin: form.cin,
    gst_number: form.gst_number,
  });

  const saveStep1 = async () => {
    setError("");
    setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const p = await operatorApi.updateProfile(token, {
        name: form.name,
        contact_info: contactInfoStep1(),
      });
      setProfile(p);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const saveStep2 = async () => {
    setError("");
    if (!form.pan.trim()) {
      setError("PAN is required.");
      return;
    }
    setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      await operatorApi.updateProfile(token, {
        contact_info: contactInfoFull(),
      });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const saveStep3 = async () => {
    setError("");
    setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      await operatorApi.updateProfile(token, {
        bank_details: {
          bank_name: form.bank_name,
          account_name: form.account_name,
          account_number: form.account_number,
          ifsc: form.ifsc,
        },
      });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-500">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Complete your profile</h1>
        <div className="flex flex-wrap gap-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => step > s.id && setStep(s.id)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium ${
                step === s.id
                  ? "bg-indigo-600 text-white"
                  : step > s.id
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-200 text-slate-500"
              }`}
              title={s.title}
            >
              {s.id}
            </button>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Company, owner and address. We use this to display your business and for payouts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Travels / company name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_background">Business background *</Label>
                <select
                  id="business_background"
                  value={form.business_background}
                  onChange={(e) => setForm((f) => ({ ...f, business_background: e.target.value }))}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {BUSINESS_BACKGROUND_OPTIONS.map((o) => (
                    <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {form.business_background === "others" && (
              <div className="space-y-2">
                <Label htmlFor="business_background_other">Business background (other)</Label>
                <Input
                  id="business_background_other"
                  value={form.business_background_other}
                  onChange={(e) => setForm((f) => ({ ...f, business_background_other: e.target.value }))}
                  placeholder="Describe your business"
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner name *</Label>
                <Input
                  id="owner_name"
                  value={form.owner_name}
                  onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 9943373588"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alternate_phone">Phone (landline)</Label>
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
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
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
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={form.pincode}
                  onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District *</Label>
                <Input
                  id="district"
                  value={form.district}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={saveStep1} disabled={saving || !form.name || !form.business_background} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Saving…" : "Next: Business & tax"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader>
            <CardTitle>Business & tax</CardTitle>
            <CardDescription>Identification details for payouts and compliance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pan">PAN *</Label>
              <Input
                id="pan"
                value={form.pan}
                onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))}
                placeholder="e.g. AAAAA9999A"
                maxLength={10}
                className="uppercase"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="msme">MSME? *</Label>
                <select
                  id="msme"
                  value={form.msme}
                  onChange={(e) => setForm((f) => ({ ...f, msme: e.target.value }))}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {MSME_OPTIONS.map((o) => (
                    <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {form.msme === "yes" && (
                <div className="space-y-2">
                  <Label htmlFor="msme_number">MSME number</Label>
                  <Input
                    id="msme_number"
                    value={form.msme_number}
                    onChange={(e) => setForm((f) => ({ ...f, msme_number: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cin">CIN (Corporate Identity Number)</Label>
              <Input
                id="cin"
                value={form.cin}
                onChange={(e) => setForm((f) => ({ ...f, cin: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst_number">GST number</Label>
              <Input
                id="gst_number"
                value={form.gst_number}
                onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={saveStep2} disabled={saving || !form.pan.trim()} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Saving…" : "Next: Bank details"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader>
            <CardTitle>Bank details</CardTitle>
            <CardDescription>For payouts. Keep this secure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank name</Label>
              <Input
                id="bank_name"
                value={form.bank_name}
                onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_name">Account holder name</Label>
              <Input
                id="account_name"
                value={form.account_name}
                onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_number">Account number</Label>
              <Input
                id="account_number"
                value={form.account_number}
                onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifsc">IFSC code</Label>
              <Input
                id="ifsc"
                value={form.ifsc}
                onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value }))}
                placeholder="e.g. SBIN0001234"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={saveStep3} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Saving…" : "Finish"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-slate-200 shadow-md">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Profile complete</h2>
            <p className="mt-2 text-slate-600">Your details are saved. Admin may verify before payouts.</p>
            <Button
              className="mt-6 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => router.push("/operator/dashboard")}
            >
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
