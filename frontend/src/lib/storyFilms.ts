/**
 * Story-film registry + playback engine.
 *
 * A film is one continuous world (hero position, greenness, cleanliness all
 * persist across beats), so the result is a single story — not a slideshow
 * of disconnected scenes. The recorder plays beats back-to-back with
 * style-specific transitions; Groq chooses the film and writes per-beat
 * narration. On-video typography lives in drawFilmOverlay and is shared by
 * the recorder, preview path, and verification harness.
 */
import type { Film, FilmId, FilmState } from "./filmKit";
import { AIR_FILM, GENERAL_FILM, SOLAR_FILM, WATER_FILM, WILDLIFE_FILM } from "./storyFilmsB";
import { FOREST_FILM, OCEAN_FILM } from "./storyFilmsA";
import {
  HAND_FONT,
  MONO_FONT,
  TRANSITION_SECONDS,
  beatRevealAlpha,
  blockHeight,
  canvasMeasure,
  clamp01,
  fontString,
  frameLayout,
  layoutMultilineText,
  maxPageLines,
  pageForProgress,
  resolveBeat,
  smoothstep,
  type TextBlock,
  type TextMeasure,
  type TextPage,
} from "./sceneLayout";

export type { FilmId };
export type { Film, FilmBeat, FilmState, BeatCtx } from "./filmKit";

export const FILMS: Record<FilmId, Film> = {
  forest: FOREST_FILM,
  ocean: OCEAN_FILM,
  water: WATER_FILM,
  solar: SOLAR_FILM,
  wildlife: WILDLIFE_FILM,
  air: AIR_FILM,
  general: GENERAL_FILM,
};

/** Map the classifier bucket to the film that tells its story. */
export function filmForBucket(bucket: string): FilmId {
  switch (bucket) {
    case "forest":
      return "forest";
    case "waste":
      return "ocean";
    case "water":
      return "water";
    case "energy":
      return "solar";
    case "wildlife":
      return "wildlife";
    case "air":
      return "air";
    default:
      return "general";
  }
}

export interface FilmPlan {
  film: Film;
  /** Cumulative beat end-times in seconds (length = beats). */
  bounds: number[];
  total: number;
  /** Final narration per beat (LLM line or film default). */
  narrations: string[];
}

/** Distribute totalSeconds across beats by weight; attach narrations. */
export function planFilm(film: Film, totalSeconds: number, narrations?: (string | null | undefined)[]): FilmPlan {
  const weights = film.beats.map((b) => b.weight);
  const sum = weights.reduce((a, b) => a + b, 0) || film.beats.length;
  const bounds: number[] = [];
  let acc = 0;
  for (const wgt of weights) {
    acc += (wgt / sum) * totalSeconds;
    bounds.push(acc);
  }
  // Fix float drift on the final boundary
  if (bounds.length > 0) bounds[bounds.length - 1] = totalSeconds;
  return {
    film,
    bounds,
    total: totalSeconds,
    narrations: film.beats.map((b, i) => narrations?.[i]?.trim() || b.narration),
  };
}

export interface BeatFrame {
  beatIndex: number;
  beatStart: number;
  beatEnd: number;
  beatTime: number;
  beatDuration: number;
  progress: number;
}

/**
 * Render one film frame for global time t (seconds). Mutates film state
 * (hero motion, particles) — call exactly once per output frame, except via
 * renderBeatPreview for transitions. Passing dt keeps playback deterministic
 * and independent of the browser's animation-frame rate.
 */
export function drawFilmFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  plan: FilmPlan,
  state: FilmState,
  t: number,
  dt = 1 / 30,
): BeatFrame {
  const timing = resolveBeat(plan.bounds, t);
  const beat = plan.film.beats[timing.index];
  if (!beat) throw new Error("Film has no beats");
  const step = Math.max(0.001, Math.min(0.1, dt));
  beat.draw({
    ctx,
    w,
    h,
    t: timing.beatTime,
    dur: timing.beatDuration,
    dt: step,
    p: timing.progress,
    time: t,
    film: state,
    seed: 5,
  });
  return {
    beatIndex: timing.index,
    beatStart: timing.start,
    beatEnd: timing.end,
    beatTime: timing.beatTime,
    beatDuration: timing.beatDuration,
    progress: timing.progress,
  };
}

