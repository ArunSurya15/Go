"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth as authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PartyPopper } from "lucide-react";

export default function OperatorRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    owner_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [mobileVerified, setMobileVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendOtp = async () => {
    const mobile = form.phone.replace(/\s/g, "").replace(/^0+/, "") || form.phone;
    if (!mobile || mobile.length < 10) {
      setError("Enter a valid mobile number.");
      return;
    }
    setError("");
    setOtpLoading(true);
    try {
      await authApi.sendOtp(mobile);
      setOtpSent(true);
      setSuccess("OTP sent. Check your phone, or backend console if SMS is not configured.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const mobile = form.phone.replace(/\s/g, "").replace(/^0+/, "") || form.phone;
    if (!mobile || !otp.trim()) {
      setError("Enter OTP.");
      return;
    }
    setError("");
    setOtpLoading(true);
    try {
      const res = await authApi.verifyOtp(mobile, otp.trim());
      if (res.verified) {
        setMobileVerified(true);
        setSuccess("Mobile verified.");
      } else {
        setError("Invalid or expired OTP.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.email?.trim() && !form.phone?.trim()) {
      setError("Provide at least one of email or mobile number.");
      return;
    }
    setLoading(true);
    try {
      await authApi.registerOperator({
        email: form.email?.trim() || undefined,
        password: form.password,
        phone: form.phone?.trim() || undefined,
        company_name: form.company_name,
        owner_name: form.owner_name || undefined,
      });
      setSuccess("Account created. You can sign in now.");
      setTimeout(() => router.push("/operator/login"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-700 p-7 text-white shadow-xl shadow-indigo-600/20 ring-1 ring-white/10">
        <div className="pointer-events-none absolute -left-10 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-fuchsia-400/15 blur-2xl" />
        <p className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-100/90">
          <PartyPopper className="h-4 w-4 text-amber-200" aria-hidden />
          Let&apos;s get you onboard
        </p>
        <h1 className="relative mt-2 text-2xl font-bold tracking-tight">Join e-GO as an operator</h1>
        <p className="relative mt-2 max-w-xl text-sm leading-relaxed text-indigo-100/95">
          Register your bus business in a few minutes. Mobile OTP is optional; if SMS is not configured, check the backend console for the code.
        </p>
      </div>
      <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/60 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/80">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg">Operator sign up</CardTitle>
          <CardDescription>Create your account. An admin may verify your business before payouts go live.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company / travels name *</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner name</Label>
                <Input
                  id="owner_name"
                  value={form.owner_name}
                  onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign-in will use your <strong>email</strong> and/or <strong>mobile</strong> below (we create a login id for you automatically).
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">Provide at least one of email or mobile. Each must be unique.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile (for OTP)</Label>
                <div className="flex gap-2">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  {!mobileVerified ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSendOtp}
                      disabled={otpLoading || !form.phone.trim()}
                    >
                      {otpLoading ? "…" : "Send OTP"}
                    </Button>
                  ) : (
                    <span className="flex items-center text-sm text-green-600">Verified</span>
                  )}
                </div>
              </div>
            </div>
            {otpSent && !mobileVerified && (
              <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Input
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="max-w-[120px]"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleVerifyOtp} disabled={otpLoading}>
                  {otpLoading ? "…" : "Verify"}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-md shadow-indigo-600/25 hover:from-indigo-700 hover:to-violet-700"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/operator/login" className="text-indigo-600 hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
