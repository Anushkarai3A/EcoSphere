import { cn } from "@/lib/utils";

interface LogoProps {
  /** Tailwind size classes, e.g. "h-10 w-10". Defaults to 40px. */
  className?: string;
  alt?: string;
}

/**
 * Ecosphere's official mascot — the player avatar character.
 * Transparent PNG, cropped to the opaque sprite, framed in a soft circle.
 */
export function Logo({ className, alt = "Ecosphere" }: LogoProps) {
  return (
    <img
      src="/assets/player-avatar.png"
      alt={alt}
      draggable={false}
      className={cn(
        "select-none rounded-full object-contain",
        className ?? "h-10 w-10",
      )}
    />
  );
}
