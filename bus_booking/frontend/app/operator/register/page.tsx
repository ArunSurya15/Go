"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth as authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperatorRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    owner_name: "",
    username: "",
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
        username: form.username,
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
    <div className="mx-auto max-w-lg">
      <div className="mb-8 rounded-xl bg-indigo-600 p-6 text-white shadow-lg">
        <h1 className="text-xl font-bold">Join e-GO as an operator</h1>
        <p className="mt-2 text-sm text-indigo-100">
          Register your bus business. You can verify your mobile with OTP (optional). Without SMS setup, OTP appears in the backend console.
        </p>
      </div>
      <Card className="border-slate-200 shadow-md">
        <CardHeader>
          <CardTitle>Operator sign up</CardTitle>
          <CardDescription>Create your operator account. Admin may verify before payouts.</CardDescription>
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
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
            <p className="text-sm text-slate-500">Provide at least one of email or mobile. Each must be unique.</p>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
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
