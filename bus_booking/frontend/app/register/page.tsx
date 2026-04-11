"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "email" | "phone";
type Step = "details" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const { registerInitiate, registerConfirm } = useAuth();

  const [mode, setMode] = useState<Mode>("email");
  const [step, setStep] = useState<Step>("details");

  // Step 1 fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await registerInitiate(
        name.trim(),
        mode === "email" ? email : "",
        password,
        mode === "phone" ? "+91" + phone : undefined,
      );
      setStep("otp");
      setResendCooldown(30);
      if (res.otp_dev) setDevOtp(res.otp_dev);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 6) {
      setOtp(digits);
      otpRefs.current[5]?.focus();
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setError("Enter the 6-digit code."); return; }
    setError("");
    setLoading(true);
    try {
      const contact = mode === "email" ? email : "+91" + phone;
      await registerConfirm(contact, code, mode === "email");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      const res = await registerInitiate(
        name.trim(),
        mode === "email" ? email : "",
        password,
        mode === "phone" ? "+91" + phone : undefined,
      );
      setResendCooldown(30);
      setOtp(["", "", "", "", "", ""]);
      if (res.otp_dev) setDevOtp(res.otp_dev);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              {step === "details"
                ? "Sign up to book bus tickets."
                : `Enter the 6-digit code sent to your ${mode === "email" ? "email" : "mobile"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {step === "details" ? (
                <motion.form
                  key="details"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  onSubmit={handleDetails}
                  className="space-y-4"
                >
                  {/* Name */}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      placeholder="Arun Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Mode toggle */}
                  <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {(["email", "phone"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setError(""); }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          mode === m
                            ? "bg-indigo-600 text-white"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {m === "email" ? "Email" : "Phone number"}
                      </button>
                    ))}
                  </div>

                  {mode === "email" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Mobile number</Label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-500 select-none whitespace-nowrap">
                          +91 (IND)
                        </span>
                        <Input
                          id="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="9876543210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending code…" : "Continue"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="text-primary hover:underline">Sign in</Link>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="otp"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  onSubmit={handleConfirm}
                  className="space-y-5"
                >
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Sent to{" "}
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {mode === "email" ? email : `+91 ${phone}`}
                    </span>
                    {" · "}
                    <button
                      type="button"
                      className="text-indigo-600 hover:underline text-sm"
                      onClick={() => { setStep("details"); setOtp(["","","","","",""]); setError(""); }}
                    >
                      Change
                    </button>
                  </p>

                  {/* Dev hint — only shown when Resend couldn't deliver */}
                  {devOtp && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
                      <strong>Dev mode:</strong> Email delivery failed (domain not verified).
                      Your code is <strong className="font-mono tracking-widest">{devOtp}</strong>
                    </div>
                  )}

                  {/* 6-box OTP input */}
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-11 h-12 text-center text-xl font-bold rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    ))}
                  </div>

                  {error && <p className="text-sm text-destructive text-center">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading || otp.join("").length < 6}>
                    {loading ? "Verifying…" : "Verify & create account"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Didn&apos;t receive it?{" "}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      className="text-indigo-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
