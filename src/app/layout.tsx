import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";
import { ThemeEngineProvider } from "@/components/theme-engine";
import { AuthProvider } from "@/components/auth-provider";
import { PreferencesProvider } from "@/components/preferences-provider";
import { AosProvider, ServiceWorkerRegistrar, GlobalShortcuts } from "@/components/app-providers";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://anikuoshi.vercel.app"),
  title: {
    default: "AniKuoshi — Anime Streaming PWA",
    template: "%s · AniKuoshi",
  },
  description:
    "Discover and stream anime — trending series, seasonal schedules, sub & dub servers, and a polished custom player. Installable PWA powered by APIKuoshi.",
  applicationName: "AniKuoshi",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AniKuoshi",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "AniKuoshi — Anime Streaming PWA",
    description: "Trending anime, sub & dub servers, custom player, installable PWA.",
    siteName: "AniKuoshi",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0812",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col`}>
        {/* FIX (v1.2.0 — §10 PERF): warm the API connection before the first
            fetch fires — the API host answers every poster/stream/catalog
            request, so an early DNS+TLS handshake shaves real latency off
            first paint. React hoists these link tags into <head>. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "https://apikuoshi-v2.onrender.com"} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "https://apikuoshi-v2.onrender.com"} />
        <ThemeEngineProvider>
          <AuthProvider>
            <PreferencesProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-3 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <AosProvider>
              <Navbar />
              {/* FIX (v1.2.0 — §6): the mobile bottom nav was removed entirely —
                  the sidebar + header handle navigation on every screen size,
                  so the main content no longer reserves the 64px nav strip. */}
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
            </AosProvider>
            <ServiceWorkerRegistrar />
            <GlobalShortcuts />
            <ShortcutsModal />
            <Toaster
              position="bottom-right"
              theme="dark"
              toastOptions={{
                style: {
                  background: "oklch(0.19 0.02 295)",
                  border: "1px solid oklch(0.28 0.02 295)",
                  color: "oklch(0.955 0.005 300)",
                },
              }}
            />
            </PreferencesProvider>
          </AuthProvider>
        </ThemeEngineProvider>
        <Script src="/vendor/htmx.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
