"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { userApi, type MeResponse, type SavedPassenger } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  User, Phone, Mail, Calendar, Shield, Star, Users,
  ChevronRight, Pencil, Check, X, Plus, Trash2, Lock,
  MapPin, Armchair, Layers,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string, email: string) {
  const n = (name || email || "?").trim();
  const parts = n.split(" ").filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase();
}

function SectionCard({ title, description, icon: Icon, children }: {
  title: string; description?: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FieldRow({ label, value, onSave, type = "text", options }: {
  label: string; value: string; type?: string;
  options?: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(draft); setEditing(false); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span className="w-36 text-xs text-slate-500 shrink-0">{label}</span>
        {options ? (
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
          >
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <Input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 h-8 text-sm"
            autoFocus
          />
        )}
        <button onClick={save} disabled={saving} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
          <Check className="h-4 w-4" />
        </button>
        <button onClick={() => { setEditing(false); setDraft(value); }} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 group">
      <span className="w-36 text-xs text-slate-500 shrink-0">{label}</span>
      <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
        {value || <span className="text-slate-400 italic">Not set</span>}
      </span>
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const { token, getValidToken, logout } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>([]);
  const [loading, setLoading] = useState(true);

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // New saved passenger
  const [showAddPassenger, setShowAddPassenger] = useState(false);
  const [newPName, setNewPName] = useState("");
  const [newPAge, setNewPAge] = useState("");
  const [newPGender, setNewPGender] = useState("");
  const [passengerSaving, setPassengerSaving] = useState(false);

  const load = useCallback(async () => {
    const t = await getValidToken();
    if (!t) { router.replace("/login"); return; }
    const [profile, passengers] = await Promise.all([
      userApi.me(t),
      userApi.savedPassengers(t),
    ]);
    setMe(profile);
    setSavedPassengers(passengers);
    setLoading(false);
  }, [getValidToken, router]);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback(async (field: string, value: string) => {
    const t = await getValidToken();
    if (!t) return;
    const updated = await userApi.updateMe(t, { [field]: value } as never);
    setMe(updated);
  }, [getValidToken]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    setPwSaving(true);
    try {
      const t = await getValidToken();
      if (!t) return;
      await userApi.changePassword(t, currentPw, newPw);
      setPwMsg("✅ Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setShowPwForm(false);
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Failed.");
    } finally {
      setPwSaving(false);
    }
  };

  const addPassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPName.trim()) return;
    setPassengerSaving(true);
    try {
      const t = await getValidToken();
      if (!t) return;
      const p = await userApi.addSavedPassenger(t, {
        name: newPName.trim(),
        age: newPAge ? parseInt(newPAge) : null,
        gender: newPGender,
      });
      setSavedPassengers((prev) => [...prev, p]);
      setNewPName(""); setNewPAge(""); setNewPGender(""); setShowAddPassenger(false);
    } finally {
      setPassengerSaving(false);
    }
  };

  const deletePassenger = async (id: number) => {
    const t = await getValidToken();
    if (!t) return;
    await userApi.deleteSavedPassenger(t, id);
    setSavedPassengers((prev) => prev.filter((p) => p.id !== id));
  };

  if (!token || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        {!token ? "Please log in." : "Loading…"}
      </div>
    );
  }

  if (!me) return null;

  const genderLabel = (g: string) => ({ M: "Male", F: "Female", O: "Other" }[g] || "");

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 pb-16">

      {/* ── Hero profile card ── */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold tracking-tight select-none">
            {initials(me.name, me.email)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{me.name || me.username}</h1>
            <p className="text-indigo-200 text-sm truncate">{me.email || me.phone}</p>
            <p className="text-indigo-300 text-xs mt-1">Member since {me.date_joined}</p>
          </div>
          <Link
            href="/bookings"
            className="flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-medium transition-colors"
          >
            My trips <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { icon: MapPin, label: "Trips booked", value: "—" },
            { icon: Star, label: "Avg rating given", value: "—" },
            { icon: Shield, label: "Verified", value: me.email ? "Email ✓" : me.phone ? "Phone ✓" : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5 text-center">
              <Icon className="h-4 w-4 mx-auto mb-1 text-indigo-200" />
              <p className="text-xs text-indigo-200">{label}</p>
              <p className="text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Personal info ── */}
      <SectionCard title="Personal information" description="Used for tickets and confirmations" icon={User}>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <FieldRow label="Full name" value={me.name} onSave={(v) => patch("name", v)} />
          <FieldRow label="Email" value={me.email} onSave={(v) => patch("email", v)} type="email" />
          <FieldRow label="Mobile" value={me.phone} onSave={(v) => patch("phone", v)} type="tel" />
          <FieldRow
            label="Gender"
            value={genderLabel(me.gender)}
            onSave={(v) => patch("gender", v)}
            options={[
              { value: "", label: "Prefer not to say" },
              { value: "M", label: "Male" },
              { value: "F", label: "Female" },
              { value: "O", label: "Other" },
            ]}
          />
          <FieldRow label="Date of birth" value={me.date_of_birth} onSave={(v) => patch("date_of_birth", v)} type="date" />
        </div>
      </SectionCard>

      {/* ── Travel preferences ── */}
      <SectionCard
        title="Travel preferences"
        description="We'll try to auto-select these during booking"
        icon={Armchair}
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <FieldRow
            label="Seat preference"
            value={{ window: "Window", aisle: "Aisle", any: "No preference" }[me.seat_preference] || "No preference"}
            onSave={(v) => patch("seat_preference", v)}
            options={[
              { value: "any", label: "No preference" },
              { value: "window", label: "Window" },
              { value: "aisle", label: "Aisle" },
            ]}
          />
          <FieldRow
            label="Deck preference"
            value={{ lower: "Lower deck", upper: "Upper deck", any: "No preference" }[me.deck_preference] || "No preference"}
            onSave={(v) => patch("deck_preference", v)}
            options={[
              { value: "any", label: "No preference" },
              { value: "lower", label: "Lower deck" },
              { value: "upper", label: "Upper deck" },
            ]}
          />
        </div>
      </SectionCard>

      {/* ── Saved passengers ── */}
      <SectionCard
        title="Saved passengers"
        description="Pre-save family members or frequent co-travellers for faster checkout"
        icon={Users}
      >
        {savedPassengers.length === 0 && !showAddPassenger && (
          <p className="text-sm text-slate-500 mb-3">No saved passengers yet.</p>
        )}
        <div className="space-y-2 mb-3">
          {savedPassengers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {[p.age ? `${p.age} yrs` : null, genderLabel(p.gender)].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <button onClick={() => deletePassenger(p.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {showAddPassenger ? (
          <form onSubmit={addPassenger} className="rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3">
                <Input placeholder="Full name *" value={newPName} onChange={(e) => setNewPName(e.target.value)} className="text-sm" required />
              </div>
              <Input placeholder="Age" type="number" value={newPAge} onChange={(e) => setNewPAge(e.target.value)} className="text-sm" />
              <select
                value={newPGender}
                onChange={(e) => setNewPGender(e.target.value)}
                className="col-span-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"
              >
                <option value="">Gender</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={passengerSaving} className="flex-1">
                {passengerSaving ? "Saving…" : "Save passenger"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddPassenger(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAddPassenger(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add passenger
          </Button>
        )}
      </SectionCard>

      {/* ── Emergency contact ── */}
      <SectionCard
        title="Emergency contact"
        description="We'll notify this person if there's an issue with your trip — especially useful for solo travel"
        icon={Phone}
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <FieldRow label="Contact name" value={me.emergency_contact_name} onSave={(v) => patch("emergency_contact_name", v)} />
          <FieldRow label="Contact phone" value={me.emergency_contact_phone} onSave={(v) => patch("emergency_contact_phone", v)} type="tel" />
        </div>
        {!me.emergency_contact_name && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> Recommended for solo travellers and night buses
          </p>
        )}
      </SectionCard>

      {/* ── Security ── */}
      <SectionCard title="Security" description="Manage your password" icon={Lock}>
        {pwMsg && (
          <p className={`text-sm mb-3 ${pwMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{pwMsg}</p>
        )}
        {showPwForm ? (
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Current password</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">New password</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pwSaving}>{pwSaving ? "Saving…" : "Change password"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowPwForm(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowPwForm(true)} className="gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Change password
          </Button>
        )}
      </SectionCard>

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-between pt-2">
        <Link href="/bookings" className="text-sm text-indigo-600 hover:underline">View all my trips →</Link>
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
