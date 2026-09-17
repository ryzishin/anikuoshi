"use client";

/**
 * AniKuoshi navigation: top bar + slide-in sidebar (outside-click & Esc
 * dismissal) + htmx-powered quick search suggestions.
 *
 * FIX (v1.2.0 — §6):
 *  - the header (and its nav) now STAYS VISIBLE on /watch — it's the way out
 *    of the watch page without closing the site; the watch page itself adds
 *    a chevron back button for the return trip.
 *  - the sidebar's inline Appearance section moved into the /settings page
 *    (new "Settings" nav item); History (continue-watching) is a real page
 *    now (§7), not a profile anchor.
 *  - the duplicate custom close button was already removed in v1.1 — the
 *    Sheet primitive's own close + outside-click + Esc remain.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clapperboard,
  Compass,
  Heart,
  History,
  Home,
  LogIn,
  Menu,
  Palette,
  Search,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/auth-provider";
import { ACCENTS, THEME_VARIANTS, useThemeEngine } from "@/components/theme-engine";
import { InstallButton } from "@/components/pwa/install-button";
import { BrandedLogo } from "@/components/layout/logo";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/profile", label: "Profile", icon: User },
];

/** Secondary sidebar destinations (§6/§7). History is guest-friendly too —
 *  the page itself falls back to localStorage-backed progress. */
