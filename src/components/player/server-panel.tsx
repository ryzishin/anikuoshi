"use client";

/** Server panel — grouped by audio type, with beta flags & original names. */
import { Badge } from "@/components/ui/badge";
import { Server, ShieldAlert } from "lucide-react";
import type { Stream } from "@/lib/api";

function ServerGroup({
  label,
  list,
  all,
  activeIdx,
  onSelect,
  disabled,
}: {
  label: string;
  list: Stream[];
  all: Stream[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {list.length === 0 && <span className="text-xs text-muted-foreground">None available</span>}
        {list.map((s) => {
          const idx = all.indexOf(s);
          const active = idx === activeIdx;
          return (
            <button
              key={`${s.provider}-${s.type}-${idx}`}
              disabled={disabled}
              onClick={() => onSelect(idx)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                active
                  ? "border-primary/70 bg-primary/15 text-foreground"
                  : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
              title={`${s.provider}${s.originalName ? ` (${s.originalName})` : ""} · ${s.kind}`}
            >
              <Server className="h-3 w-3" />
              {s.provider}
              {s.originalName && s.originalName !== s.provider && (
                <span className="hidden text-[10px] opacity-60 sm:inline">{s.originalName}</span>
              )}
              {s.kind === "embed" && (
                <Badge variant="outline" className="ml-0.5 border-0 px-1 py-0 text-[9px]">
                  embed
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ServerPanel({
  streams,
  activeIdx,
  onSelect,
  disabled,
}: {
  streams: Stream[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  disabled?: boolean;
}) {
  const subs = streams.filter((s) => (s.type || "sub") === "sub");
  const dubs = streams.filter((s) => (s.type || "sub") === "dub");

  return (
    <div className="space-y-3">
      <ServerGroup label="Sub" list={subs} all={streams} activeIdx={activeIdx} onSelect={onSelect} disabled={disabled} />
      <ServerGroup label="Dub" list={dubs} all={streams} activeIdx={activeIdx} onSelect={onSelect} disabled={disabled} />
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
        If a server fails, the player auto-falls back: refresh token → next direct server → embed →
        error card with the full server list.
      </p>
    </div>
  );
}
