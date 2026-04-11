import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - e-GO",
  description: "Terms and conditions for using the e-GO bus booking platform.",
};

const sections = [
  {
    num: "01",
    emoji: "&#x1F68C;",
    color: "indigo",
    title: "The e-GO Platform",
    points: [
      {
        heading: "Role of e-GO",
        body: "e-GO is a technology platform that connects passengers with independent bus operators. e-GO does not own or operate any bus, nor does it act as a transport agent. Ticket information — routes, fares, seat availability, amenities — is provided entirely by the respective bus operator.",
      },
      {
        heading: "Limitation of Liability",
        body: null,
        list: [
          "Delayed or early departure/arrival of the bus",
          "The conduct of bus operator staff",
          "Condition of the bus or seats not matching the description",
          "Trip cancellations by the operator for any reason",
          "Loss or damage of passenger baggage",
          "Changes to boarding/dropping points made by the operator",
        ],
        footer: "e-GO's maximum liability in any dispute is limited to the fare amount paid for the affected booking.",
      },
      {
        heading: "Operator Responsibility",
        body: "The bus operator is solely responsible for compliance with all applicable laws including the Motor Vehicles Act, route permits, and fare regulations issued by the relevant RTO or State Government.",
      },
    ],
  },
  {
    num: "02",
    emoji: "&#x1F3AB;",
    color: "violet",
    title: "Bookings & Tickets",
    points: [
      {
        heading: "Ticket Issuance",
        body: "A booking confirmation is issued based on information provided by the bus operator. e-GO does not independently verify seat availability beyond what the operator reports.",
      },
      {
        heading: "Non-Transferability",
        body: "All tickets are non-transferable. The passenger whose name appears on the ticket must be the traveller, and may be required to show a valid government-issued ID at boarding.",
      },
      {
        heading: "Boarding Requirements",
        body: "Passengers are advised to arrive at the boarding point at least 30 minutes before departure, carry a copy of the ticket, and confirm the exact boarding location directly with the operator.",
      },
      {
        heading: "Payments",
        body: "The total booking amount includes the base fare and any applicable platform convenience fee or GST. Payment is collected in full at the time of booking.",
      },
    ],
  },
  {
    num: "03",
    emoji: "&#x1F4B0;",
    color: "emerald",
    title: "Cancellations & Refunds",
    cta: { label: "View full Cancellation Policy", href: "/cancellation-policy" },
    points: [
      {
        heading: "How to Cancel",
        body: "Tickets can be cancelled via \"My Trips\" in the app or website, by the passenger, before departure. Cancellations are not accepted via phone or email.",
      },
      {
        heading: "Operator-Initiated Cancellations",
        body: "If a bus operator cancels a trip, e-GO will refund 100% of the fare to the original payment method within 7-10 business days.",
      },
      {
        heading: "Rescheduling",
        body: "Rescheduling is offered only by select operators. It is subject to the operator's rescheduling fee and any fare difference. A rescheduled ticket cannot be cancelled for a refund.",
      },
    ],
  },
  {
    num: "04",
    emoji: "&#x1F464;",
    color: "sky",
    title: "User Responsibilities",
    list: [
      "Provide accurate personal details during registration and booking.",
      "Keep login credentials secure; you are responsible for all activity on your account.",
      "Do not use the platform for fraudulent or unlawful purposes.",
      "Do not attempt to circumvent pricing, seat availability, or cancellation logic.",
      "Comply with all applicable travel regulations and operator instructions.",
    ],
  },
  {
    num: "05",
    emoji: "&#x1F512;",
    color: "pink",
    title: "Privacy",
    body: "By using e-GO, you agree to the collection and use of your personal data as described in our Privacy Policy. We use your data to process bookings, send trip notifications, and improve the platform. We do not sell your data to third parties.",
  },
  {
    num: "06",
    emoji: "&#x2696;&#xFE0F;",
    color: "amber",
    title: "Governing Law",
    body: "These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the competent courts in India. e-GO reserves the right to update these Terms at any time with notice via email or an in-app banner.",
  },
];

const colorMap: Record<string, { bg: string; border: string; badge: string; text: string; dot: string }> = {
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-100 dark:border-indigo-900",
    badge: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
    text: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-400",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-100 dark:border-violet-900",
    badge: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-400",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-100 dark:border-emerald-900",
    badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-400",
  },
  sky: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-100 dark:border-sky-900",
    badge: "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-400",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-100 dark:border-pink-900",
    badge: "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300",
    text: "text-pink-700 dark:text-pink-300",
    dot: "bg-pink-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-100 dark:border-amber-900",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-400",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 md:py-20">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Legal document
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Terms of Service</h1>
          <p className="text-indigo-100 text-lg max-w-xl">
            Plain-language rules for using e-GO. We keep it short and honest.
          </p>
          <p className="text-indigo-200 text-sm mt-4">Last updated: April 2026</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
            {sections.map((s) => {
              const c = colorMap[s.color];
              return (
                <a
                  key={s.num}
                  href={`#section-${s.num}`}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${c.badge} hover:opacity-80`}
                >
                  {s.title}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="mx-auto max-w-4xl px-4 py-10 pb-20 space-y-6">
        {sections.map((s) => {
          const c = colorMap[s.color];
          return (
            <div
              key={s.num}
              id={`section-${s.num}`}
              className={`rounded-2xl border p-6 md:p-8 scroll-mt-16 ${c.bg} ${c.border}`}
            >
              {/* Section header */}
              <div className="flex items-start gap-4 mb-6">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 shadow-sm text-2xl"
                  dangerouslySetInnerHTML={{ __html: s.emoji }}
                />
                <div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${c.text}`}>
                    Section {s.num}
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {s.title}
                  </h2>
                </div>
              </div>

              {/* CTA link */}
              {"cta" in s && s.cta && (
                <div className={`mb-5 rounded-xl border ${c.border} bg-white dark:bg-slate-900/60 px-4 py-3 flex items-center justify-between`}>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Need full refund details?</p>
                  <Link href={s.cta.href} className={`text-sm font-semibold ${c.text} hover:underline`}>
                    {s.cta.label} &rarr;
                  </Link>
                </div>
              )}

              {/* Top-level list */}
              {"list" in s && s.list && (
                <ul className="space-y-2">
                  {(s.list as string[]).map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {/* Top-level body */}
              {"body" in s && s.body && (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{s.body}</p>
              )}

              {/* Points */}
              {"points" in s && s.points && (
                <div className="space-y-5">
                  {(s.points as Array<{ heading: string; body?: string | null; list?: string[]; footer?: string }>).map((pt, i) => (
                    <div key={i} className="bg-white/60 dark:bg-slate-900/40 rounded-xl px-4 py-4">
                      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${c.text}`}>
                        {pt.heading}
                      </p>
                      {pt.body && (
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{pt.body}</p>
                      )}
                      {pt.list && (
                        <ul className="space-y-1.5 mt-1">
                          {pt.list.map((li, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                              {li}
                            </li>
                          ))}
                        </ul>
                      )}
                      {pt.footer && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 italic">{pt.footer}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer contact */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Have a question about these terms?</p>
            <p className="text-indigo-100 text-sm mt-0.5">Our support team is happy to help.</p>
          </div>
          <a
            href="mailto:support@e-go.in"
            className="shrink-0 rounded-xl bg-white text-indigo-700 font-semibold text-sm px-5 py-2.5 hover:bg-indigo-50 transition-colors"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
