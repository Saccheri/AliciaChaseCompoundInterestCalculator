import type { ReactNode } from "react";
import { bandLabel, type AvailabilityBand } from "../engine/forecast";

export function Card({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className={`rounded-2xl border border-line bg-paper p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-spruce">{children}</p>
  );
}

const BAND_CLASS: Record<AvailabilityBand, string> = {
  plenty: "bg-[#e5f2ea] text-spruce border-[#b7d4c4]",
  limited: "bg-[#f8efd8] text-amber border-[#e2cf9a]",
  scarce: "bg-[#f8e4e1] text-clay border-[#e3b6b0]",
  protected: "bg-[#e7eef8] text-reserved border-[#c5d4ea]",
  "alternative-travel": "bg-[#f3ecdf] text-ink border-[#e0d3bc]",
};

export function BandPill({ band }: { band: AvailabilityBand }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${BAND_CLASS[band]}`}>
      {bandLabel(band)}
    </span>
  );
}

export function bandSurface(band: AvailabilityBand): string {
  switch (band) {
    case "plenty":
      return "bg-[#1e5c4a] text-white";
    case "limited":
      return "bg-[#8a5a12] text-white";
    case "scarce":
      return "bg-[#8d2f2f] text-white";
    case "protected":
      return "bg-[#1d4e89] text-white";
    case "alternative-travel":
      return "bg-[#3e534c] text-white";
  }
}

export function Message({
  tone,
  children,
}: {
  tone: "warn" | "critical" | "ok" | "info";
  children: ReactNode;
}) {
  const toneClass = {
    warn: "border-[#e2cf9a] bg-[#f8efd8] text-amber",
    critical: "border-[#e3b6b0] bg-[#f8e4e1] text-clay",
    ok: "border-[#b7d4c4] bg-[#e5f2ea] text-spruce",
    info: "border-[#c5d4ea] bg-[#e7eef8] text-reserved",
  }[tone];
  return <div className={`rounded-xl border px-3 py-2 text-sm leading-relaxed ${toneClass}`}>{children}</div>;
}
