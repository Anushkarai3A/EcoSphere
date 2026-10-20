import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/** Deterministic float particles so SSR/re-renders never reshuffle the field. */
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53 + 11) % 97}%`,
  top: `${(i * 37 + 23) % 88}%`,
  size: 2 + (i % 3),
  delay: `${(i % 7) * 0.9}s`,
  duration: `${7 + (i % 5) * 1.6}s`,
  tone: i % 3 === 0 ? "bg-cyan" : i % 3 === 1 ? "bg-emerald" : "bg-gold",
  opacity: 0.25 + ((i * 7) % 40) / 100,
}));

/**
 * Full-viewport cinematic hero built on the EcoSphere world artwork.
 * Slow parallax on scroll + gentle background drift + floating particles.
 */
export function WorldHero() {
  const { user } = useAuth();
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = parallaxRef.current;
    if (!layer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (y < window.innerHeight * 1.3) {
          layer.style.transform = `translate3d(0, ${(y * 0.26).toFixed(1)}px, 0)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const exploreHref = user ? "/app" : "/register";
  const questsHref = user ? (user.role === "STUDENT" ? "/app/student" : user.role === "TEACHER" ? "/app/teacher/quests" : "/app/admin") : "/login";

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      {/* Artwork layer: JS parallax (outer) + CSS drift (inner). */}
          <div ref={parallaxRef} aria-hidden className="absolute inset-0 -z-20 will-change-transform">
        <div className="absolute inset-0 animate-world-drift">
          <img
            src="/assets/world-map-hq.jpg"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="h-full w-full scale-105 object-cover object-[62%_42%]"
          />
        </div>
      </div>

      {/* Readability gradients — only behind the text; the artwork stays bright. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(3,21,29,0.55)_0%,rgba(3,21,29,0.14)_26%,rgba(3,21,29,0)_52%,rgba(3,21,29,0.42)_82%,rgba(3,21,29,0.9)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(3,21,29,0.6)_0%,rgba(3,21,29,0.16)_40%,rgba(3,21,29,0)_64%)]"
      />

      {/* Floating particles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`absolute rounded-full ${p.tone} animate-float blur-[1px]`}
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Hero content — bottom-left, over the open ocean. */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-6 pb-16 pt-32 sm:px-10 sm:pb-20">
        <div className="max-w-2xl animate-gallery-rise">
          <p className="flex items-center gap-3 font-micro text-[11px] uppercase tracking-[0.34em] text-cyan">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-cyan animate-pulse-glow" />
            A living world
          </p>

          <h1 className="mt-5 text-gallery-display text-bone drop-shadow-[0_8px_30px_rgba(0,0,0,0.65)]">
            <span className="block">
              <span className="gallery-underline">EcoSphere</span>
            </span>
          </h1>

          <p className="mt-6 font-title text-[clamp(18px,2.4vw,30px)] font-medium leading-tight tracking-[0.16em] text-frost">
            Explore. Learn. Protect.
          </p>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ash sm:text-base">
            Turn real-world environmental action into an adventure.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to={exploreHref}>
              <Button size="lg" className="uppercase tracking-[0.1em]">
                Explore the World
              </Button>
            </Link>
            <Link to={questsHref}>
              <Button size="lg" variant="outline" className="uppercase tracking-[0.1em]">
                View Quests
              </Button>
            </Link>
          </div>
        </div>

        <ScrollHint />
      </div>
    </section>
  );
}

function ScrollHint() {
  return (
    <div className="mt-14 hidden items-center gap-3 font-micro text-[10px] uppercase tracking-[0.3em] text-ash sm:flex">
      <span aria-hidden className="h-8 w-px bg-gradient-to-b from-transparent to-frost/60" />
      Scroll to explore
    </div>
  );
}

/** Small wrapper so other pages can reuse the hero copy rhythm. */
export function HeroKicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-micro text-[11px] uppercase tracking-[0.34em] text-cyan">{children}</p>
  );
}
