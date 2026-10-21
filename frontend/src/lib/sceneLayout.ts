/**
 * Shared, DOM-free frame and text layout for story films.
 *
 * The recorder and any verification harness use the same 960x540 coordinate
 * space. Text is measured with the actual canvas font and wrapped/paginated
 * rather than sliced, so no narration is silently lost.
 */

export const FRAME_WIDTH = 960;
export const FRAME_HEIGHT = 540;
export const FRAME_MARGIN = 40;
export const TRANSITION_SECONDS = 0.7;
export const TEXT_ENTER_SECONDS = 0.45;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameLayout {
  width: number;
  height: number;
  margin: number;
  safe: Rect;
  header: Rect;
  caption: Rect;
}

export interface TextPage {
  lines: string[];
  width: number;
  height: number;
}

export interface TextBlock {
  pages: TextPage[];
  fontSize: number;
  lineHeight: number;
  font: string;
}

export type TextMeasure = (text: string, font: string) => number;

export interface TextLayoutOptions {
  maxWidth: number;
  maxLines: number;
  maxFontSize: number;
  minFontSize: number;
  weight?: string | number;
  family?: string;
  lineHeightRatio?: number;
  /** Try to fit within this many pages before shrinking to minFontSize. */
  preferredPages?: number;
}

export const SYSTEM_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
export const HAND_FONT = '"Segoe Print","Bradley Hand","Comic Sans MS",cursive';
export const MONO_FONT = '"Courier New",ui-monospace,monospace';

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

export function fontString(size: number, weight: string | number = 400, family = SYSTEM_FONT): string {
  return `${weight} ${size}px ${family}`;
}

