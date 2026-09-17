"use client";

/** Keyboard shortcuts help modal — opens via the "?" key anywhere. */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Everywhere",
    items: [
      ["/", "Focus quick search (or jump to Search)"],
      ["?", "Open this help"],
      ["Esc", "Close dialogs & menus"],
    ],
  },
  {
    title: "Player",
    items: [
      ["Space / K", "Play or pause"],
      ["← / →", "Seek ±5 seconds"],
      ["J / L", "Seek ±10 seconds"],
      ["↑ / ↓", "Volume up / down"],
      ["M", "Mute"],
      ["F", "Fullscreen"],
      ["N / P", "Next / previous episode"],
      ["S", "Toggle server panel"],
      ["0–9", "Jump to 0–90% of the episode"],
    ],
  },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onShow = () => setOpen(true);
    window.addEventListener("anikuoshi:shortcuts", onShow);
    return () => window.removeEventListener("anikuoshi:shortcuts", onShow);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-2xl border-border/70 bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-4 w-4 text-primary" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Fast hands make light watching.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </p>
              <div className="space-y-1.5">
                {g.items.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{desc}</span>
                    <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
