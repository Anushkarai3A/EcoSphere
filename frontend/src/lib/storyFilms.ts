/**
 * Story-film registry + playback engine.
 *
 * A film is one continuous world (hero position, greenness, cleanliness all
 * persist across beats), so the result is a single story — not a slideshow
 * of disconnected scenes. The recorder plays beats back-to-back with
 * cross-dissolves; Groq chooses the film and writes per-beat narration.
 */
import type { Film, FilmId, FilmState } from "./filmKit";
import { AIR_FILM, GENERAL_FILM, SOLAR_FILM, WATER_FILM, WILDLIFE_FILM } from "./storyFilmsB";
import { FOREST_FILM, OCEAN_FILM } from "./storyFilmsA";

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
  beatTime: number;
  beatDuration: number;
}

let lastFrameWall = 0;

/**
 * Render one film frame for global time t (seconds). Mutates film state
 * (hero motion, particles) — call exactly once per output frame, except via
 * renderBeatPreview for transitions.
 */
export function drawFilmFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  plan: FilmPlan,
  state: FilmState,
  t: number,
): BeatFrame {
  const nowWall = Date.now();
  const dt = Math.max(0.001, Math.min(0.1, lastFrameWall === 0 ? 1 / 30 : (nowWall - lastFrameWall) / 1000));
  lastFrameWall = nowWall;

  let idx = plan.bounds.findIndex((b) => t < b);
  if (idx === -1) idx = plan.film.beats.length - 1;
  const beat = plan.film.beats[idx];
  if (!beat) throw new Error("Film has no beats");
  const start = idx === 0 ? 0 : (plan.bounds[idx - 1] ?? 0);
  const beatTime = Math.max(0, t - start);
  const dur = Math.max(0.001, (plan.bounds[idx] ?? plan.total) - start);
  beat.draw({ ctx, w, h, t: beatTime, dur, dt, p: Math.max(0, Math.min(1, beatTime / dur)), time: t, film: state, seed: 5 });
  return { beatIndex: idx, beatTime, beatDuration: dur };
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
  // Restore palette references (JSON clone loses object identity; values equal)
  const start = beatIndex === 0 ? 0 : (plan.bounds[beatIndex - 1] ?? 0);
  const dur = (plan.bounds[beatIndex] ?? plan.total) - start;
  beat.draw({ ctx: target, w, h, t: 0, dur, dt: 1 / 30, p: 0, time: globalT, film: clone, seed: 5 });
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    if ((cur + " " + wd).trim().length > maxChars && cur.length > 0) {
      lines.push(cur);
      cur = wd;
    } else {
      cur = `${cur} ${wd}`.trim();
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

/**
 * Style-specific on-video typography. Every style gets its own visual
 * language for titles, narration, and finale — never shared text cards.
 */
export function drawFilmOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  plan: FilmPlan,
  beatIndex: number,
  globalT: number,
  style: string = "CARTOON_2D",
): void {
  const line = plan.narrations[beatIndex] ?? "";
  const lastIdx = plan.film.beats.length - 1;
  const isFinale = beatIndex === lastIdx && plan.total - globalT < 3;
  const finaleTitle = plan.film.beats[lastIdx]?.title ?? "";

  if (style === "MOTION_GRAPHICS") {
    // Kinetic titles: huge beat title slams in from the right + accent sweep
    const beatTitle = (plan.film.beats[beatIndex]?.title ?? "").toUpperCase().slice(0, 40);
    const inP = Math.max(0, Math.min(1, (globalT - (plan.bounds[beatIndex - 1] ?? 0)) / 0.7));
    const ease = 1 - Math.pow(1 - inP, 3);
    const tx = w + 40 - ease * (w + 80);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.2, 190, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.1, h * 0.85, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Accent sweep bar
    ctx.fillStyle = "#10b981";
    ctx.fillRect(0, h * 0.3 + ease * 10, w * ease, 8);
    const kinetic = (text: string, x: number, y: number) => {
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(2,6,23,0.85)";
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    };
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 54px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    kinetic(beatTitle, tx - w / 2 + 60, h * 0.44);
    // Narration as clean sub-line
    ctx.font = "500 19px system-ui, sans-serif";
    ctx.fillStyle = "#ecfdf5";
    const sub = wrapLines(line.slice(0, 110), 52);
    sub.slice(0, 2).forEach((ln, i) => {
      kinetic(ln, 60, h * 0.58 + i * 28);
    });
    // Step dots
    plan.film.beats.forEach((_, i) => {
      ctx.fillStyle = i === beatIndex ? "#10b981" : "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(60 + i * 26, h - 40, i === beatIndex ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
    });
    if (isFinale) {
      ctx.fillStyle = "rgba(16,185,129,0.92)";
      ctx.fillRect(0, h * 0.68, w, 70);
      ctx.fillStyle = "#022c22";
      ctx.font = "900 30px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(finaleTitle.slice(0, 44), w / 2, h * 0.68 + 36);
    }
    ctx.restore();
    return;
  }

  if (style === "INFOGRAPHIC") {
    // Light explainer panel: step pill, title, narration, progress rail
    ctx.save();
    ctx.fillStyle = "rgba(248,250,252,0.94)";
    ctx.fillRect(0, h - 150, w, 150);
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    const pill = `STEP ${beatIndex + 1}/${plan.film.beats.length}`;
    ctx.font = "bold 13px system-ui, sans-serif";
    const pillW = ctx.measureText(pill).width + 24;
    ctx.roundRect(28, h - 132, pillW, 26, 13);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pill, 28 + pillW / 2, h - 118);
    const beatTitle = (plan.film.beats[beatIndex]?.title ?? "").slice(0, 44);
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(beatTitle, 28, h - 82);
    ctx.fillStyle = "#334155";
    ctx.font = "400 15px system-ui, sans-serif";
    wrapLines(line.slice(0, 130), 72).slice(0, 2).forEach((ln, i) => {
      ctx.fillText(ln, 28, h - 56 + i * 20);
    });
    // Progress rail across beats
    const railY = h - 12;
    const segW = (w - 56) / plan.film.beats.length;
    plan.film.beats.forEach((_, i) => {
      ctx.fillStyle = i <= beatIndex ? "#10b981" : "#cbd5e1";
      ctx.fillRect(28 + i * segW, railY, segW - 6, 5);
    });
    if (globalT < 2.4) {
      ctx.fillStyle = "rgba(248,250,252,0.96)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 40px system-ui, sans-serif";
      ctx.textAlign = "center";
      wrapLines(plan.film.title.slice(0, 56), 24).forEach((ln, i, arr) => {
        ctx.fillText(ln, w / 2, h / 2 - (arr.length - 1) * 24 + i * 48);
      });
    }
    ctx.restore();
    return;
  }

  if (style === "ECO_DOODLE") {
    // Paper strip + handwritten ink + marker underline draw-on
    const HAND = '"Segoe Print","Bradley Hand","Comic Sans MS",cursive';
    ctx.save();
    if (globalT < 2.4) {
      const title = plan.film.title.slice(0, 56);
      ctx.fillStyle = "#f5f0e1";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#292524";
      ctx.font = `bold 34px ${HAND}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrapLines(title, 26).forEach((ln, i, arr) => {
        ctx.fillText(ln, w / 2, h / 2 - (arr.length - 1) * 22 + i * 44);
      });
      // Marker underline draws itself
      const up = Math.max(0, Math.min(1, globalT / 1.6));
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(w / 2 - 130, h / 2 + 52);
      ctx.lineTo(w / 2 - 130 + 260 * up, h / 2 + 52 + Math.sin(up * 9) * 2);
      ctx.stroke();
    }
    // Narration on a paper strip with marker underline accent
    const lines = wrapLines(line.slice(0, 120), 58).slice(0, 2);
    const boxH = 26 + lines.length * 24;
    ctx.fillStyle = "rgba(245,240,225,0.92)";
    ctx.fillRect(40, h - boxH - 26, w - 80, boxH + 12);
    ctx.strokeStyle = "#44403c";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, h - boxH - 26, w - 80, boxH + 12);
    ctx.fillStyle = "#292524";
    ctx.font = `600 17px ${HAND}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, h - boxH - 26 + 24 + i * 24);
    });
    ctx.restore();
    return;
  }

  if (style === "PIXEL_ART") {
    // Chunky bordered caption box + monospace type
    const MONO = '"Courier New",ui-monospace,monospace';
    ctx.save();
    if (globalT < 2.4) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#22c55e";
      ctx.font = `bold 30px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrapLines(plan.film.title.slice(0, 48).toUpperCase(), 22).forEach((ln, i, arr) => {
        ctx.fillText(ln, w / 2, h / 2 - (arr.length - 1) * 20 + i * 40);
      });
      ctx.fillStyle = "#facc15";
      ctx.font = `bold 14px ${MONO}`;
      ctx.fillText("PRESS PLAY", w / 2, h / 2 + 70);
    }
    const lines = wrapLines(line.slice(0, 110), 54).slice(0, 2);
    const boxH = 24 + lines.length * 22;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(24, h - boxH - 24, w - 48, boxH + 10);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.strokeRect(24, h - boxH - 24, w - 48, boxH + 10);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold 15px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, h - boxH - 24 + 22 + i * 22);
    });
    ctx.restore();
    return;
  }

  // CARTOON_2D (default): cinematic title, narration subtitle, finale card
  ctx.save();
  if (globalT < 2.4) {
    const a = globalT < 0.4 ? globalT / 0.4 : globalT > 1.8 ? Math.max(0, 1 - (globalT - 1.8) / 0.6) : 1;
    ctx.globalAlpha = a;
    const title = plan.film.title.slice(0, 60);
    const tMid = title.length > 32 ? title.lastIndexOf(" ", 32) : -1;
    const titleLines = tMid > 0 ? [title.slice(0, tMid), title.slice(tMid + 1)] : [title];
    ctx.fillStyle = "rgba(2,6,23,0.55)";
    ctx.fillRect(0, h * 0.32 - (titleLines.length - 1) * 22, w, 44 + titleLines.length * 44);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    titleLines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, h * 0.32 + 22 + i * 38 - (titleLines.length - 1) * 11);
    });
    ctx.restore();
    ctx.save();
  }
  if (isFinale) {
    const title = finaleTitle;
    ctx.fillStyle = "rgba(2,6,23,0.55)";
    const a = Math.min(1, (3 - (plan.total - globalT)) * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillRect(0, h * 0.36, w, 84);
    ctx.fillStyle = "#fefce8";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title.slice(0, 44), w / 2, h * 0.36 + 42);
    ctx.restore();
    ctx.save();
  }
  const short = line.length > 120 ? `${line.slice(0, 117)}…` : line;
  const mid = short.length > 62 ? short.lastIndexOf(" ", 62) : -1;
  ctx.fillStyle = "rgba(2,6,23,0.72)";
  const lines = mid > 0 ? [short.slice(0, mid), short.slice(mid + 1)] : [short];
  const boxH = 30 + lines.length * 24;
  ctx.fillRect(0, h - boxH - 14, w, boxH + 14);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((ln, i) => {
    ctx.fillText(ln, w / 2, h - boxH - 14 + 24 + i * 24);
  });
  ctx.restore();
}
