import Link from "next/link";
import { Bus, Mail, Phone } from "lucide-react";

const columns = [
  {
    heading: "Book",
    color: "text-violet-300",
    items: [
      { label: "Search buses", href: "/" },
      { label: "My trips", href: "/bookings" },
      { label: "Track bus", href: "/track" },
    ],
  },
  {
    heading: "Account",
    color: "text-sky-300",
    items: [
      { label: "My account", href: "/account" },
      { label: "Sign up", href: "/register" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    heading: "Operators",
    color: "text-emerald-300",
    items: [
      { label: "Operator login", href: "/operator/login" },
      { label: "Dashboard", href: "/operator/dashboard" },
      { label: "Admin portal", href: "/admin/login" },
    ],
  },
  {
    heading: "Legal",
    color: "text-amber-300",
    items: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Cancellation policy", href: "/cancellation-policy" },
      { label: "Privacy policy", href: "/privacy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 text-slate-300 mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">

        {/* Top section */}
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-5 mb-12">

          {/* Brand */}
          <div className="md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 group-hover:bg-indigo-400 transition-colors">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">e-GO</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Book bus tickets safely and easily across India.
            </p>
            <div className="space-y-2">
              <a
                href="mailto:support@e-go.in"
                className="flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                support@e-go.in
              </a>
              <a
                href="tel:+918000000000"
                className="flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                +91 80000 00000
              </a>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading} className="space-y-4">
              <p className={`text-xs font-bold uppercase tracking-widest ${col.color}`}>
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="text-indigo-400 font-semibold">e-GO</span>
            <span>&copy; {new Date().getFullYear()}. All rights reserved.</span>
          </div>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-indigo-300 transition-colors">Terms</Link>
            <Link href="/cancellation-policy" className="hover:text-indigo-300 transition-colors">Cancellation</Link>
            <Link href="/privacy" className="hover:text-indigo-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
