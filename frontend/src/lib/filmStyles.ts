/**
 * Style system for the Animation Studio.
 *
 * The style selector is a GENERATION CONTROL, not a label: every style below
 * changes the actual rendered video — palette treatment, hero presence,
 * typography, transitions, motion feel, camera energy, and the soundtrack.
 * The recorder consumes these defs; nothing here is metadata-only.
 */

export type AnimStyle = "CARTOON_2D" | "MOTION_GRAPHICS" | "ECO_DOODLE" | "PIXEL_ART" | "INFOGRAPHIC";

export type StyleTransition = "dissolve" | "wipe" | "marker" | "pixels" | "slide";

export interface StyleAudio {
  /** Oscillator recipe for the music bed. */
  wave: OscillatorType;
  /** Seconds per chord (lower = more energetic). */
  chordSeconds: number;
  musicGain: number;
  sfxGain: number;
}

export interface StyleDef {
  id: AnimStyle;
  /** Accurate UI description of what the style actually does. */
  blurb: string;
  /** Rendered by the hero actor, or hidden for diagram-led styles. */
  showHero: boolean;
  /** Pixel-art post treatment (downscale/upscale + choppy time). */
  pixelate: boolean;
  /** Frames-per-second feel for the readout clock (pixel art = 12). */
  clockFps: number;
  /** Ink-duotone paper treatment (eco doodle). */
  inkDoodle: boolean;
  transition: StyleTransition;
  /** Camera energy multiplier (motion graphics pushes harder). */
  cameraEnergy: number;
  audio: StyleAudio;
}

export const FILM_STYLES: Record<AnimStyle, StyleDef> = {
  CARTOON_2D: {
    id: "CARTOON_2D",
    blurb: "Story-driven characters and animated environments",
    showHero: true,
    pixelate: false,
    clockFps: 30,
    inkDoodle: false,
    transition: "dissolve",
    cameraEnergy: 1,
    audio: { wave: "triangle", chordSeconds: 4, musicGain: 0.05, sfxGain: 1 },
  },
  MOTION_GRAPHICS: {
    id: "MOTION_GRAPHICS",
    blurb: "Kinetic text, shapes and visual explanations",
    showHero: false,
    pixelate: false,
    clockFps: 30,
    inkDoodle: false,
    transition: "wipe",
    cameraEnergy: 1.6,
    audio: { wave: "sawtooth", chordSeconds: 2.5, musicGain: 0.035, sfxGain: 0.9 },
  },
  ECO_DOODLE: {
    id: "ECO_DOODLE",
    blurb: "Hand-drawn ink storytelling on paper",
    showHero: true,
    pixelate: false,
    clockFps: 30,
    inkDoodle: true,
    transition: "marker",
    cameraEnergy: 0.8,
    audio: { wave: "triangle", chordSeconds: 5, musicGain: 0.035, sfxGain: 0.8 },
  },
  PIXEL_ART: {
    id: "PIXEL_ART",
    blurb: "Pixel characters and sprite-based animation",
    showHero: true,
    pixelate: true,
    clockFps: 12,
    inkDoodle: false,
    transition: "pixels",
    cameraEnergy: 1,
    audio: { wave: "square", chordSeconds: 2, musicGain: 0.028, sfxGain: 0.9 },
  },
  INFOGRAPHIC: {
    id: "INFOGRAPHIC",
    blurb: "Animated diagrams, facts and processes",
    showHero: false,
    pixelate: false,
    clockFps: 30,
    inkDoodle: false,
    transition: "slide",
    cameraEnergy: 0.7,
    audio: { wave: "sine", chordSeconds: 6, musicGain: 0.04, sfxGain: 0.7 },
  },
};

const VALID = new Set(Object.keys(FILM_STYLES));

/** Normalize any stored/unknown style to a real def (never crashes playback). */
export function styleDefFor(style: string | null | undefined): StyleDef {
  if (style && VALID.has(style)) return FILM_STYLES[style as AnimStyle];
  return FILM_STYLES.CARTOON_2D;
}
