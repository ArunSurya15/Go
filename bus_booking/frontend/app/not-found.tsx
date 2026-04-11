import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[88vh] flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-6 py-12 max-w-5xl mx-auto">

      {/* Illustration */}
      <div className="w-full lg:w-[52%] flex-shrink-0">
        <NotFoundIllustration />
      </div>

      {/* Text */}
      <div className="flex-1 text-center lg:text-left space-y-5">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Page not found</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
          Oops,<br />
          <span className="text-indigo-600">wrong stop!</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed max-w-sm mx-auto lg:mx-0">
          Uh oh — we can&apos;t seem to find the page you&apos;re looking for.
          Try going back or head home to search buses.
        </p>
        <div className="flex flex-wrap gap-3 justify-center lg:justify-start pt-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 transition-colors shadow-sm"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium text-sm px-5 py-3 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Search className="h-4 w-4" />
            Search buses
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFoundIllustration() {
  return (
    <svg viewBox="0 0 460 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">

      {/* ── Background blob ── */}
      <path d="M45 195 C22 88 108 18 218 22 C305 26 388 6 426 84 C461 158 442 292 378 328 C314 363 158 372 94 312 C30 252 68 302 45 195Z" fill="#EEF2FF"/>

      {/* ── Floating decorative shapes ── */}
      <rect x="354" y="44" width="38" height="14" rx="7" fill="#FCA5A5" transform="rotate(18 373 51)"/>
      <rect x="52" y="68" width="15" height="15" rx="3" fill="#A5B4FC" transform="rotate(25 59.5 75.5)"/>
      <rect x="398" y="218" width="13" height="13" rx="2" fill="#FCA5A5" transform="rotate(-12 404 224)"/>
      <circle cx="78" cy="258" r="5" fill="#C7D2FE"/>
      <circle cx="416" cy="152" r="7" fill="#E0E7FF"/>
      <circle cx="348" cy="298" r="4" fill="#C7D2FE"/>

      {/* ── Destination board (central element) ── */}
      <g transform="translate(130, 108) rotate(-3 86 52)">
        <rect width="172" height="104" rx="12" fill="#4F46E5"/>
        <rect x="10" y="10" width="152" height="65" rx="8" fill="#3730A3"/>
        {/* "???" on screen */}
        <text x="86" y="57" fontSize="30" fontWeight="800" fill="#818CF8" textAnchor="middle" fontFamily="system-ui, Arial, sans-serif">???</text>
        {/* Status strips at bottom */}
        <rect x="10" y="84" width="68" height="10" rx="5" fill="#6366F1"/>
        <rect x="84" y="84" width="78" height="10" rx="5" fill="#6366F1"/>
        {/* Error dot */}
        <circle cx="154" cy="22" r="6" fill="#F87171"/>
        <circle cx="154" cy="22" r="3" fill="#FEE2E2"/>
      </g>

      {/* ── Character 1 — sitting on top of board, legs dangling ── */}
      {/* Back arm — resting on board top */}
      <path d="M212,86 Q196,89 190,105" stroke="#F87171" strokeWidth="12" strokeLinecap="round"/>
      <circle cx="188" cy="107" r="8" fill="#FBBF24"/>
      {/* Legs hanging down board face */}
      <path d="M220,109 Q211,137 208,163" stroke="#292524" strokeWidth="12" strokeLinecap="round"/>
      <path d="M244,109 Q251,135 255,161" stroke="#292524" strokeWidth="12" strokeLinecap="round"/>
      <ellipse cx="204" cy="167" rx="13" ry="6" fill="#292524"/>
      <ellipse cx="258" cy="165" rx="13" ry="6" fill="#292524"/>
      {/* Body */}
      <rect x="212" y="72" width="38" height="37" rx="11" fill="#F87171"/>
      {/* Front arm — hand to chin, thinking */}
      <path d="M250,83 Q265,74 262,60" stroke="#F87171" strokeWidth="12" strokeLinecap="round"/>
      <circle cx="261" cy="57" r="8" fill="#FBBF24"/>
      {/* Head */}
      <circle cx="231" cy="51" r="20" fill="#FBBF24"/>
      {/* Hair */}
      <ellipse cx="230" cy="37" rx="18" ry="9" fill="#292524"/>
      {/* Eyes */}
      <circle cx="224" cy="51" r="2.5" fill="#292524"/>
      <circle cx="238" cy="51" r="2.5" fill="#292524"/>
      {/* Eyebrows — raised, puzzled */}
      <path d="M221,44 Q224,41 228,43" stroke="#292524" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M234,44 Q237,41 241,43" stroke="#292524" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Mouth — slight frown */}
      <path d="M225,60 Q231,57 237,60" stroke="#292524" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* ── Character 2 — standing, shrugging ── */}
      {/* Legs */}
      <path d="M354,286 L346,313" stroke="#292524" strokeWidth="12" strokeLinecap="round"/>
      <path d="M376,286 L384,313" stroke="#292524" strokeWidth="12" strokeLinecap="round"/>
      <ellipse cx="342" cy="317" rx="13" ry="6" fill="#292524"/>
      <ellipse cx="387" cy="317" rx="13" ry="6" fill="#292524"/>
      {/* Body */}
      <rect x="348" y="228" width="36" height="58" rx="11" fill="#4F46E5"/>
      {/* Left arm (shrug up-left) */}
      <path d="M348,245 Q326,232 315,216" stroke="#4F46E5" strokeWidth="12" strokeLinecap="round"/>
      <circle cx="312" cy="213" r="9" fill="#FBBF24"/>
      {/* Right arm (shrug up-right) */}
      <path d="M384,245 Q406,232 417,216" stroke="#4F46E5" strokeWidth="12" strokeLinecap="round"/>
      <circle cx="420" cy="213" r="9" fill="#FBBF24"/>
      {/* Head */}
      <circle cx="366" cy="203" r="22" fill="#FBBF24"/>
      {/* Hair */}
      <ellipse cx="365" cy="188" rx="20" ry="10" fill="#292524"/>
      {/* Eyes */}
      <circle cx="358" cy="203" r="2.5" fill="#292524"/>
      <circle cx="374" cy="203" r="2.5" fill="#292524"/>
      {/* Eyebrows — raised, confused */}
      <path d="M355,195 Q358,191 362,194" stroke="#292524" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M369,195 Q372,191 376,194" stroke="#292524" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Mouth — open/surprised O */}
      <circle cx="366" cy="215" r="4" fill="#292524"/>

      {/* ── Suitcase on the ground ── */}
      <g transform="translate(290, 292)">
        <rect width="48" height="36" rx="7" fill="#6366F1"/>
        <rect x="7" y="6" width="34" height="23" rx="5" fill="#818CF8"/>
        <path d="M14,0 Q24,-8 34,0" stroke="#4338CA" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <rect x="19" y="13" width="10" height="8" rx="2" fill="#4338CA"/>
        <circle cx="9" cy="36" r="4" fill="#312E81"/>
        <circle cx="39" cy="36" r="4" fill="#312E81"/>
      </g>

      {/* ── Floating cancelled ticket (upper-left) ── */}
      <g transform="translate(66, 154) rotate(-16)">
        <rect width="58" height="28" rx="5" fill="white" stroke="#C7D2FE" strokeWidth="1.5"/>
        <line x1="18" y1="0" x2="18" y2="28" stroke="#E0E7FF" strokeWidth="1" strokeDasharray="3 2"/>
        <line x1="28" y1="7" x2="50" y2="21" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="50" y1="7" x2="28" y2="21" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round"/>
        <rect x="3" y="8" width="10" height="3" rx="1.5" fill="#E0E7FF"/>
        <rect x="3" y="15" width="8" height="3" rx="1.5" fill="#E0E7FF"/>
      </g>

      {/* ── Ground shadow line ── */}
      <ellipse cx="230" cy="338" rx="165" ry="8" fill="#E0E7FF" opacity="0.5"/>
    </svg>
  );
}
