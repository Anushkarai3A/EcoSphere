/**
 * Style compositing + transitions for story films (shared by the recorder
 * and the headless verification harness — one implementation, both paths).
 */
import type { AnimStyle } from "./filmStyles";

/**
 * Composite a rendered film-world frame onto the target canvas using the
 * selected style's visual language. Pixel art quantizes space; eco doodle
 * becomes ink duotone on paper; other styles pass through (their identity
 * comes from overlays, hero presence, transitions, and audio).
 */
export function compositeStyledWorld(
  target: CanvasRenderingContext2D,
  world: HTMLCanvasElement,
  styleId: AnimStyle,
  pixelScratch: HTMLCanvasElement | null,
): void {
  if (styleId === "PIXEL_ART") {
    const tiny = pixelScratch ?? document.createElement("canvas");
    tiny.width = 192;
    tiny.height = 108;
    const tctx = tiny.getContext("2d");
    if (!tctx) {
      target.drawImage(world, 0, 0);
      return;
    }
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(world, 0, 0, 192, 108);
    target.save();
    target.imageSmoothingEnabled = false;
    target.drawImage(tiny, 0, 0, 192, 108, 0, 0, 960, 540);
    target.restore();
    return;
  }
  if (styleId === "ECO_DOODLE") {
    // Ink-duotone posterize: luminance → 4 paper/ink tones (marker look)
    const wctx = world.getContext("2d");
    if (!wctx) {
      target.drawImage(world, 0, 0);
      return;
    }
    const img = wctx.getImageData(0, 0, 960, 540);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
      let r = 43, g = 38, b = 32;
      if (lum > 205) { r = 245; g = 240; b = 225; }
      else if (lum > 150) { r = 201; g = 191; b = 165; }
      else if (lum > 95) { r = 107; g = 98; b = 80; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    target.putImageData(img, 0, 0);
    return;
  }
  target.drawImage(world, 0, 0);
}

/** Style-specific beat transitions, painted onto the record canvas. */
export function paintStyleTransition(
  target: CanvasRenderingContext2D,
  next: HTMLCanvasElement,
  styleId: string,
  ease: number,
  w: number,
  h: number,
): void {
  const e = Math.max(0, Math.min(1, ease));
  if (styleId === "MOTION_GRAPHICS") {
    // Wipe: next scene slides in from the right with an accent edge
    target.save();
    target.beginPath();
    target.rect(0, 0, w * e, h);
    target.clip();
    target.drawImage(next, w * (1 - e), 0, w, h);
    target.restore();
    target.fillStyle = "#10b981";
    target.fillRect(w * e - 5, 0, 10, h);
    return;
  }
  if (styleId === "INFOGRAPHIC") {
    // Push-slide: next frame glides in from the right
    target.save();
    target.drawImage(next, -w * (1 - e), 0, w, h);
    target.restore();
    return;
  }
  if (styleId === "ECO_DOODLE") {
    // Marker swipe: ink bar sweeps, next scene revealed behind it
    target.save();
    target.beginPath();
    target.rect(0, 0, w * e, h);
    target.clip();
    target.drawImage(next, 0, 0);
    target.restore();
    target.fillStyle = "#292524";
    target.beginPath();
    target.roundRect(w * e - 9, -10, 18, h + 20, 9);
    target.fill();
    target.fillStyle = "#16a34a";
    target.beginPath();
    target.roundRect(w * e - 4, -10, 8, h + 20, 4);
    target.fill();
    return;
  }
  if (styleId === "PIXEL_ART") {
    // Pixel dissolve: blocks resolve by hashed order (8-bit transition)
    const cell = 48;
    for (let gy = 0; gy < h / cell; gy++) {
      for (let gx = 0; gx < w / cell; gx++) {
        const hash = ((gx * 73 + gy * 149) % 100) / 100;
        if (hash < e) {
          target.drawImage(next, gx * cell, gy * cell, cell, cell, gx * cell, gy * cell, cell, cell);
        }
      }
    }
    return;
  }
  // CARTOON_2D: cross-dissolve
  target.save();
  target.globalAlpha = e;
  target.drawImage(next, 0, 0);
  target.restore();
}