/**
 * Render a beat preview WITHOUT mutating live state (for dissolves):
 * clones the world, draws, discards.
 */
export function renderBeatPreview(
  target: CanvasRenderingContext2D,
  w: number,
  h: number,
  plan: FilmPlan,
  live: FilmState,
  beatIndex: number,
  globalT: number,
): void {
  const beat = plan.film.beats[beatIndex];
  if (!beat) return;
  const clone: FilmState = JSON.parse(JSON.stringify(live)) as FilmState;
  const start = beatIndex === 0 ? 0 : (plan.bounds[beatIndex - 1] ?? 0);
  const dur = (plan.bounds[beatIndex] ?? plan.total) - start;
  beat.draw({ ctx: target, w, h, t: 0, dur: Math.max(0.001, dur), dt: 1 / 30, p: 0, time: globalT, film: clone, seed: 5 });
}

function beatWindow(plan: FilmPlan, beatIndex: number) {
  const start = beatIndex === 0 ? 0 : (plan.bounds[beatIndex - 1] ?? 0);
  const end = plan.bounds[beatIndex] ?? plan.total;
  return { start, end, duration: Math.max(0.001, end - start) };
}

function paintLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  top: number,
  lineHeight: number,
  align: CanvasTextAlign = "left",
): void {
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, x, top + i * lineHeight);
  });
}

function paintPage(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  page: TextPage,
  x: number,
  top: number,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = block.font;
  paintLines(ctx, page.lines, x, top, block.lineHeight, align);
}

function paintBlockCentered(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  pageIndex: number,
  x: number,
  y: number,
): void {
  const page = block.pages[pageIndex] ?? block.pages[0]!;
  const top = y - page.height / 2;
  paintPage(ctx, block, page, x, top, "center");
}

function introFade(globalT: number): number {
  if (globalT < 0.4) return smoothstep(globalT / 0.4);
  if (globalT > 1.8) return Math.max(0, 1 - (globalT - 1.8) / 0.6);
  return 1;
}

