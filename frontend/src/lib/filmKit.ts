/**
 * Shared kit for story films: continuous hero state, parallax camera,
 * particle systems, and common set pieces. Films compose these into
 * multi-beat mini-movies where the SAME world persists across beats.
 */
import {
  drawBird,
  drawCharacter,
  drawCloud,
  drawSun,
  type HeroPalette,
  HERO_PALETTE,
} from "./animationRenderer";
import type { SceneCamera } from "./types";

export interface HeroState {
  /** World x in screen-px space (persists across beats). */
  x: number;
  facing: 1 | -1;
  action: string;
  palette: HeroPalette;
  scale: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grav: number;
}

export interface FilmState {
  hero: HeroState;
  friend: HeroState;
  /** Smoothed camera world offset (px). Hero stays framed while world scrolls. */
  camX: number;
  green01: number;
  clean01: number;
  water01: number;
  power01: number;
  growth01: number;
  dayPhase: number;
  parts: Particle[];
  seed: number;
  scratch: Record<string, number>;
}

export interface BeatCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Seconds into the current beat. */
  t: number;
  /** Beat duration in seconds. */
  dur: number;
  /** Frame delta in seconds. */
  dt: number;
  /** 0..1 progress through the beat. */
  p: number;
  /** Global film time (ambient motion continuity). */
  time: number;
  film: FilmState;
  seed: number;
}

export interface FilmBeat {
  id: string;
  title: string;
  weight: number;
  camera: SceneCamera;
  narration: string;
  takeaway?: string;
  draw(c: BeatCtx): void;
}

export type FilmId = "forest" | "ocean" | "water" | "solar" | "wildlife" | "air" | "general";

