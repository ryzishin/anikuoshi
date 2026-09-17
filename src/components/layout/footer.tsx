import Link from "next/link";
import { BrandedLogo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <BrandedLogo />
          <p className="text-xs text-muted-foreground">
            Installable PWA · Sub &amp; dub · Powered by the APIKuoshi API
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link href="/home" className="hover:text-foreground">Home</Link>
          <Link href="/browse" className="hover:text-foreground">Browse</Link>
          <Link href="/search" className="hover:text-foreground">Search</Link>
          <Link href="/download" className="hover:text-foreground">Download source</Link>
          <a href="https://github.com/koudex/apikuoshi" target="_blank" rel="noreferrer" className="hover:text-foreground">
            API docs ↗
          </a>
          <span aria-hidden>·</span>
          <span>Educational use only — no content hosted.</span>
        </nav>
      </div>
    </footer>
  );
}
