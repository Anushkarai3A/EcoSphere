/**
 * Generative studio audio for the Animation Studio.
 *
 * No TTS provider or audio API keys exist in this project (Groq is text-only),
 * so voiceover is architecturally out of reach without a new provider. What IS
 * real here: a fully synthesized soundtrack — gentle ambient music bed plus
 * scene-matched effects (birds, water, wind) — rendered with the Web Audio API
 * and muxed into the recorded WebM as a genuine audio track.
 *
 * The module is provider-agnostic: it works against BaseAudioContext, so the
 * same graph can drive a live AudioContext (recording) or an
 * OfflineAudioContext (headless verification). Narration text remains the
 * per-scene subtitle track and is the seam where a future TTS voice slots in.
 */

import type { AnimationScene } from "./types";

export type SceneSfx = "birds" | "water" | "wind";

export interface SceneAudioCue {
  sfx: SceneSfx[];
}

/** Cue map for story films (one cue per beat, chosen per beat mood). */
const FILM_AUDIO_CUES: Record<string, SceneAudioCue[]> = {
  forest: [{ sfx: ["wind"] }, { sfx: ["wind"] }, { sfx: ["birds", "wind"] }, { sfx: ["birds", "wind"] }, { sfx: ["birds", "wind"] }, { sfx: ["birds", "wind"] }],
  ocean: [{ sfx: ["wind"] }, { sfx: ["water", "wind"] }, { sfx: ["water", "wind"] }, { sfx: ["water"] }, { sfx: ["water", "wind"] }, { sfx: ["water", "wind", "birds"] }],
  water: [{ sfx: ["water"] }, { sfx: ["water"] }, { sfx: ["water", "wind"] }, { sfx: ["water"] }, { sfx: ["birds", "wind", "water"] }],
  solar: [{ sfx: ["wind", "birds"] }, { sfx: ["wind"] }, { sfx: ["wind"] }, { sfx: ["wind", "birds"] }, { sfx: ["birds", "wind"] }],
  wildlife: [{ sfx: ["wind"] }, { sfx: ["wind", "birds"] }, { sfx: ["birds", "wind"] }, { sfx: ["birds"] }, { sfx: ["birds", "wind"] }],
  air: [{ sfx: ["wind"] }, { sfx: ["wind"] }, { sfx: ["wind", "birds"] }, { sfx: ["wind", "birds"] }, { sfx: ["birds", "wind"] }],
  general: [{ sfx: ["birds", "wind"] }, { sfx: ["wind"] }, { sfx: ["wind", "birds"] }, { sfx: ["birds", "wind"] }, { sfx: ["birds", "wind"] }],
};

/** Derive subtle effects for a story film's beats (falls back to general). */
export function planFilmAudio(filmId: string, beatCount: number): SceneAudioCue[] {
  const track = FILM_AUDIO_CUES[filmId] ?? FILM_AUDIO_CUES.general ?? [];
  const out: SceneAudioCue[] = [];
  for (let i = 0; i < beatCount; i++) {
    out.push(track[Math.min(i, track.length - 1)] ?? { sfx: ["wind"] });
  }
  return out;
}

/** Derive subtle effects from the storyboard's own elements. */
export function planSceneAudio(scenes: AnimationScene[]): SceneAudioCue[] {
  return scenes.map((scene) => {
    const types = new Set((scene.elements || []).map((el) => el.type));
    const sfx = new Set<SceneSfx>();
    if (["bird", "butterfly", "bee", "flower", "tree", "forest"].some((t) => types.has(t))) {
      sfx.add("birds");
    }
    if (["water", "ocean", "river", "fish", "whale", "turtle", "rain", "algae"].some((t) => types.has(t))) {
      sfx.add("water");
    }
    if (
      ["tree", "cloud", "wind_turbine", "leaf", "sapling", "bird", "solar_panel"].some((t) => types.has(t)) ||
      sfx.size === 0
    ) {
      sfx.add("wind");
    }
    return { sfx: [...sfx] };
  });
}

// C – F – G – Am progression (Hz), warm and uplifting, loops for the duration.
const CHORDS: number[][] = [
  [130.81, 164.81, 196.0], // C3 E3 G3
  [174.61, 220.0, 261.63], // F3 A3 C4
  [196.0, 246.94, 293.66], // G3 B3 D4
  [110.0, 164.81, 261.63], // A2 E3 C4
];
const CHORD_SECONDS = 4;

function makeNoiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export interface StudioAudioStyle {
  wave: OscillatorType;
  chordSeconds: number;
  musicGain: number;
  sfxGain: number;
}

const DEFAULT_AUDIO_STYLE: StudioAudioStyle = {
  wave: "triangle",
  chordSeconds: CHORD_SECONDS,
  musicGain: 0.05,
  sfxGain: 1,
};

