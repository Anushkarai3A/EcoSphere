/**
 * Global page atmosphere: the "Mystical Emerald Valley Waterfalls" wallpaper
 * sits behind application content wherever the plain dark-green canvas used
 * to show. Content above it stays sharp — only this backdrop layer carries
 * the image plus a subtle dark teal overlay for readability.
 */
export function WorldBackground({ overlay = 0.5 }: { overlay?: number }) {
  return (
    <div aria-hidden className="world-background-layer pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-abyss">
      <div className="waterfall-backdrop absolute inset-0" />
      <div
        className="absolute inset-0 bg-[#02181c]"
        style={{ opacity: Math.min(1, Math.max(0, overlay)) }}
      />
    </div>
  );
}
