"use client";

/** PWA install prompt button — listens for beforeinstallprompt. */
import { useEffect, useState } from "react";
import { Download, MonitorDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  if (compact) {
    return (
      <Button variant="ghost" size="icon" aria-label="Install app" onClick={install} className="hidden sm:inline-flex">
        <MonitorDown className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button onClick={install} size="lg" className="brand-gradient border-0 text-white shadow-lg">
      <Download className="mr-2 h-4 w-4" /> Install app
    </Button>
  );
}