export function frameLayout(w = FRAME_WIDTH, h = FRAME_HEIGHT): FrameLayout {
  const margin = Math.max(24, Math.round(Math.min(w, h) * 0.074));
  const safe: Rect = {
    x: margin,
    y: margin,
    width: w - margin * 2,
    height: h - margin * 2,
  };
  const headerHeight = Math.min(150, Math.round(safe.height * 0.3));
  const captionY = Math.round(safe.y + safe.height * 0.64);
  return {
    width: w,
    height: h,
    margin,
    safe,
    header: { x: safe.x, y: safe.y, width: safe.width, height: headerHeight },
    caption: { x: safe.x, y: captionY, width: safe.width, height: safe.y + safe.height - captionY },
  };
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Adapt a CanvasRenderingContext2D to the pure layout API. */
export function canvasMeasure(ctx: CanvasRenderingContext2D): TextMeasure {
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

function breakLongWord(word: string, font: string, maxWidth: number, measure: TextMeasure): string[] {
  if (!word) return [""];
  if (measure(word, font) <= maxWidth) return [word];
  const chunks: string[] = [];
  let rest = word;
  while (rest.length > 0) {
    let lo = 1;
    let hi = rest.length;
    let best = 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (measure(rest.slice(0, mid), font) <= maxWidth) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    chunks.push(rest.slice(0, best));
    rest = rest.slice(best);
  }
  return chunks;
}

function wrapAtSize(
  text: string,
  font: string,
  maxWidth: number,
  measure: TextMeasure,
): string[] {
  const words = text ? text.split(" ") : [];
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const pieces = breakLongWord(word, font, maxWidth, measure);
    for (const piece of pieces) {
      if (!current) {
        current = piece;
        continue;
      }
      const candidate = `${current} ${piece}`;
      if (measure(candidate, font) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = piece;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function paginate(lines: string[], maxLines: number, measure: TextMeasure, font: string, lineHeight: number): TextPage[] {
  const perPage = Math.max(1, Math.floor(maxLines));
  const pages: TextPage[] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    const pageLines = lines.slice(i, i + perPage);
    const width = pageLines.reduce((max, line) => Math.max(max, measure(line, font)), 0);
    pages.push({ lines: pageLines, width, height: pageLines.length * lineHeight });
  }
  return pages.length > 0 ? pages : [{ lines: [""], width: 0, height: 0 }];
}

/**
 * Fit text into a measured block. The font shrinks first, then text is
 * paginated. Text is never sliced or dropped.
 */
export function layoutMultilineText(
  text: string,
  opts: TextLayoutOptions,
  measure: TextMeasure,
): TextBlock {
  const normalized = normalizeText(text);
  const family = opts.family ?? SYSTEM_FONT;
  const weight = opts.weight ?? 400;
  const ratio = opts.lineHeightRatio ?? 1.24;
  const maxFont = Math.max(1, Math.floor(opts.maxFontSize));
  const minFont = Math.max(1, Math.min(maxFont, Math.floor(opts.minFontSize)));
  const preferredPages = Math.max(1, Math.floor(opts.preferredPages ?? 1));
  const maxLines = Math.max(1, Math.floor(opts.maxLines));
  const words = normalized ? normalized.split(" ") : [];
  let fallback: TextBlock | null = null;

  for (let size = maxFont; size >= minFont; size -= 1) {
    const font = fontString(size, weight, family);
    const longestWord = words.reduce((max, word) => Math.max(max, measure(word, font)), 0);
    if (longestWord > opts.maxWidth && size > minFont) continue;
    const lineHeight = Math.max(size, Math.round(size * ratio));
    const lines = wrapAtSize(normalized, font, opts.maxWidth, measure);
    const pages = paginate(lines, maxLines, measure, font, lineHeight);
    const block = { pages, fontSize: size, lineHeight, font };
    fallback = block;
    if (pages.length <= preferredPages) return block;
  }

  if (fallback) return fallback;
  const font = fontString(minFont, weight, family);
  const lineHeight = Math.max(minFont, Math.round(minFont * ratio));
  return {
    pages: paginate(wrapAtSize(normalized, font, opts.maxWidth, measure), maxLines, measure, font, lineHeight),
    fontSize: minFont,
    lineHeight,
    font,
  };
}

export function pageForProgress(block: TextBlock, progress: number): TextPage {
  if (block.pages.length <= 1) return block.pages[0]!;
  const index = Math.min(block.pages.length - 1, Math.floor(clamp01(progress) * block.pages.length));
  return block.pages[index]!;
}

export function blockHeight(block: TextBlock): number {
  return block.pages.reduce((max, page) => Math.max(max, page.height), 0);
}

export function maxPageLines(block: TextBlock): number {
  return block.pages.reduce((max, page) => Math.max(max, page.lines.length), 0);
}

export interface BeatTiming {
  index: number;
  start: number;
  end: number;
  beatTime: number;
  beatDuration: number;
  progress: number;
}

export function resolveBeat(bounds: number[], t: number): BeatTiming {
  if (bounds.length === 0) {
    return { index: 0, start: 0, end: 0, beatTime: 0, beatDuration: 0.001, progress: 0 };
  }
  let index = bounds.findIndex((bound) => t < bound);
  if (index === -1) index = bounds.length - 1;
  const start = index === 0 ? 0 : (bounds[index - 1] ?? 0);
  const end = bounds[index] ?? start + 0.001;
  const beatDuration = Math.max(0.001, end - start);
  const beatTime = Math.max(0, t - start);
  return { index, start, end, beatTime, beatDuration, progress: clamp01(beatTime / beatDuration) };
}

export interface TransitionTiming {
  active: boolean;
  beatIndex: number;
  nextIndex: number;
  progress: number;
  timeLeft: number;
}

export function resolveTransition(bounds: number[], t: number, duration = TRANSITION_SECONDS): TransitionTiming {
  const timing = resolveBeat(bounds, t);
  const timeLeft = timing.end - t;
  const hasNext = timing.index + 1 < bounds.length;
  return {
    active: hasNext && timeLeft > 0 && timeLeft < duration,
    beatIndex: timing.index,
    nextIndex: hasNext ? timing.index + 1 : timing.index,
    progress: smoothstep(1 - timeLeft / Math.max(0.001, duration)),
    timeLeft,
  };
}

/** Fade captions in with their beat, including during the incoming transition. */
export function beatRevealAlpha(globalT: number, beatStart: number, transitionLead = 0): number {
  const start = beatStart - Math.max(0, transitionLead);
  return smoothstep((globalT - start) / TEXT_ENTER_SECONDS);
}

export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}
