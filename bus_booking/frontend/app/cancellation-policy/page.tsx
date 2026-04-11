import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle2, Zap, XCircle,
  Clock, Bus, Ban, CreditCard, RefreshCw, ClipboardList,
  Smartphone, Search, CheckSquare, Banknote,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy - e-GO",
  description: "How cancellations and refunds work on e-GO.",
};

const FULL_HOURS = 24;
const PARTIAL_HOURS = 6;
const PARTIAL_PCT = 50;

const faqs: Array<{ Icon: React.ElementType; q: string; a: string }> = [
  {
    Icon: Clock,
    q: "When will I get my refund?",
    a: "Refunds are processed within 5-7 business days after cancellation is confirmed. The timeline depends on your bank or payment provider.",
  },
  {
    Icon: Bus,
    q: "What if the bus operator cancels my trip?",
    a: "If the operator cancels, you receive a full 100% refund automatically — no action needed on your part.",
  },
  {
    Icon: Ban,
    q: "Can I cancel after the bus has departed?",
    a: "No. Once a trip has departed, cancellations are not accepted.",
  },
  {
    Icon: CreditCard,
    q: "Where does the refund go?",
    a: "The refund is credited to the original payment method — UPI, debit/credit card, or net banking.",
  },
  {
    Icon: RefreshCw,
    q: "Can I reschedule instead of cancelling?",
    a: "Rescheduling is offered by select operators. A rescheduled ticket cannot subsequently be cancelled for a refund.",
  },
  {
    Icon: ClipboardList,
    q: "What if I booked via a travel agent?",
    a: "This policy applies only to direct bookings on e-GO. For third-party bookings, contact the agent directly.",
  },
];

const steps: Array<{ Icon: React.ElementType; title: string; desc: string }> = [
  { Icon: Smartphone,   title: "Open My Trips",      desc: "Go to \"My Trips\" from the top menu or your account page." },
  { Icon: Search,       title: "Find your booking",  desc: "Locate the trip to cancel. Only upcoming confirmed trips are eligible." },
  { Icon: XCircle,      title: "Tap Cancel",         desc: "Click \"Cancel\" — a preview shows your exact refund before you confirm." },
  { Icon: CheckSquare,  title: "Confirm",             desc: "Review the amount, add a reason (optional), and confirm." },
  { Icon: Banknote,     title: "Get your refund",     desc: "Refund arrives in your account within 5-7 business days." },
];

const termItems = [
  "Cancellation requests must be submitted through the e-GO platform. Phone/email cancellations are not accepted.",
  "Refund percentages apply to the base fare only. Convenience fees and GST are non-refundable.",
  "If the bus operator cancels a trip, e-GO processes a 100% refund of the total amount paid, regardless of timing.",
  "Refunds are credited to the original payment method within 5-7 business days after confirmation.",
  "Policy does not apply to: duplicate bookings, third-party agent bookings, or rescheduled tickets.",
  "e-GO reserves the right to modify this policy at any time with prior notice.",
  "In case of any dispute, the refund amount calculated by e-GO's system is final and binding.",
];