const SIDEBAR_SECONDARY = [
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  /**
   * FIX (v1.3.0 — §10 PERF): prefetch the critical routes during idle time —
   * the sidebar links never enter the viewport (hidden inside a Sheet), so
   * Next's viewport-based prefetch never warms them. First taps into
   * Home/Browse/Search/History/Settings render instantly afterwards.
   */
  useEffect(() => {
    const prefetch = () => {
      for (const href of ["/home", "/browse", "/search", "/history", "/settings"]) {
        router.prefetch(href);
      }
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; setTimeout: typeof setTimeout };
    let cancelled = false;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => { if (!cancelled) prefetch(); }, { timeout: 2500 });
    } else {
      const t = setTimeout(prefetch, 1200);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl ${
        isLanding ? "hidden" : ""
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* FIX (v1.3.0 — §1): the logo now goes to /home — the app shell —
            not the marketing landing page. */}
        <Link href="/home" aria-label="AniKuoshi home" className="flex items-center">
          <BrandedLogo />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname?.startsWith(item.href)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <QuickSearch />
          <InstallButton compact />
          <ThemeMenuButton />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------- sidebar body */

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-6 pt-2" data-testid="sidebar">
      <SheetHeader className="p-2">
        <SheetTitle className="flex items-center">
          <BrandedLogo />
          {/* FIX (v1.1): removed the duplicate custom close button — the
              Sheet primitive already renders one (plus outside-click, Esc
              and route-change dismissal remain intact). */}
        </SheetTitle>
      </SheetHeader>

      <nav className="mt-4 flex flex-col gap-1" aria-label="Sidebar">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
        {/* §7: History (continue watching) + §6: Settings — real pages now */}
        {SIDEBAR_SECONDARY.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
        {user && (
          <Link
            href="/profile#list"
            onClick={onNavigate}
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <Heart className="h-4.5 w-4.5" /> My List
          </Link>
        )}
      </nav>

      <Separator className="my-4" />

      {/* FIX (v1.2.0 — §6): the inline Appearance section moved into the
          /settings page — see SIDEBAR_SECONDARY above. Quick theme switching
          remains available from the header palette button. */}

      <div className="mt-auto pt-6 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Clapperboard className="h-3.5 w-3.5" /> Powered by APIKuoshi
        </p>
        <p className="mt-1">Press / to search · ? for shortcuts</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- quick search */

/**
 * FIX (v1.2.0 — §7): header quick search, beside the account area —
 *  - works signed-in AND signed-out (public /api/fragments/suggestions)
 *  - debounced (300 ms) with in-flight abort
 *  - poster previews come from the EJS fragment (h-11 poster per row)
 *  - keyboard-friendly: ↑/↓ move through results, Enter opens the highlight
 *    row (or the full search page), Esc closes; "/" focuses globally
 *  - visible on mobile too (the bottom nav is gone — the header is the nav)
 */
function QuickSearch() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** index of the keyboard-highlighted suggestion (-1 = none) */
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // keep the fragment rows in sync with keyboard highlight (§7 a11y)
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const rows = Array.from(box.querySelectorAll<HTMLAnchorElement>(".suggestion-item"));
    rows.forEach((row, i) => {
      row.classList.toggle("bg-accent/70", i === highlight);
      row.setAttribute("aria-selected", i === highlight ? "true" : "false");
      if (i === highlight) row.scrollIntoView({ block: "nearest" });
    });
  }, [highlight, busy, value]);

  // htmx-style fragment swap: debounced fetch of the EJS-rendered partial.
  const onChange = (next: string) => {
    setValue(next);
    setOpen(Boolean(next.trim()));
    setHighlight(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      if (boxRef.current) boxRef.current.innerHTML = "";
      return;
    }
    setBusy(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/fragments/suggestions?keyword=${encodeURIComponent(next.trim())}`, {
          signal: ctrl.signal,
        });
        const html = await res.text();
        if (boxRef.current) {
          boxRef.current.innerHTML = html;
          const htmx = (window as unknown as { htmx?: { process: (el: Element) => void } }).htmx;
          htmx?.process(boxRef.current);
        }
      } catch {
        /* aborted or offline */
      } finally {
        setBusy(false);
      }
    }, 300);
  };

  /** open the currently highlighted suggestion, else the full search page */
  const commit = () => {
    if (!value.trim()) return;
    const rows = boxRef.current?.querySelectorAll<HTMLAnchorElement>(".suggestion-item") ?? [];
    const picked = highlight >= 0 && highlight < rows.length ? rows[highlight]?.href : null;
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.blur();
    if (picked) router.push(picked);
    else router.push(`/search?q=${encodeURIComponent(value.trim())}`);
  };

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 sm:flex-none" role="combobox" aria-expanded={open && Boolean(value.trim())} aria-haspopup="listbox" aria-controls="quick-suggestions">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        data-quick-search
        type="search"
        value={value}
        placeholder="Search anime…"
        aria-label="Quick search anime"
        aria-autocomplete="list"
        aria-controls="quick-suggestions"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.trim() && setOpen(true)}
        onKeyDown={(e) => {
          const rows = boxRef.current?.querySelectorAll(".suggestion-item").length ?? 0;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (open && rows > 0) setHighlight((h) => (h + 1) % rows);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (open && rows > 0) setHighlight((h) => (h <= 0 ? rows - 1 : h - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="h-11 w-full rounded-full border border-border/70 bg-muted/60 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background sm:w-56 sm:focus:w-80 lg:w-64 lg:focus:w-96"
      />
      <div
        id="quick-suggestions"
        role="listbox"
        className={`absolute left-0 right-0 top-[3.25rem] z-50 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl ${
          open && value.trim() ? "" : "hidden"
        }`}
      >
        {busy && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
        <div ref={boxRef} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ theme btn */

function ThemeMenuButton() {
  const { variant, accent, setVariant, setAccent } = useThemeEngine();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative hidden md:block">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Theme settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Palette className="h-5 w-5" />
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-border bg-popover p-3 shadow-xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</p>
          <div className="grid grid-cols-2 gap-1.5">
            {THEME_VARIANTS.map((t) => (
              <button
                key={t.id}
                onClick={() => setVariant(t.id)}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                  variant === t.id ? "border-primary/60 bg-primary/10" : "border-border/60 text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accent</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                aria-label={a.label}
                onClick={() => setAccent(a.id)}
                className={`h-6 w-6 rounded-full ${
                  accent === a.id ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover" : ""
                }`}
                style={{ backgroundImage: a.swatch }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountButton() {
  const { user, loading } = useAuth();
  return (
    <Button variant="ghost" size="icon" asChild aria-label={user ? "Profile" : "Sign in"}>
      <Link href={user ? "/profile" : "/login"}>
        {loading ? (
          <span className="block h-5 w-5 animate-pulse rounded-full bg-muted" />
        ) : user?.avatarUrl ? (
           
          <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : user ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {user.username.charAt(0).toUpperCase()}
          </span>
        ) : (
          <LogIn className="h-5 w-5" />
        )}
      </Link>
    </Button>
  );
}
