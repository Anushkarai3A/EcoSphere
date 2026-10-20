import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared EcoSphere presentation primitives: monumental title type, micro mono
 * metadata, hairline rules, stat readouts. Pages compose these; business logic
 * stays in the pages.
 */

/** Monumental left-aligned title with the signature emerald→cyan underline mark. */
export function DisplayTitle({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <h1 className={cn("text-gallery-display text-bone", className)}>
      {lines.map((line, i) => (
        <span key={i} className="block">
          <span className="gallery-underline">{line}</span>
        </span>
      ))}
    </h1>
  );
}

/** Tiny mono metadata row (instrumentation, not decoration). */
export function MetaRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-1 font-micro text-[11px] uppercase text-ash", className)}>
      {children}
    </div>
  );
}

/** Section heading: mono kicker in emerald + clean display title. */
export function SectionHead({
  kicker,
  title,
  right,
  className,
}: {
  kicker: string;
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <p className="flex items-center gap-2 font-micro text-[10px] uppercase tracking-[0.08em] text-emerald">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_10px_rgba(46,207,143,0.9)]" />
          {kicker}
        </p>
        <h2 className="mt-2 font-display text-[30px] font-medium leading-[1.1] tracking-tight text-bone">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/** Hairline structural separator. */
export function Rule({ className }: { className?: string }) {
  return <div aria-hidden className={cn("gallery-rule", className)} />;
}

/** Stat readout: big display number + mono caption. */
export function Stat({ value, caption, accent = false }: { value: string; caption: string; accent?: boolean }) {
  return (
    <div>
      <p className={cn("font-title text-[34px] font-semibold leading-none", accent ? "text-gold text-glow-gold" : "text-bone")}>
        {value}
      </p>
      <p className="mt-2 font-micro text-[10px] uppercase text-ash">{caption}</p>
    </div>
  );
}
