import { cn } from "@/lib/utils";

/**
 * AniKuoshi wordmark — v1.1 kanji mark 「推」(oshi) on the brand gradient
 * tile + gradient wordmark. Matches the regenerated PWA icons/logo.svg.
 */
export function BrandedLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex select-none items-center gap-2">
      <svg
        width="30"
        height="30"
        viewBox="0 0 512 512"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="logo-k" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="115" fill="url(#logo-k)" />
        <g fill="#ffffff">
          {/* 推 glyph outline (Sarasa Mono SC Bold), pre-traced at 300px */}
          <g transform="translate(107.80 369.70) scale(0.300000 -0.300000)">
            <path d="M745 842Q765 810 784.0 771.0Q803 732 813 703L752 676H944V567H783V478H932V372H783V282H931V176H783V81H966V-28H548V-91H433V450Q417 428 401.5 408.0Q386 388 369 370L347 396L359 317L261 288V46Q261 4 252.0 -22.0Q243 -48 220 -62Q196 -77 162.0 -82.0Q128 -87 78 -86Q76 -63 66.5 -28.5Q57 6 46 31Q72 30 96.0 30.0Q120 30 129 30Q145 30 145 47V254L49 226L22 342Q48 348 79.5 355.5Q111 363 145 372V554H34V665H145V849H261V665H360V554H261V402L326 419Q315 431 304.0 441.5Q293 452 284 459Q330 505 371.0 566.5Q412 628 445.5 699.0Q479 770 502 844L615 813Q603 779 589.5 744.5Q576 710 561 676H698Q688 705 673.0 739.0Q658 773 642 801ZM548 478H671V567H548ZM548 372V282H671V372ZM548 176V81H671V176Z" />
          </g>
        </g>
        <path d="M 363 365 L 437 402 L 363 439 Z" fill="#ffffff" opacity="0.9" />
      </svg>
      {!compact && (
        <span className="text-[17px] font-bold tracking-tight">
          Ani<span className="brand-text">Kuoshi</span>
        </span>
      )}
    </span>
  );
}

/** Unique branded loader — orbiting ring + pulsing monogram core. */
export function KuoshiLoader({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-label={label || "Loading"}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} className="kuoshi-ring absolute inset-0">
          <defs>
            <linearGradient id={`loader-g-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand)" />
              <stop offset="100%" stopColor="var(--brand-2)" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={`url(#loader-g-${size})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="180 84"
          />
        </svg>
        <div className="kuoshi-core absolute inset-0 flex items-center justify-center">
          <div
            className="brand-gradient flex items-center justify-center rounded-2xl font-black text-white"
            style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.22 }}
          >
            K
          </div>
        </div>
      </div>
      {label !== undefined && (
        <span className={cn("text-xs font-medium text-muted-foreground", label === "" && "hidden")}>
          {label || "Loading…"}
        </span>
      )}
    </div>
  );
}

/**
 * FIX (v1.3.0 — §4/§10): the NEW stream-resolution loader — moving/wiggling
 * ellipsis, NO circular spinner. Three dots wave in sequence (CSS
 * `ellipsis-wiggle` in globals.css; disabled under reduced motion).
 */
export function EllipsisLoader({ size = 1, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-label={label || "Loading"}>
      <div
        className="ellipsis-dots"
        aria-hidden
        style={{ transform: `scale(${size})` }}
      >
        <span />
        <span />
        <span />
      </div>
      {label !== undefined && (
        <span className={cn("text-xs font-medium text-muted-foreground", label === "" && "hidden")}>
          {label || "Loading…"}
        </span>
      )}
    </div>
  );
}

/** Full-page branded loader. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <KuoshiLoader size={72} label={label} />
    </div>
  );
}
