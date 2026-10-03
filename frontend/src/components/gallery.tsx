import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared gallery primitives: monumental display type, micro mono metadata,
 * hairline rules. Pages compose these; business logic stays in the pages.
 */

/** Monumental left-aligned display title with signature underline marks. */
export function DisplayTitle({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <h1 className={cn("text-gallery-display text-white", className)}>
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

/** Editorial section heading: small display + mono kicker. */
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
        <p className="font-micro text-[10px] uppercase tracking-[-0.02em] text-ash">{kicker}</p>
        <h2 className="mt-2 font-display text-[30px] font-normal leading-none text-white">{title}</h2>
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
export function Stat({ value, caption }: { value: string; caption: string }) {
  return (
    <div>
      <p className="font-display text-[30px] font-normal leading-none text-white">{value}</p>
      <p className="mt-2 font-micro text-[10px] uppercase text-ash">{caption}</p>
    </div>
  );
}