export interface Film {
  id: FilmId;
  title: string;
  beats: FilmBeat[];
  createState(): FilmState;
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smoothstep easing. */
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** Progress of t within [a,b] mapped to 0..1 (clamped). */
export const phase = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(0.0001, b - a));
/** Deterministic pseudo-random from seed + index (stable across frames). */
export function rand(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createFilmState(seed = 7): FilmState {
  return {
    hero: { x: 120, facing: 1, action: "walk", palette: HERO_PALETTE, scale: 1.15 },
    friend: { x: -200, facing: 1, action: "walk", palette: HERO_PALETTE, scale: 1.1 },
    camX: 0,
    green01: 0,
    clean01: 0,
    water01: 0,
    power01: 0,
    growth01: 0,
    dayPhase: 0.3,
    parts: [],
    seed,
    scratch: {},
  };
}

// ---------------------------------------------------------------------------
// Camera: hero-anchored follow with smoothing. Screen x of a world x:
//   sx = wx - camX. Beats place the hero in world coords; the world scrolls.
// ---------------------------------------------------------------------------

export const WORLD_W = 1600;

export function updateFollowCam(film: FilmState, targetWorldX: number, anchorScreenX: number): number {
  const target = targetWorldX - anchorScreenX;
  film.camX += (target - film.camX) * 0.06;
  return film.camX;
}

/** Walk the hero toward a world x; returns true when arrived. */
export function walkHeroTo(hero: HeroState, targetX: number, dt: number, speed = 130): boolean {
  const dx = targetX - hero.x;
  if (Math.abs(dx) < 4) {
    hero.action = "stand";
    return true;
  }
  hero.facing = dx > 0 ? 1 : -1;
  hero.action = "walk";
  hero.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
  return false;
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

export function spawn(film: FilmState, p: Partial<Particle> & { x: number; y: number }): void {
  if (film.parts.length > 420) film.parts.splice(0, film.parts.length - 420);
  film.parts.push({
    vx: 0, vy: 0, life: 1, maxLife: 1, size: 3, color: "#ffffff", grav: 0,
    ...p,
  } as Particle);
}

export function stepParts(ctx: CanvasRenderingContext2D, film: FilmState, dt: number): void {
  const arr = film.parts;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    if (!p) continue;
    p.life -= dt;
    if (p.life <= 0) {
      arr.splice(i, 1);
      continue;
    }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Sky / ground / atmosphere set pieces
// ---------------------------------------------------------------------------

export interface SkyOpts {
  top: string;
  bottom: string;
  sunX?: number;
  sunY?: number;
  sunScale?: number;
  clouds?: number;
  heat?: number;
  ox?: number;
  seed?: number;
}

export function paintSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  horizonY: number,
  time: number,
  o: SkyOpts,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, horizonY * 1.15);
  grad.addColorStop(0, o.top);
  grad.addColorStop(1, o.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, horizonY * 1.15);
  drawSun(ctx, o.sunX ?? w * 0.82, o.sunY ?? h * 0.2, o.sunScale ?? 1.1, time);
  const n = o.clouds ?? 3;
  for (let i = 0; i < n; i++) {
    const drift = o.ox ? -o.ox * 0.12 : 0;
    drawCloud(ctx, w * (0.12 + 0.3 * i) + drift, h * (0.12 + 0.05 * (i % 2)), 0.8 + 0.25 * ((i + (o.seed ?? 0)) % 2), time, 12 + i * 4);
  }
  // Heat shimmer: rising translucent ribbons above the ground line
  if (o.heat && o.heat > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.16 * o.heat;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      const bx = ((i * 173 + time * 40) % (w + 120)) - 60;
      ctx.beginPath();
      for (let y = 0; y < 90; y += 12) {
        const x = bx + Math.sin(time * 3 + y * 0.09 + i) * 9;
        const yy = horizonY - 8 - y;
        if (y === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

export interface GroundOpts {
  y: number;
  color: string;
  dark?: string;
  ox?: number;
  tufts?: boolean;
  seed?: number;
}

/** Ground band with parallax-scrolling tufts/pebbles (proves camera motion). */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  o: GroundOpts,
): void {
  const grad = ctx.createLinearGradient(0, o.y, 0, h);
  grad.addColorStop(0, o.color);
  grad.addColorStop(1, o.dark ?? o.color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, o.y, w, h - o.y);
  // Horizon line
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, o.y, w, 3);
  if (o.tufts === false) return;
  const ox = o.ox ?? 0;
  const seed = o.seed ?? 3;
  // Scrolling detail layer: grass tufts + pebbles at 0.55 parallax
  for (let i = 0; i < 26; i++) {
    const wx = rand(seed, i) * (w + 800);
    const sx = ((wx - ox * 0.55) % (w + 200) + (w + 200)) % (w + 200) - 100;
    const sy = o.y + 14 + rand(seed, i + 50) * (h - o.y - 24);
    const sway = Math.sin(time * 1.8 + i * 1.3) * 2;
    if (i % 3 === 0) {
      ctx.strokeStyle = "rgba(21,128,61,0.75)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 3 + sway, sy - 9);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 3 + sway, sy - 11);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 4 + rand(seed, i + 90) * 5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Diagram-led styles (motion graphics, infographic) hide the protagonist so
 * the story is told by the world itself. Beats call the same draw functions —
 * this single flag reroutes them, so no beat needs style conditionals.
 */
let heroVisible = true;

export function setHeroVisible(visible: boolean): void {
  heroVisible = visible;
}

export function isHeroVisible(): boolean {
  return heroVisible;
}

/** Hero drawn at a world x with the follow camera applied. */
export function drawHeroWorld(
  ctx: CanvasRenderingContext2D,
  _film: FilmState,
  hero: HeroState,
  groundY: number,
  time: number,
  camX: number,
): void {
  if (!heroVisible) return;
  ctx.save();
  if (hero.facing < 0) {
    // Mirror horizontally around the hero position for leftward walking
    const sx = hero.x - camX;
    ctx.translate(sx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-sx, 0);
  }
  drawCharacter(ctx, hero.x - camX, groundY, hero.scale, time, hero.action, hero.palette);
  ctx.restore();
}

/** A second walker (friend) for finales. */
export function drawFriendWorld(
  ctx: CanvasRenderingContext2D,
  film: FilmState,
  groundY: number,
  time: number,
  camX: number,
): void {
  if (!heroVisible) return;
  const f = film.friend;
  drawHeroWorld(ctx, film, { ...f }, groundY, time, camX);
}

/** Flock helper: N birds crossing at various heights. */
export function paintFlock(
  ctx: CanvasRenderingContext2D,
  time: number,
  count: number,
  baseY: number,
  seed = 11,
): void {
  for (let i = 0; i < count; i++) {
    const x = 100 + rand(seed, i) * 900;
    const y = baseY + rand(seed, i + 30) * 90;
    drawBird(ctx, x, y, 0.8 + rand(seed, i + 60) * 0.5, time + i * 0.7);
  }
}
