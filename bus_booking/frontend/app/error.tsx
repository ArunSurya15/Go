"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Home, Bug } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[e-GO error]", error);
  }, [error]);

  return (
    <div className="min-h-[88vh] flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-6 py-12 max-w-5xl mx-auto">

      {/* Illustration */}
      <div className="w-full lg:w-[52%] flex-shrink-0">
        <ErrorIllustration />
      </div>

      {/* Text */}
      <div className="flex-1 text-center lg:text-left space-y-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500">Something went wrong</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
          Oops,<br />
          <span className="text-indigo-600">hit a bump!</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed max-w-sm mx-auto lg:mx-0">
          Something unexpected broke on our end. Our team has been
          notified and we&apos;re already patching it up. Sorry for the hold!
        </p>

        {error.digest && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-400 font-mono">
            <Bug className="h-3.5 w-3.5 shrink-0" />
            Ref: {error.digest}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center lg:justify-start pt-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 transition-colors shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium text-sm px-5 py-3 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        </div>

        <p className="text-xs text-slate-400 pt-1">
          Still stuck? Write to{" "}
          <a href="mailto:support@e-go.in" className="text-indigo-500 hover:underline">support@e-go.in</a>
        </p>
      </div>
    </div>
  );
}

function ErrorIllustration() {
  return (
    <svg viewBox="0 0 460 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">

      {/* ── Background blob (warm tint for error) ── */}
      <path d="M40 200 C18 95 102 20 210 25 C295 30 380 8 422 88 C458 162 438 295 374 332 C310 368 155 374 90 315 C28 258 62 305 40 200Z" fill="#FFF7ED"/>

      {/* ── Decorative shapes ── */}
      <rect x="348" y="48" width="36" height="14" rx="7" fill="#FDE68A" transform="rotate(15 366 55)"/>
      <rect x="55" y="65" width="14" height="14" rx="3" fill="#FED7AA" transform="rotate(22 62 72)"/>
      <rect x="400" y="220" width="13" height="13" rx="2" fill="#FCA5A5" transform="rotate(-10 406 226)"/>
      <circle cx="75" cy="255" r="5" fill="#FED7AA"/>
      <circle cx="412" cy="155" r="7" fill="#FEF3C7"/>
      <circle cx="344" cy="300" r="4" fill="#FDE68A"/>

      {/* ── Road ── */}
      <rect x="60" y="305" width="340" height="22" rx="4" fill="#E2E8F0"/>
      {/* Dashed center line */}
      {[0,1,2,3,4,5].map((i) => (
        <rect key={i} x={90 + i * 52} y="314" width="28" height="4" rx="2" fill="white"/>
      ))}

      {/* ── Broken-down Bus ── */}
      <g transform="translate(90, 218) rotate(4 120 50)">
        {/* Body */}
        <rect width="240" height="72" rx="12" fill="#4F46E5"/>
        {/* Roof */}
        <rect x="12" y="-10" width="216" height="22" rx="8" fill="#4338CA"/>
        {/* Windows */}
        <rect x="18" y="12" width="44" height="28" rx="6" fill="#C7D2FE"/>
        {/* Cracked window */}
        <rect x="78" y="12" width="44" height="28" rx="6" fill="#C7D2FE"/>
        <line x1="88" y1="12" x2="82" y2="40" stroke="#A5B4FC" strokeWidth="1.5"/>
        <line x1="94" y1="12" x2="102" y2="30" stroke="#A5B4FC" strokeWidth="1.5"/>
        <rect x="138" y="12" width="44" height="28" rx="6" fill="#C7D2FE"/>
        {/* Door */}
        <rect x="196" y="18" width="32" height="54" rx="5" fill="#3730A3"/>
        <circle cx="224" cy="45" r="3" fill="#6366F1"/>
        {/* Headlight */}
        <rect x="228" y="16" width="14" height="10" rx="3" fill="#FEF08A"/>
        <rect x="228" y="30" width="14" height="10" rx="3" fill="#FEF08A"/>
        {/* Normal front tyre */}
        <circle cx="196" cy="76" r="18" fill="#1E1B4B"/>
        <circle cx="196" cy="76" r="8" fill="#818CF8"/>
        {/* Flat rear tyre (squashed) */}
        <ellipse cx="44" cy="84" rx="20" ry="10" fill="#1E1B4B"/>
        <ellipse cx="44" cy="84" rx="9" ry="4.5" fill="#818CF8"/>
      </g>

      {/* ── Smoke puffs from engine ── */}
      <circle cx="318" cy="215" r="12" fill="#CBD5E1" opacity="0.7"/>
      <circle cx="334" cy="200" r="9" fill="#CBD5E1" opacity="0.5"/>
      <circle cx="346" cy="188" r="6" fill="#CBD5E1" opacity="0.3"/>

      {/* ── Warning triangle on road ── */}
      <g transform="translate(115, 277)">
        <path d="M20 0 L40 34 L0 34 Z" fill="#F59E0B"/>
        <path d="M20 4 L36 32 L4 32 Z" fill="#FEF3C7"/>
        <rect x="18" y="12" width="4" height="12" rx="2" fill="#F59E0B"/>
        <circle cx="20" cy="28" r="2.5" fill="#F59E0B"/>
      </g>

      {/* ── Character — standing beside bus, hands on head ── */}
      {/* Legs */}
      <path d="M380,292 L372,315" stroke="#292524" strokeWidth="12" strokeLinecap="round"/>
      <path d="M402,292 L410,315" stroke="#292524" strokeWidth="12" strokeLinecap="round"/>
      <ellipse cx="368" cy="319" rx="13" ry="6" fill="#292524"/>
      <ellipse cx="413" cy="319" rx="13" ry="6" fill="#292524"/>
      {/* Body */}
      <rect x="374" y="234" width="36" height="58" rx="11" fill="#F87171"/>
      {/* Left arm — hand on head */}
      <path d="M374,248 Q355,232 352,214" stroke="#F87171" strokeWidth="12" strokeLinecap="round"/>
      <circle cx="350" cy="211" r="9" fill="#FBBF24"/>
      {/* Right arm — hand on head */}
      <path d="M410,248 Q428,232 430,214" stroke="#F87171" strokeWidth="12" strokeLinecap="round"/>
      <circle cx="432" cy="211" r="9" fill="#FBBF24"/>
      {/* Head */}
      <circle cx="392" cy="212" r="22" fill="#FBBF24"/>
      {/* Hair */}
      <ellipse cx="391" cy="197" rx="20" ry="10" fill="#292524"/>
      {/* Eyes — stressed/squinting */}
      <path d="M383,210 Q386,208 389,210" stroke="#292524" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M395,210 Q398,208 401,210" stroke="#292524" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Eyebrows — knitted together */}
      <path d="M381,204 Q385,200 389,203" stroke="#292524" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M395,203 Q399,200 403,204" stroke="#292524" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* Mouth — grimace */}
      <path d="M385,222 Q392,218 399,222" stroke="#292524" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* ── Wrench on ground ── */}
      <g transform="translate(165, 296) rotate(-30)">
        <rect x="0" y="0" width="6" height="32" rx="3" fill="#94A3B8"/>
        <rect x="-4" y="0" width="14" height="10" rx="3" fill="#94A3B8"/>
        <rect x="-3" y="1" width="12" height="8" rx="2" fill="#CBD5E1"/>
      </g>

      {/* ── Ground shadow ── */}
      <ellipse cx="228" cy="338" rx="165" ry="8" fill="#FED7AA" opacity="0.4"/>
    </svg>
  );
}