function drawStepDots(
  ctx: CanvasRenderingContext2D,
  count: number,
  active: number,
  x: number,
  y: number,
): void {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = i === active ? "#10b981" : "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(x + i * 26, y, i === active ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Style-specific on-video typography. Every style keeps its visual language
 * for titles, narration, and finale — never shared text cards. Text is
 * measured, wrapped, and paginated to the safe frame; nothing is sliced.
 */
export function drawFilmOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  plan: FilmPlan,
  beatIndex: number,
  globalT: number,
  style: string = "CARTOON_2D",
  transitionLead: number = TRANSITION_SECONDS,
): void {
  const line = plan.narrations[beatIndex] ?? "";
  const lastIdx = plan.film.beats.length - 1;
  const isFinale = beatIndex === lastIdx && plan.total - globalT < 3;
  const finaleTitle = plan.film.beats[lastIdx]?.title ?? plan.film.title;
  const regions = frameLayout(w, h);
  const safe = regions.safe;
  const { start: beatStart, duration: beatDuration } = beatWindow(plan, beatIndex);
  const beatProgress = clamp01((globalT - beatStart) / beatDuration);
  const captionAlpha = beatRevealAlpha(globalT, beatStart, beatIndex > 0 ? transitionLead : 0);
  const measure: TextMeasure = canvasMeasure(ctx);
  const bottom = safe.y + safe.height;

  if (style === "MOTION_GRAPHICS") {
    const beatTitle = (plan.film.beats[beatIndex]?.title ?? "").toUpperCase();
    const reveal = captionAlpha;
    const heading = layoutMultilineText(
      beatTitle,
      { maxWidth: Math.min(560, safe.width * 0.62), maxLines: 4, maxFontSize: 54, minFontSize: 22, weight: 900, preferredPages: 1 },
      measure,
    );
    ctx.save();
    ctx.globalAlpha = 0.12 * reveal;
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.2, 190, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.1, h * 0.85, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = reveal;
    const headingX = safe.x + (1 - reveal) * 48;
    const headingY = safe.y + 24;
    ctx.fillStyle = "#10b981";
    ctx.fillRect(headingX, headingY - 10, Math.max(8, 64 * reveal), 6);
    const headingPage = heading.pages[0]!;
    ctx.font = heading.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(2,6,23,0.85)";
    ctx.fillStyle = "#ffffff";
    headingPage.lines.forEach((ln, i) => {
      const lnY = headingY + i * heading.lineHeight;
      ctx.strokeText(ln, headingX, lnY);
      ctx.fillText(ln, headingX, lnY);
    });
    ctx.font = fontString(13, 700);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${String(beatIndex + 1).padStart(2, "0")} / ${String(plan.film.beats.length).padStart(2, "0")}`, safe.x + safe.width, safe.y + 8);
    drawStepDots(ctx, plan.film.beats.length, beatIndex, safe.x, safe.y + 64);
    ctx.restore();

    const caption = layoutMultilineText(
      line,
      { maxWidth: Math.min(600, safe.width * 0.68), maxLines: 3, maxFontSize: 22, minFontSize: 14, weight: 600, preferredPages: 8 },
      measure,
    );
    const captionPage = pageForProgress(caption, beatProgress);
    const boxW = Math.min(660, safe.width * 0.76);
    const boxH = 26 + maxPageLines(caption) * caption.lineHeight + 18;
    const boxY = bottom - boxH;
    ctx.save();
    ctx.globalAlpha = 0.72 * reveal;
    ctx.fillStyle = "rgba(2,6,23,0.72)";
    ctx.beginPath();
    ctx.roundRect(safe.x, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.fillStyle = "#10b981";
    ctx.fillRect(safe.x, boxY, 5, boxH);
    ctx.fillStyle = "#ecfdf5";
    paintPage(ctx, caption, captionPage, safe.x + 24, boxY + 16, "left");
    ctx.restore();

    if (isFinale) {
      const finale = layoutMultilineText(
        finaleTitle.toUpperCase(),
        { maxWidth: safe.width - 80, maxLines: 3, maxFontSize: 30, minFontSize: 18, weight: 900, preferredPages: 1 },
        measure,
      );
      const bandH = finale.pages[0]!.height + 26;
      const bandBottom = boxY - 18;
      const bandY = Math.max(safe.y + 120, bandBottom - bandH);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, (3 - (plan.total - globalT)) * 2));
      ctx.fillStyle = "rgba(16,185,129,0.92)";
      ctx.fillRect(safe.x, bandY, safe.width, bandH);
      ctx.fillStyle = "#022c22";
      paintBlockCentered(ctx, finale, 0, w / 2, bandY + bandH / 2);
      ctx.restore();
    }
    return;
  }

  if (style === "INFOGRAPHIC") {
    const pill = `STEP ${beatIndex + 1}/${plan.film.beats.length}`;
    const title = layoutMultilineText(
      plan.film.beats[beatIndex]?.title ?? "",
      { maxWidth: safe.width - 210, maxLines: 2, maxFontSize: 22, minFontSize: 14, weight: 800, preferredPages: 1 },
      measure,
    );
    const narration = layoutMultilineText(
      line,
      { maxWidth: safe.width - 56, maxLines: 3, maxFontSize: 16, minFontSize: 11, weight: 400, preferredPages: 8 },
      measure,
    );
    const titleH = Math.max(blockHeight(title), title.lineHeight);
    const narrationH = Math.max(blockHeight(narration), narration.lineHeight);
    const panelH = Math.min(safe.height, 18 + 26 + 10 + titleH + 10 + narrationH + 18 + 14);
    const panelY = bottom - panelH;
    const panelX = safe.x;
    const panelW = safe.width;
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.fillStyle = "rgba(248,250,252,0.94)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.font = fontString(13, 700);
    const pillW = ctx.measureText(pill).width + 24;
    ctx.roundRect(panelX + 18, panelY + 16, pillW, 26, 13);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = fontString(13, 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pill, panelX + 18 + pillW / 2, panelY + 29);
    ctx.fillStyle = "#0f172a";
    const titleTop = panelY + 56;
    paintPage(ctx, title, title.pages[0]!, panelX + 18, titleTop, "left");
    ctx.fillStyle = "#334155";
    const narrationTop = titleTop + titleH + 10;
    paintPage(ctx, narration, pageForProgress(narration, beatProgress), panelX + 18, narrationTop, "left");
    const railY = panelY + panelH - 12;
    const segW = (panelW - 36) / plan.film.beats.length;
    plan.film.beats.forEach((_, i) => {
      ctx.fillStyle = i <= beatIndex ? "#10b981" : "#cbd5e1";
      ctx.fillRect(panelX + 18 + i * segW, railY, segW - 6, 5);
    });
    ctx.restore();

    if (beatIndex === 0 && globalT < 2.4) {
      const intro = layoutMultilineText(
        plan.film.title,
        { maxWidth: safe.width - 80, maxLines: 6, maxFontSize: 40, minFontSize: 22, weight: 900, preferredPages: 1 },
        measure,
      );
      ctx.save();
      ctx.globalAlpha = introFade(globalT) * 0.96;
      ctx.fillStyle = "rgba(248,250,252,0.96)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#0f172a";
      paintBlockCentered(ctx, intro, 0, w / 2, h / 2 - 12);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(w / 2 - 80, h / 2 + intro.pages[0]!.height / 2 + 18, 160, 6);
      ctx.restore();
    }
    return;
  }

  if (style === "ECO_DOODLE") {
    const title = layoutMultilineText(
      plan.film.beats[beatIndex]?.title ?? "",
      { maxWidth: safe.width - 120, maxLines: 1, maxFontSize: 18, minFontSize: 12, weight: 700, family: HAND_FONT, preferredPages: 1 },
      measure,
    );
    const narration = layoutMultilineText(
      line,
      { maxWidth: safe.width - 120, maxLines: 3, maxFontSize: 19, minFontSize: 12, weight: 600, family: HAND_FONT, preferredPages: 8 },
      measure,
    );
    const titleH = Math.max(blockHeight(title), title.lineHeight);
    const narrationH = Math.max(blockHeight(narration), narration.lineHeight);
    const boxH = 18 + titleH + 8 + narrationH + 18;
    const boxY = bottom - boxH;
    ctx.save();
    ctx.globalAlpha = 0.92 * captionAlpha;
    ctx.fillStyle = "rgba(245,240,225,0.94)";
    ctx.fillRect(safe.x, boxY, safe.width, boxH);
    ctx.strokeStyle = "#44403c";
    ctx.lineWidth = 2;
    ctx.strokeRect(safe.x, boxY, safe.width, boxH);
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(safe.x, boxY, 6, boxH);
    ctx.fillStyle = "#166534";
    paintPage(ctx, title, title.pages[0]!, safe.x + 22, boxY + 18, "left");
    ctx.fillStyle = "#292524";
    paintPage(ctx, narration, pageForProgress(narration, beatProgress), safe.x + 22, boxY + 18 + titleH + 8, "left");
    ctx.restore();

    if (beatIndex === 0 && globalT < 2.4) {
      const intro = layoutMultilineText(
        plan.film.title,
        { maxWidth: safe.width - 80, maxLines: 6, maxFontSize: 34, minFontSize: 20, weight: 700, family: HAND_FONT, preferredPages: 1 },
        measure,
      );
      ctx.save();
      ctx.globalAlpha = introFade(globalT);
      ctx.fillStyle = "#f5f0e1";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#292524";
      paintBlockCentered(ctx, intro, 0, w / 2, h / 2 - 8);
      const up = Math.max(0, Math.min(1, globalT / 1.6));
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      const underlineW = Math.min(260, intro.pages[0]!.width * 0.65);
      ctx.moveTo(w / 2 - underlineW / 2, h / 2 + intro.pages[0]!.height / 2 + 20);
      ctx.lineTo(w / 2 - underlineW / 2 + underlineW * up, h / 2 + intro.pages[0]!.height / 2 + 20 + Math.sin(up * 9) * 2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (style === "PIXEL_ART") {
    const title = layoutMultilineText(
      (plan.film.beats[beatIndex]?.title ?? "").toUpperCase(),
      { maxWidth: safe.width - 80, maxLines: 1, maxFontSize: 17, minFontSize: 11, weight: 700, family: MONO_FONT, preferredPages: 1 },
      measure,
    );
    const narration = layoutMultilineText(
      line,
      { maxWidth: safe.width - 80, maxLines: 3, maxFontSize: 16, minFontSize: 11, weight: 700, family: MONO_FONT, preferredPages: 8 },
      measure,
    );
    const titleH = Math.max(blockHeight(title), title.lineHeight);
    const narrationH = Math.max(blockHeight(narration), narration.lineHeight);
    const boxH = 18 + titleH + 8 + narrationH + 18;
    const boxY = bottom - boxH;
    ctx.save();
    ctx.globalAlpha = 0.96 * captionAlpha;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(safe.x, boxY, safe.width, boxH);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.strokeRect(safe.x, boxY, safe.width, boxH);
    ctx.fillStyle = "#22c55e";
    paintPage(ctx, title, title.pages[0]!, safe.x + 22, boxY + 18, "left");
    ctx.fillStyle = "#e2e8f0";
    paintPage(ctx, narration, pageForProgress(narration, beatProgress), safe.x + 22, boxY + 18 + titleH + 8, "left");
    ctx.restore();

    if (beatIndex === 0 && globalT < 2.4) {
      const intro = layoutMultilineText(
        plan.film.title.toUpperCase(),
        { maxWidth: safe.width - 80, maxLines: 6, maxFontSize: 30, minFontSize: 16, weight: 700, family: MONO_FONT, preferredPages: 1 },
        measure,
      );
      ctx.save();
      ctx.globalAlpha = introFade(globalT);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#22c55e";
      paintBlockCentered(ctx, intro, 0, w / 2, h / 2 - 16);
      ctx.fillStyle = "#facc15";
      ctx.font = fontString(14, 700, MONO_FONT);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("PRESS PLAY", w / 2, h / 2 + intro.pages[0]!.height / 2 + 18);
      ctx.restore();
    }
    return;
  }

  // CARTOON_2D (default): cinematic title, narration subtitle, finale card
  const titleBlock = layoutMultilineText(
    plan.film.title,
    { maxWidth: safe.width - 80, maxLines: 6, maxFontSize: 34, minFontSize: 20, weight: 800, preferredPages: 1 },
    measure,
  );
  const beatTitleBlock = layoutMultilineText(
    plan.film.beats[beatIndex]?.title ?? "",
    { maxWidth: safe.width - 80, maxLines: 1, maxFontSize: 17, minFontSize: 11, weight: 800, preferredPages: 1 },
    measure,
  );
  const narrationBlock = layoutMultilineText(
    line,
    { maxWidth: safe.width - 80, maxLines: 3, maxFontSize: 18, minFontSize: 12, weight: 600, preferredPages: 8 },
    measure,
  );
  const beatTitleH = Math.max(blockHeight(beatTitleBlock), beatTitleBlock.lineHeight);
  const narrationH = Math.max(blockHeight(narrationBlock), narrationBlock.lineHeight);
  const boxH = 22 + beatTitleH + 6 + narrationH + 22;
  const boxY = bottom - boxH;
  ctx.save();
  ctx.globalAlpha = 0.86 * captionAlpha;
  ctx.fillStyle = "rgba(2,6,23,0.78)";
  ctx.fillRect(0, boxY, w, h - boxY);
  ctx.fillStyle = "#86efac";
  paintPage(ctx, beatTitleBlock, beatTitleBlock.pages[0]!, w / 2, boxY + 22, "center");
  ctx.fillStyle = "#ffffff";
  paintPage(ctx, narrationBlock, pageForProgress(narrationBlock, beatProgress), w / 2, boxY + 22 + beatTitleH + 6, "center");
  ctx.restore();

  if (beatIndex === 0 && globalT < 2.4) {
    const bandH = titleBlock.pages[0]!.height + 36;
    const bandY = h * 0.3 - bandH / 2;
    ctx.save();
    ctx.globalAlpha = introFade(globalT);
    ctx.fillStyle = "rgba(2,6,23,0.58)";
    ctx.fillRect(0, bandY, w, bandH);
    ctx.fillStyle = "#ffffff";
    paintBlockCentered(ctx, titleBlock, 0, w / 2, bandY + bandH / 2);
    ctx.restore();
  }

  if (isFinale) {
    const finale = layoutMultilineText(
      finaleTitle,
      { maxWidth: safe.width - 80, maxLines: 3, maxFontSize: 32, minFontSize: 18, weight: 800, preferredPages: 1 },
      measure,
    );
    const bandH = finale.pages[0]!.height + 28;
    const bandY = Math.max(safe.y + 70, h * 0.36 - bandH / 2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, (3 - (plan.total - globalT)) * 2));
    ctx.fillStyle = "rgba(2,6,23,0.6)";
    ctx.fillRect(0, bandY, w, bandH);
    ctx.fillStyle = "#fefce8";
    paintBlockCentered(ctx, finale, 0, w / 2, bandY + bandH / 2);
    ctx.restore();
  }
}
