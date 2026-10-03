import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Download,
  Film,
  History,
  Leaf,
  Loader2,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, studentApi } from "@/lib/api";
import { setHeroVisible } from "@/lib/filmKit";
import { styleDefFor } from "@/lib/filmStyles";
import { planFilmAudio, startStudioAudio } from "@/lib/studioAudio";
import { FILMS } from "@/lib/storyFilms";
import { compositeStyledWorld, paintStyleTransition } from "@/lib/styleRender";
import type { GenerateAnimationInput, StudentAnimation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

type PipelineStep =
  | "idle"
  | "classifying"
  | "storyboard"
  | "voice"
  | "composing"
  | "rendering"
  | "uploading"
  | "ready";

const QUICK_PROMPTS = [
  "Plastic waste reaching the ocean",
  "Why should we plant more trees?",
  "Saving water at home and school",
  "How does solar energy work?",
  "Protecting tigers and wildlife",
  "What causes air pollution?",
];

const STYLE_OPTIONS: { value: GenerateAnimationInput["style"]; label: string; blurb: string }[] = [
  { value: "CARTOON_2D", label: "Cartoon 2D", blurb: "Story-driven characters and animated environments" },
  { value: "MOTION_GRAPHICS", label: "Motion Graphics", blurb: "Kinetic text, shapes and visual explanations" },
  { value: "ECO_DOODLE", label: "Eco Doodle", blurb: "Hand-drawn ink storytelling on paper" },
  { value: "PIXEL_ART", label: "Pixel Art", blurb: "Pixel characters and sprite-based animation" },
  { value: "INFOGRAPHIC", label: "Infographic", blurb: "Animated diagrams, facts and processes" },
];

const DURATION_OPTIONS = [30, 45, 60, 90];

let messageId = 0;
const nextId = () => ++messageId;

export function AnimationStudioPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: "assistant",
      text: "Hi! I am the Eco Animator. Enter any environmental topic — like plastic pollution, deforestation, saving water, clean energy, or wildlife — and I will generate an actual animated video for you.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<GenerateAnimationInput["style"]>("CARTOON_2D");
  const [duration, setDuration] = useState(90);
  const [generating, setGenerating] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [renderProgress, setRenderProgress] = useState<{ elapsed: number; total: number } | null>(null);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<StudentAnimation[]>([]);
  const [current, setCurrent] = useState<StudentAnimation | null>(null);

  // Video player states (video element metadata is the source of truth)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const finiteDuration = Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : 0;

  // Hidden offscreen canvas for rendering frames & capturing stream
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Reused scratch canvases: film world, styled preview, pixel work buffer
  const dissolveRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<HTMLCanvasElement | null>(null);
  const styleRef = useRef<HTMLCanvasElement | null>(null);
  const pixelRef = useRef<HTMLCanvasElement | null>(null);
  const TRANSITION_SECONDS = 0.7;

  const getScratch = (ref: React.MutableRefObject<HTMLCanvasElement | null>): CanvasRenderingContext2D | null => {
    const c = ref.current ?? document.createElement("canvas");
    ref.current = c;
    c.width = 960;
    c.height = 540;
    return c.getContext("2d");
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const { items } = await studentApi.listAnimations();
      setHistory(items);
      // Auto-select first ready video on first load only
      setCurrent((prev) => {
        if (prev || items.length === 0) return prev;
        return items.find((it) => it.videoUrl) || items[0] || null;
      });
    } catch {
      // History is non-blocking
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generating, pipelineStep]);

  // Handle video element timeupdate & state
  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    if (Number.isFinite(videoRef.current.currentTime)) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const onDurationChange = () => {
    const v = videoRef.current;
    if (!v) return;
    if (Number.isFinite(v.duration) && v.duration > 0) {
      setVideoDuration(v.duration);
    }
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (Number.isFinite(v.duration) && v.duration > 0) {
      setVideoDuration(v.duration);
      return;
    }
    // MediaRecorder-encoded WebM reports duration Infinity until probed.
    // Seek far ahead once: the browser resolves the true duration, then we
    // seek back. No constants are displayed — metadata stays authoritative.
    const onSeeked = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        setVideoDuration(v.duration);
      }
      try {
        v.currentTime = 0;
      } catch {
        // ignore
      }
      v.removeEventListener("seeked", onSeeked);
    };
    v.addEventListener("seeked", onSeeked);
    try {
      v.currentTime = Number.MAX_SAFE_INTEGER;
    } catch {
      v.removeEventListener("seeked", onSeeked);
    }
  };

  const onEnded = () => {
    const v = videoRef.current;
    setIsPlaying(false);
    setHasEnded(true);
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      setCurrentTime(v.duration);
    }
  };

  const onVideoError = () => {
    setIsPlaying(false);
    setVideoError("This video file could not be played. It may be corrupted or still processing.");
    if (current && !current.videoUrl) return;
    if (current) {
      // Persist the failure honestly so the row never pretends to be ready.
      studentApi.failAnimation(current.id, "Saved video file could not be played.").catch(() => {});
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
      return;
    }
    if (hasEnded) {
      try {
        v.currentTime = 0;
      } catch {
        // ignore
      }
      setCurrentTime(0);
      setHasEnded(false);
    }
    void v
      .play()
      .then(() => {
        setIsPlaying(true);
        setHasEnded(false);
      })
      .catch(() => {});
  };

  const handleSeek = (time: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(time)) return;
    v.currentTime = time;
    setCurrentTime(time);
    setHasEnded(false);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void videoRef.current.requestFullscreen();
    }
  };

  /**
   * Story-film recording pipeline (the main path).
   *
   * Plays a hand-built story film (continuous world, scripted action beats)
   * in real time on canvas while MediaRecorder captures video + a mixed audio
   * track (generative music/SFX, plus TTS voiceover when available). Includes:
   * - style-specific visual language + transitions (never a shared slideshow),
   * - a motion quality gate (rejects near-static output instead of READY),
   * - track assertions (video AND audio streams must exist),
   * - a stall watchdog (hidden-tab rAF freeze fails loudly, never hangs).
   * Throws a descriptive Error on any failure (never a silent fake result).
   */
  const renderAndRecordFilm = async (
    animation: StudentAnimation,
    voice: { buffers: (AudioBuffer | null)[]; notice: string | null },
  ): Promise<{ videoUrl: string | null; thumbnailUrl: string | null; voiceUsed: boolean }> => {
    const { planFilm, drawFilmFrame, renderBeatPreview, drawFilmOverlay, FILMS } = await import(
      "@/lib/storyFilms"
    );
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Animation canvas is not available in this browser.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not supported in this browser.");
    if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
      throw new Error("Video recording is not supported in this browser. Please use Chrome or Edge.");
    }

    const filmId = animation.scenes[0]?.film;
    const film = (filmId && FILMS[filmId as keyof typeof FILMS]) || null;
    if (!film) throw new Error("Storyboard has no story film to play.");
    // The style selector drives the actual render (never just a label)
    const styleDef = styleDefFor(animation.style);
    const styleId = styleDef.id;

    const totalSeconds = Math.max(15, Math.min(animation.durationSeconds || 60, 90));
    const rowNarrations = animation.scenes.map((s) => s.narration || "");
    let plan = planFilm(film, totalSeconds, rowNarrations);
    plan = { ...plan, film: { ...plan.film, title: animation.topic || plan.film.title } };

    // Voice re-timing: stretch beats that need more room for their line
    const voiceDurs = voice.buffers.map((b) => (b ? b.duration : null));
    {
      const bounds: number[] = [];
      let acc = 0;
      plan.bounds.forEach((b, i) => {
        const prev = i === 0 ? 0 : (plan.bounds[i - 1] ?? 0);
        const need = voiceDurs[i] != null ? (voiceDurs[i] as number) + 1.2 : 0;
        acc += Math.max(b - prev, need);
        bounds.push(acc);
      });
      plan = { ...plan, bounds, total: acc };
    }
    const total = plan.total;

    canvas.width = 960;
    canvas.height = 540;

    const audioCtx = new AudioContext();
    try {
      await audioCtx.resume();
    } catch {
      // proceed; scheduled nodes still render once running
    }
    const audioDest = audioCtx.createMediaStreamDestination();
    const stopStudioAudio = startStudioAudio(
      audioCtx,
      audioDest,
      total,
      planFilmAudio(film.id, film.beats.length),
      plan.bounds,
      styleDef.audio,
    );

    // Voiceover sources, one per beat, starting exactly on beat boundaries
    const t0 = audioCtx.currentTime + 0.1;
    voice.buffers.forEach((buf, i) => {
      if (!buf) return;
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const g = audioCtx.createGain();
      g.gain.value = 1.0;
      src.connect(g);
      g.connect(audioDest);
      src.start(t0 + (i === 0 ? 0 : (plan.bounds[i - 1] ?? 0)));
    });

    const canvasStream = canvas.captureStream(30);
    const mixedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);
    if (mixedStream.getVideoTracks().length === 0) {
      throw new Error("Could not capture video from the animation canvas.");
    }
    if (mixedStream.getAudioTracks().length === 0) {
      throw new Error("Could not capture the soundtrack (no audio track). Please try again.");
    }
    const mimeTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const selectedMime = mimeTypes.find((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    });
    // eslint-disable-next-line no-console
    console.debug(
      `[studio] film=${film.id} style=${styleId} record mime pick: ${selectedMime || "(platform default)"} ` +
        `videoTracks=${mixedStream.getVideoTracks().length} audioTracks=${mixedStream.getAudioTracks().length}`,
    );
    const recorder = selectedMime
      ? new MediaRecorder(mixedStream, {
          mimeType: selectedMime,
          videoBitsPerSecond: 2_500_000,
          audioBitsPerSecond: 96_000,
        })
      : new MediaRecorder(mixedStream);
    const recordedChunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    };
    const recorderStopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    let poster: Blob | null = null;
    const state = film.createState();
    const world = worldRef.current ?? document.createElement("canvas");
    worldRef.current = world;
    world.width = 960;
    world.height = 540;
    const wctx = world.getContext("2d");
    if (!wctx) throw new Error("Animation canvas is not available in this browser.");
    setHeroVisible(styleDef.showHero);
    recorder.start(500);

    // Motion quality gate: downsampled frame differencing (static output fails)
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 96;
    sampleCanvas.height = 54;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    let prevSample: Uint8ClampedArray | null = null;
    let motionAcc = 0;
    let motionN = 0;

    try {
      await new Promise<void>((resolve, reject) => {
        const wallStart = Date.now();
        const startStamp = performance.now();
        let pausedTotal = 0;
        let pauseStart: number | null = null;
        let posterTaken = false;
        let lastShownSecond = -1;
        let framesDrawn = 0;
        let settled = false;
        let lastFrameWall = Date.now();
        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          clearInterval(watchdog);
          document.removeEventListener("visibilitychange", onVisibility);
          setHeroVisible(true);
          if (err) reject(err);
          else resolve();
        };
        // Stall watchdog: hidden tabs freeze rAF — fail loudly, never hang
        const watchdog = setInterval(() => {
          if (Date.now() - lastFrameWall > 20000) {
            finish(new Error("Rendering stalled (the tab may be hidden). Please keep this tab visible and retry."));
          }
        }, 2000);
        const onVisibility = () => {
          if (document.hidden) {
            if (pauseStart === null) {
              pauseStart = performance.now();
              try {
                if (recorder.state === "recording") recorder.pause();
              } catch {
                // ignore pause errors; clock adjustment still applies
              }
              try {
                void audioCtx.suspend();
              } catch {
                // ignore
              }
            }
          } else if (pauseStart !== null) {
            pausedTotal += performance.now() - pauseStart;
            pauseStart = null;
            try {
              if (recorder.state === "paused") recorder.resume();
            } catch {
              // ignore resume errors
            }
            try {
              void audioCtx.resume();
            } catch {
              // ignore
            }
          }
        };
        document.addEventListener("visibilitychange", onVisibility);

        const frame = (now: number) => {
          try {
            framesDrawn++;
            lastFrameWall = Date.now();
            const elapsed = (now - startStamp - pausedTotal) / 1000;
            // Pixel-art time quantization: choppy 12fps sprite feel, real behavior
            const tDraw = styleDef.pixelate ? Math.floor(elapsed * styleDef.clockFps) / styleDef.clockFps : elapsed;
            const { beatIndex } = drawFilmFrame(wctx, 960, 540, plan, state, tDraw);
            const pixelScratch = pixelRef.current ?? document.createElement("canvas");
            pixelRef.current = pixelScratch;
            compositeStyledWorld(ctx, world, styleId, pixelScratch);
            // Style-specific transition into the next beat over the last stretch
            const sceneEnd = plan.bounds[beatIndex] ?? total;
            const timeLeft = sceneEnd - elapsed;
            const hasNext = beatIndex + 1 < film.beats.length;
            if (hasNext && timeLeft < TRANSITION_SECONDS && timeLeft > 0) {
              const off = dissolveRef.current ?? document.createElement("canvas");
              dissolveRef.current = off;
              off.width = 960;
              off.height = 540;
              const octx = off.getContext("2d");
              const styled = getScratch(styleRef);
              if (octx && styled) {
                renderBeatPreview(octx, 960, 540, plan, state, beatIndex + 1, tDraw);
                compositeStyledWorld(styled, off, styleId, pixelScratch);
                const styledCanvas = styleRef.current;
                if (styledCanvas) {
                  paintStyleTransition(ctx, styledCanvas, styleId, 1 - timeLeft / TRANSITION_SECONDS, 960, 540);
                }
              }
            }
            drawFilmOverlay(ctx, 960, 540, plan, beatIndex, elapsed, styleId);
            // Motion gate sampling (every 30th frame, downsampled)
            if (sampleCtx && framesDrawn % 30 === 0) {
              sampleCtx.drawImage(canvas, 0, 0, 96, 54);
              const d = sampleCtx.getImageData(0, 0, 96, 54).data;
              if (prevSample) {
                let diff = 0;
                for (let i = 0; i < d.length; i += 12) {
                  diff += Math.abs(d[i]! - prevSample[i]!) + Math.abs(d[i + 1]! - prevSample[i + 1]!) + Math.abs(d[i + 2]! - prevSample[i + 2]!);
                }
                motionAcc += diff / (d.length / 12);
                motionN++;
              }
              prevSample = new Uint8ClampedArray(d);
            }
            if (!posterTaken && elapsed > 1.2) {
              posterTaken = true;
              canvas.toBlob(
                (b) => {
                  if (b) poster = b;
                },
                "image/jpeg",
                0.72,
              );
            }
            const wholeSecond = Math.floor(Math.min(elapsed, total));
            if (wholeSecond !== lastShownSecond) {
              lastShownSecond = wholeSecond;
              setRenderProgress({ elapsed: wholeSecond, total });
            }
            if (elapsed >= total) {
              // eslint-disable-next-line no-console
              console.debug(
                `[studio] film record done: film=${film.id} style=${styleId} anim=${total.toFixed(1)}s wall=${((Date.now() - wallStart) / 1000).toFixed(1)}s frames=${framesDrawn} motion=${motionN > 0 ? (motionAcc / motionN).toFixed(2) : "n/a"}`,
              );
              finish();
              return;
            }
            requestAnimationFrame(frame);
          } catch (err) {
            finish(err instanceof Error ? err : new Error("Frame rendering failed."));
          }
        };
        requestAnimationFrame(frame);
      });
    } finally {
      if (recorder.state !== "inactive") recorder.stop();
      stopStudioAudio();
      setHeroVisible(true);
    }
    await recorderStopped;
    try {
      await audioCtx.close();
    } catch {
      // already closed
    }

    // QUALITY GATE: reject near-static output instead of marking it READY
    const meanMotion = motionN > 0 ? motionAcc / motionN : 0;
    if (motionN < 3 || meanMotion < 0.4) {
      throw new Error(
        `Quality gate rejected the recording (motion score ${meanMotion.toFixed(2)} — the animation looked static). Please try again.`,
      );
    }

    const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
    // eslint-disable-next-line no-console
    console.debug(
      `[studio] recorded blob: type=${videoBlob.type} size=${videoBlob.size} chunks=${recordedChunks.length} recorderMime=${recorder.mimeType} motion=${meanMotion.toFixed(2)}`,
    );
    if (videoBlob.size === 0) {
      throw new Error("Recording produced an empty video file. Please try again and keep this tab visible.");
    }

    setPipelineStep("uploading");
    try {
      const { animation: updated } = await studentApi.uploadAnimationVideo(
        animation.id,
        videoBlob,
        `eco_video_${animation.id}.webm`,
        poster ?? undefined,
        `eco_poster_${animation.id}.jpg`,
      );
      if (!updated.videoUrl) throw new Error("Server did not return a video URL after upload.");
      return { videoUrl: updated.videoUrl, thumbnailUrl: updated.thumbnailUrl ?? null, voiceUsed: voice.buffers.some(Boolean) };
    } catch (uploadErr) {
      throw new Error(
        uploadErr instanceof Error ? `Video upload failed: ${uploadErr.message}` : "Video upload failed.",
      );
    }
  };

  /**
   * Fetch + decode per-beat narration audio. NEVER throws: any failure yields
   * { buffers: [], notice } so the film records with music/SFX and an honest
   * notice instead of a fabricated voice track.
   */
  const prepareVoiceover = async (
    animation: StudentAnimation,
  ): Promise<{ buffers: (AudioBuffer | null)[]; notice: string | null }> => {
    const lines = animation.scenes.map((s) => (s.narration || "").trim());
    if (lines.every((l) => l.length === 0)) {
      return { buffers: [], notice: null };
    }
    // One shared AudioContext for decoding (closed after use)
    let decodeCtx: AudioContext | null = null;
    try {
      decodeCtx = new AudioContext();
    } catch {
      return { buffers: [], notice: "Voiceover unavailable in this browser — music and effects included." };
    }
    const buffers: (AudioBuffer | null)[] = [];
    let notice: string | null = null;
    for (const line of lines) {
      if (line.length === 0) {
        buffers.push(null);
        continue;
      }
      try {
        const blob = await studentApi.fetchNarrationAudio(line.slice(0, 600));
        const bytes = await blob.arrayBuffer();
        const decoded = await decodeCtx.decodeAudioData(bytes);
        buffers.push(decoded);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Voice service error";
        notice = msg.includes("terms")
          ? "Voiceover unavailable: the Groq TTS terms are not accepted yet — music and effects included."
          : `Voiceover unavailable (${msg}) — music and effects included.`;
        break;
      }
    }
    try {
      await decodeCtx.close();
    } catch {
      // ignore
    }
    // If every line failed, drop voice entirely (single honest notice)
    if (buffers.length > 0 && buffers.every((b) => b === null)) {
      return { buffers: [], notice };
    }
    return { buffers, notice };
  };

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || generating) return;

    setError(null);
    setRenderProgress(null);
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setPrompt("");
    setGenerating(true);

    // The storyboard row id, so failures can be marked FAILED (never fake-ready).
    let animationId: string | null = null;

    try {
      // Step 1: Topic classification
      setPipelineStep("classifying");

      // Step 2: Groq film director — picks the story film + per-beat narration
      setPipelineStep("storyboard");
      const { animation } = await studentApi.generateAnimation({
        prompt: text,
        ...(topic.trim() ? { topic: topic.trim() } : {}),
        durationSeconds: duration,
        style,
      });
      animationId = animation.id;
      setCurrent({ ...animation, status: "RENDERING" });

      // Step 3: Voiceover — synthesize each beat's narration line.
      // Any failure degrades HONESTLY to music/SFX (never a fake voice track).
      setPipelineStep("voice");
      const voice = await prepareVoiceover(animation);

      // Step 4: Composing the film world
      setPipelineStep("composing");
      await new Promise((r) => setTimeout(r, 600));

      // Step 5: Real-time film recording + muxed soundtrack.
      // This takes ~`duration` seconds of wall-clock time.
      setPipelineStep("rendering");
      const { videoUrl, thumbnailUrl, voiceUsed } = await renderAndRecordFilm(animation, voice);

      // Step 6: Ready — only after a real video file exists on the server.
      setPipelineStep("ready");
      const readyAnimation: StudentAnimation = {
        ...animation,
        videoUrl,
        thumbnailUrl: thumbnailUrl ?? animation.thumbnailUrl,
        status: "READY",
      };
      setCurrent(readyAnimation);

      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text:
            `Your video "${readyAnimation.topic ?? "Our Planet"}" is ready — ` +
            `${readyAnimation.scenes.length} story beats, ${readyAnimation.durationSeconds}s` +
            (voiceUsed ? ", with voiceover narration." : ", with music and sound effects.") +
            (voice.notice ? ` Note: ${voice.notice}` : "") +
            ` Watch it in the player!`,
        },
      ]);

      void loadHistory();
    } catch (err) {
      if (err instanceof ApiError && err.code === "ANIMATION_OFF_TOPIC") {
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: err.message }]);
      } else {
        const reason =
          err instanceof ApiError && err.status === 429
            ? "Daily generation limit reached (15 videos). Please try again tomorrow."
            : err instanceof Error
              ? err.message
              : "Could not generate the animation video. Please try again.";
        // Persist the failure so the row never pretends to be ready.
        if (animationId) {
          try {
            await studentApi.failAnimation(animationId, reason);
          } catch {
            // reporting the failure failed; surface the original reason only
          }
          void loadHistory();
        }
        setError(reason);
      }
      setPipelineStep("idle");
    } finally {
      setGenerating(false);
      setRenderProgress(null);
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await studentApi.deleteAnimation(id);
      setHistory((prev) => {
        const next = prev.filter((item) => item.id !== id);
        setCurrent((cur) => (cur?.id === id ? next.find((it) => it.videoUrl) || next[0] || null : cur));
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? `Could not delete the video: ${err.message}` : "Could not delete the video.");
    }
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return "--:--";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Reset player state whenever a different video is selected
  useEffect(() => {
    setCurrentTime(0);
    setVideoDuration(0);
    setIsPlaying(false);
    setHasEnded(false);
    setVideoError(null);
  }, [current?.id]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-12">
      {/* Hidden high-res canvas used for offscreen frame rendering & stream capture */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <section className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Film className="h-6 w-6 text-emerald-500" aria-hidden />
          AI Animation Studio
        </h1>
        <p className="text-sm text-muted-foreground">
          Turn your environmental questions and ideas into real animated educational videos.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Chatbot & Generation Settings */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="flex min-h-[580px] flex-col shadow-sm border-border">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="h-4 w-4 text-emerald-500" aria-hidden />
                Eco Animator AI
              </CardTitle>
              <CardDescription>Creates educational animated videos about ecology.</CardDescription>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              {/* Chat Message Stream */}
              <div className="flex max-h-[300px] min-h-[220px] flex-1 flex-col gap-2.5 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-3.5">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-xs",
                        m.role === "user"
                          ? "bg-emerald-600 text-white font-medium"
                          : "border border-border/70 bg-card text-foreground",
                      )}
                    >
                      {m.role === "assistant" && (
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Leaf className="h-3.5 w-3.5" aria-hidden /> Eco Animator
                        </p>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                ))}

                {generating && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground shadow-xs">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" aria-hidden />
                      <span>
                        {pipelineStep === "classifying" && "Evaluating environmental context…"}
                        {pipelineStep === "storyboard" && "Groq AI writing your story…"}
                        {pipelineStep === "voice" && "Generating narration voiceover…"}
                        {pipelineStep === "composing" && "Preparing characters and film world…"}
                        {pipelineStep === "rendering" &&
                          (renderProgress
                            ? `Recording animation… ${renderProgress.elapsed}s / ${renderProgress.total}s`
                            : "Rendering animation frames into WebM…")}
                        {pipelineStep === "uploading" && "Encoding and saving video…"}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPrompt(q)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-emerald-500/50 hover:text-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Prompt & Config Form */}
              <p className="text-[11px] text-muted-foreground" aria-live="polite">
                {STYLE_OPTIONS.find((o) => o.value === style)?.blurb}
              </p>
              <form onSubmit={onSend} className="flex flex-col gap-3 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 space-y-1">
                    <Label htmlFor="anim-topic" className="text-xs text-muted-foreground">Topic</Label>
                    <Input
                      id="anim-topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. Oceans"
                      maxLength={100}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="anim-style" className="text-xs text-muted-foreground">Style</Label>
                    <select
                      id="anim-style"
                      value={style}
                      onChange={(e) => setStyle(e.target.value as GenerateAnimationInput["style"])}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {STYLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="anim-duration" className="text-xs text-muted-foreground">Duration</Label>
                    <select
                      id="anim-duration"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {DURATION_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d}s</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter an environmental topic (e.g. Plastic waste reaching ocean)…"
                    maxLength={1000}
                    aria-label="Video prompt"
                    className="h-10 text-sm"
                  />
                  <Button
                    type="submit"
                    disabled={generating || prompt.trim().length === 0}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1.5" aria-hidden />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Actual HTML5 Video Player + Progress Stepper + Library */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Main Video Screen Card */}
          <Card className="overflow-hidden border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Clapperboard className="h-4 w-4 text-emerald-500" aria-hidden />
                  {current?.topic || "Animated Video Player"}
                </CardTitle>
                {current && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {current.videoUrl ? "Generated Video" : "Ready"}
                  </span>
                )}
              </div>
              <CardDescription>
                {current
                  ? `${current.scenes.length} animated scenes • ${current.durationSeconds}s duration • ${current.style || "Cartoon 2D"}`
                  : "Type an eco prompt in the chat to generate and watch your video."}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 flex flex-col gap-4">
              {/* Stepper active during generation */}
              {generating && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 animate-spin text-emerald-500" />
                      AI Video Pipeline Active
                    </span>
                    <span className="capitalize">{pipelineStep}</span>
                  </div>

                  <div className="grid grid-cols-5 gap-2 pt-1">
                    <div className={cn("flex flex-col gap-1 rounded-md p-2 text-center text-[11px]", pipelineStep === "classifying" ? "bg-emerald-500/20 font-bold" : "bg-muted/40 text-muted-foreground")}>
                      <span>1. Topic</span>
                      <span className="text-[9px]">Validation</span>
                    </div>
                    <div className={cn("flex flex-col gap-1 rounded-md p-2 text-center text-[11px]", pipelineStep === "storyboard" ? "bg-emerald-500/20 font-bold" : "bg-muted/40 text-muted-foreground")}>
                      <span>2. Story</span>
                      <span className="text-[9px]">Groq LLM</span>
                    </div>
                    <div className={cn("flex flex-col gap-1 rounded-md p-2 text-center text-[11px]", pipelineStep === "voice" ? "bg-emerald-500/20 font-bold" : "bg-muted/40 text-muted-foreground")}>
                      <span>3. Voice</span>
                      <span className="text-[9px]">Narration</span>
                    </div>
                    <div className={cn("flex flex-col gap-1 rounded-md p-2 text-center text-[11px]", pipelineStep === "rendering" || pipelineStep === "composing" ? "bg-emerald-500/20 font-bold" : "bg-muted/40 text-muted-foreground")}>
                      <span>4. Filming</span>
                      <span className="text-[9px]">
                        {renderProgress ? `${renderProgress.elapsed}s / ${renderProgress.total}s` : "Live render"}
                      </span>
                    </div>
                    <div className={cn("flex flex-col gap-1 rounded-md p-2 text-center text-[11px]", pipelineStep === "uploading" ? "bg-emerald-500/20 font-bold" : "bg-muted/40 text-muted-foreground")}>
                      <span>5. Video</span>
                      <span className="text-[9px]">WebM File</span>
                    </div>
                  </div>
                  {pipelineStep === "rendering" && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Recording your video in real time — please keep this tab visible until rendering finishes.
                    </p>
                  )}
                </div>
              )}

              {/* Video Player Display Container */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
                {current?.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={current.videoUrl}
                    onTimeUpdate={onTimeUpdate}
                    onDurationChange={onDurationChange}
                    onLoadedMetadata={onLoadedMetadata}
                    onEnded={onEnded}
                    onPlay={() => {
                      setIsPlaying(true);
                      setHasEnded(false);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onError={onVideoError}
                    className="h-full w-full object-contain"
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-6 text-center text-muted-foreground">
                    <div className="rounded-full bg-slate-900 p-4 border border-slate-800">
                      <Film className="h-8 w-8 text-slate-600" aria-hidden />
                    </div>
                    <div>
                      <p className="font-medium text-slate-300">No animation selected</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Use the chat to create your video. The AI will render moving visuals and characters.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video load failure */}
              {videoError && current?.videoUrl && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {videoError}
                </p>
              )}

              {/* Video Controls Bar */}
              {current?.videoUrl && !videoError && (
                <div className="flex flex-col gap-2 rounded-xl bg-muted/30 border border-border/60 p-3">
                  {/* Timeline Scrubber (percentage only from finite metadata) */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                      {formatTime(currentTime)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={finiteDuration > 0 ? finiteDuration : 0}
                      step={0.1}
                      value={finiteDuration > 0 ? Math.min(currentTime, finiteDuration) : 0}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      disabled={finiteDuration === 0}
                      aria-label="Seek"
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-border accent-emerald-500 disabled:cursor-wait"
                    />
                    <span className="text-xs font-mono text-muted-foreground w-12">
                      {formatTime(finiteDuration)}
                    </span>
                  </div>

                  {/* Playback Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={togglePlay}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4 mr-1.5" />
                        ) : (
                          <Play className="h-4 w-4 mr-1.5" />
                        )}
                        {isPlaying ? "Pause" : hasEnded ? "Replay" : "Play"}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSeek(0)}
                        className="h-8 px-2.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restart
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={toggleMute}
                        className="h-8 px-2 text-muted-foreground"
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={current.videoUrl}
                        download={`ecosphere_${current.topic?.toLowerCase().replace(/\s+/g, "_") || "animation"}.webm`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent h-8"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={toggleFullscreen}
                        className="h-8 px-2 text-muted-foreground"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Story beats (collapsed by default — the video is the product) */}
              {current?.scenes && current.scenes.length > 0 && (
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStoryboard((v) => !v)}
                    className="self-start text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    aria-expanded={showStoryboard}
                  >
                    {showStoryboard ? "Hide story" : `View story (${current.scenes.length} beats)`}
                  </button>
                  {showStoryboard && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {current.scenes.map((sc, i) => {
                        const filmDef = sc.film ? FILMS[sc.film as keyof typeof FILMS] : null;
                        const beatTitle = filmDef?.beats[sc.beat_index ?? i]?.title ?? `Scene ${i + 1}`;
                        return (
                          <div
                            key={sc.sceneNumber || sc.scene_number || i}
                            className="rounded-lg border border-border/70 bg-card p-3 flex flex-col gap-1 text-xs shadow-2xs"
                          >
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {beatTitle}
                              </span>
                              <span>{sc.duration}s</span>
                            </div>
                            <p className="text-muted-foreground leading-snug line-clamp-2">
                              {sc.narration || sc.dialogue || sc.visualDescription}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Generated Videos Library */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <History className="h-4 w-4 text-emerald-500" aria-hidden />
                  My Videos Library
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {history.length} {history.length === 1 ? "video" : "videos"} saved
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No generated animations saved yet. Create your first video above!
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => item.videoUrl && setCurrent(item)}
                      className={cn(
                        "group flex items-center justify-between gap-2.5 rounded-lg border p-3 transition-all",
                        item.videoUrl ? "cursor-pointer" : "opacity-80",
                        current?.id === item.id
                          ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs"
                          : "border-border hover:border-emerald-500/40 bg-card",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="h-10 w-16 shrink-0 rounded-md border border-border object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 shrink-0">
                            <Film className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-foreground">
                            {item.topic || item.prompt.slice(0, 30)}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {item.durationSeconds}s • {new Date(item.createdAt).toLocaleDateString()}
                            {item.status === "FAILED" ? " • Failed" : item.videoUrl ? "" : " • Processing"}
                          </p>
                          {item.status === "FAILED" && item.errorMessage && (
                            <p className="text-[11px] text-destructive truncate">{item.errorMessage}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(item.id, e)}
                          aria-label="Delete video"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