export default function CancellationPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 md:py-20">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Customer-friendly policy
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Cancellation &amp; Refund</h1>
          <p className="text-indigo-100 text-lg max-w-xl">
            Cancel from{" "}
            <Link href="/bookings" className="underline underline-offset-2 text-white font-medium hover:no-underline">
              My Trips
            </Link>{" "}
            and get your money back — no calls needed.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 pb-20 space-y-8">

        {/* Refund tier cards */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Refund tiers</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <TierCard
              Icon={CheckCircle2}
              title="Full refund"
              subtitle={`Cancel more than ${FULL_HOURS}h before departure`}
              amount="100%"
              bg="bg-gradient-to-br from-indigo-500 to-blue-600"
            />
            <TierCard
              Icon={Zap}
              title={`${PARTIAL_PCT}% refund`}
              subtitle={`Cancel ${PARTIAL_HOURS}h\u2013${FULL_HOURS}h before departure`}
              amount={`${PARTIAL_PCT}%`}
              bg="bg-gradient-to-br from-blue-500 to-indigo-700"
            />
            <TierCard
              Icon={XCircle}
              title="No refund"
              subtitle={`Less than ${PARTIAL_HOURS}h before departure`}
              amount="0%"
              bg="bg-gradient-to-br from-slate-500 to-slate-700"
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-6">Refund window at a glance</h2>
          <div className="relative">
            <div className="absolute top-3 left-0 right-0 h-1.5 rounded-full overflow-hidden flex">
              <div className="flex-1 bg-indigo-400" />
              <div className="w-1 bg-white dark:bg-slate-900" />
              <div className="w-24 bg-blue-400" />
              <div className="w-1 bg-white dark:bg-slate-900" />
              <div className="w-20 bg-slate-300 dark:bg-slate-600" />
            </div>
            <div className="flex justify-between relative pt-0">
              <TimelineNode label="You book"          dot="bg-indigo-500"                        sub="Any time" />
              <TimelineNode label={`${FULL_HOURS}h`}  dot="bg-blue-500"                          sub="100% zone ends" />
              <TimelineNode label={`${PARTIAL_HOURS}h`} dot="bg-blue-400"                        sub="50% zone ends" />
              <TimelineNode label="Departure"         dot="bg-slate-400 dark:bg-slate-600"       sub="No refund" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-8 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" />100% refund zone</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />{PARTIAL_PCT}% refund zone</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />No refund zone</span>
          </div>
        </div>

        {/* How to cancel */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-5">How to cancel</h2>
          <div className="space-y-0">
            {steps.map((step, i) => {
              const Icon = step.Icon;
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/40">
                      <Icon className="h-4.5 w-4.5 h-[18px] w-[18px] text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
                    </div>
                    {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-indigo-100 dark:bg-indigo-900/40 my-1.5" />}
                  </div>
                  <div className="pb-5 pt-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{step.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Frequently asked questions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {faqs.map((faq, i) => {
              const Icon = faq.Icon;
              return (
                <div key={i} className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                      <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{faq.q}</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full T&C */}
        <div className="rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Terms &amp; Conditions</h2>
          <ol className="space-y-3">
            {termItems.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>

        {/* Bottom CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Ready to cancel your booking?</p>
            <p className="text-indigo-100 text-sm mt-0.5">Head to My Trips and tap Cancel on the booking.</p>
          </div>
          <Link
            href="/bookings"
            className="shrink-0 rounded-xl bg-white text-indigo-700 font-semibold text-sm px-5 py-2.5 hover:bg-indigo-50 transition-colors"
          >
            My Trips &rarr;
          </Link>
        </div>

        <div className="flex flex-wrap gap-4 text-sm pt-2">
          <Link href="/terms" className="text-indigo-600 hover:underline">Terms of Service</Link>
          <a href="mailto:support@e-go.in" className="text-slate-400 hover:text-slate-600 ml-auto">support@e-go.in</a>
        </div>
      </div>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function TierCard({ Icon, title, subtitle, amount, bg }: {
  Icon: React.ElementType; title: string; subtitle: string; amount: string; bg: string;
}) {
  return (
    <div className={`rounded-2xl p-6 text-white ${bg} shadow-md`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-4">
        <Icon className="h-5 w-5 text-white" strokeWidth={2} />
      </div>
      <p className="text-3xl font-bold mb-1">{amount}</p>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-white/70 mt-1 leading-snug">{subtitle}</p>
    </div>
  );
}

function TimelineNode({ label, dot, sub }: { label: string; dot: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className={`h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 shadow ${dot}`} />
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap mt-1">{label}</p>
      <p className="text-[10px] text-slate-400 whitespace-nowrap">{sub}</p>
    </div>
  );
}