/** Start music + scheduled scene effects. Returns a stop function. */
export function startStudioAudio(
  ctx: BaseAudioContext,
  destination: AudioNode,
  totalSeconds: number,
  cues: SceneAudioCue[],
  sceneBounds: number[],
  style?: Partial<StudioAudioStyle>,
): () => void {
  const t0 = ctx.currentTime;
  const endAt = t0 + totalSeconds;
  const st: StudioAudioStyle = { ...DEFAULT_AUDIO_STYLE, ...style };
  const liveNodes: AudioNode[] = [];
  const track = (node: AudioNode) => {
    liveNodes.push(node);
    return node;
  };

  // ---- Music bed: soft pad chords, deliberately quiet under voiceover ----
  const musicGain = ctx.createGain();
  musicGain.gain.value = st.musicGain;
  musicGain.connect(destination);
  track(musicGain);
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = st.wave === "square" ? 2400 : 900;
  padFilter.connect(musicGain);
  track(padFilter);

  const chordCount = Math.ceil(totalSeconds / st.chordSeconds);
  for (let c = 0; c < chordCount; c++) {
    const chord = CHORDS[c % CHORDS.length];
    if (!chord) continue;
    const start = t0 + c * st.chordSeconds;
    const stop = Math.min(start + st.chordSeconds + 0.6, endAt + 0.5);
    for (const freq of chord) {
      const osc = ctx.createOscillator();
      osc.type = st.wave;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.33, start + Math.min(1.2, st.chordSeconds / 2));
      g.gain.setValueAtTime(0.33, Math.max(start + 0.1, stop - 0.8));
      g.gain.linearRampToValueAtTime(0, stop);
      osc.connect(g);
      g.connect(padFilter);
      osc.start(start);
      osc.stop(stop);
      track(osc);
      track(g);
    }
    // Pixel-art bounce: pentatonic blips over each chord (chip feel)
    if (st.wave === "square") {
      const arp = [523.25, 587.33, 659.25, 783.99, 880.0];
      for (let s = 0; s < 4; s++) {
        const at = start + s * (st.chordSeconds / 4);
        if (at >= endAt) break;
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = arp[(c * 4 + s) % arp.length] ?? 523.25;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(at);
        osc.stop(at + 0.3);
        track(osc);
        track(g);
      }
    }
  }

  const noiseBuffer = makeNoiseBuffer(ctx);

  // ---- Water: band-passed noise with a slow tremolo (streams/rivers/ocean) --
  const waterScenes = cues
    .map((cue, i) => ({ cue, i }))
    .filter(({ cue }) => cue.sfx.includes("water"));
  for (const { i } of waterScenes) {
    const start = t0 + (i === 0 ? 0 : (sceneBounds[i - 1] ?? 0));
    const stop = t0 + (sceneBounds[i] ?? totalSeconds);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 750;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.045 * st.sfxGain;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(bp);
    bp.connect(g);
    g.connect(destination);
    src.start(start);
    src.stop(stop);
    lfo.start(start);
    lfo.stop(stop);
    track(src);
    track(lfo);
  }

  // ---- Wind: low-passed noise swells ----------------------------------------
  const windScenes = cues
    .map((cue, i) => ({ cue, i }))
    .filter(({ cue }) => cue.sfx.includes("wind"));
  for (const { i } of windScenes) {
    const start = t0 + (i === 0 ? 0 : (sceneBounds[i - 1] ?? 0));
    const stop = t0 + (sceneBounds[i] ?? totalSeconds);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.035 * st.sfxGain, start + 1.5);
    g.gain.setValueAtTime(0.035 * st.sfxGain, stop - 1);
    g.gain.linearRampToValueAtTime(0.0001, stop);
    src.connect(lp);
    lp.connect(g);
    g.connect(destination);
    src.start(start);
    src.stop(stop);
    track(src);
  }

  // ---- Birds: short FM chirp blips scattered through matching scenes --------
  const birdScenes = cues
    .map((cue, i) => ({ cue, i }))
    .filter(({ cue }) => cue.sfx.includes("birds"));
  for (const { i } of birdScenes) {
    const start = t0 + (i === 0 ? 0 : (sceneBounds[i - 1] ?? 0));
    const stop = t0 + (sceneBounds[i] ?? totalSeconds);
    for (let t = start + 0.6; t < stop - 0.4; t += 1.7) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const base = 2400 + ((t * 7919) % 1200);
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.09);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06 * st.sfxGain, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g);
      g.connect(destination);
      osc.start(t);
      osc.stop(t + 0.3);
      track(osc);
      track(g);
    }
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    for (const node of liveNodes) {
      try {
        (node as OscillatorNode).stop?.();
      } catch {
        // already stopped
      }
      try {
        node.disconnect();
      } catch {
        // already disconnected
      }
    }
  };
}
