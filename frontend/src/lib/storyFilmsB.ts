/**
 * Story films B: WATER, SOLAR, WILDLIFE, AIR, GENERAL.
 * Same contract as storyFilmsA: continuous hero/world state across beats.
 */
import {
  drawBird,
  drawCar,
  drawHouse,
  drawPlasticBottle,
  drawRecycleBin,
  drawSapling,
  drawSign,
  drawSolarPanel,
  drawTap,
  drawTree,
  drawWateringCan,
  drawWindTurbine,
  FRIEND_PALETTE,
} from "./animationRenderer";
import {
  createFilmState,
  drawFriendWorld,
  drawHeroWorld,
  lerp,
  paintFlock,
  paintGround,
  paintSky,
  phase,
  rand,
  smooth,
  spawn,
  stepParts,
  updateFollowCam,
  walkHeroTo,
  type Film,
} from "./filmKit";

const G = 408; // ground line

// ---------------------------------------------------------------------------
// WATER — "Saving water at home"
// ---------------------------------------------------------------------------

function waterFilm(): Film {
  return {
    id: "water",
    title: "Saving Water at Home",
    createState: () => createFilmState(47),
    beats: [
      {
        id: "tap-running",
        title: "Water Running Away",
        weight: 1,
        camera: "closeup",
        narration: "A tap left running can waste dozens of litres every single day.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          paintSky(ctx, w, h, G, time, { top: "#bae6fd", bottom: "#fef9c3", sunScale: 0.9, clouds: 2, seed: 51 });
          paintGround(ctx, w, h, time, { y: G, color: "#d9c9a8", dark: "#a89468", tufts: false, seed: 52 });
          // Big tap, stream roaring; puddle grows with progress
          drawTap(ctx, w * 0.5, G - 130, 2.2, time, 1);
          const pw = 60 + p * 260;
          ctx.fillStyle = "rgba(56,189,248,0.75)";
          ctx.beginPath();
          ctx.ellipse(w * 0.5, G + 6, pw / 2, 10 + p * 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath();
          ctx.ellipse(w * 0.5 - pw * 0.15, G + 3, pw * 0.22, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          // Litre counter ticks up
          const litres = Math.floor(4 + p * 38);
          ctx.fillStyle = "#0c4a6e";
          ctx.font = "bold 26px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${litres} litres wasted`, w * 0.5, 120);
          stepParts(ctx, film, c.dt);
          void t;
          void dur;
        },
      },
      {
        id: "notice",
        title: "Someone Notices",
        weight: 0.9,
        camera: "follow",
        narration: "Our student hears the running water — and stops to look.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const hero = film.hero;
          if (!walkHeroTo(hero, 620, c.dt, 150)) {
            // walking in with curiosity
          } else {
            hero.action = p > 0.6 ? "point" : "stand";
          }
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, G, time, { top: "#7dd3fc", bottom: "#fef9c3", sunScale: 1, clouds: 3, ox: camX, seed: 53 });
          paintGround(ctx, w, h, time, { y: G, color: "#cfc39e", dark: "#9d8f66", ox: camX, seed: 54 });
          drawTap(ctx, 760 - camX, G - 96, 1.6, time, 1);
          ctx.fillStyle = "rgba(56,189,248,0.7)";
          ctx.beginPath();
          ctx.ellipse(760 - camX, G + 4, 70, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          // "!" alert pops over hero's head when noticing
          if (p > 0.55) {
            const pop = smooth(phase(p, 0.55, 0.65));
            ctx.save();
            ctx.globalAlpha = pop;
            ctx.fillStyle = "#dc2626";
            ctx.font = "bold 34px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("!", hero.x - camX + 24, G - 108 - pop * 8);
            ctx.restore();
          }
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "cycle-learn",
        title: "Every Drop Counts",
        weight: 1.1,
        camera: "closeup",
        narration: "Fresh water is precious — saving it protects rivers, lakes, and all life.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          film.hero.action = "stand";
          // Mini water-cycle: sun evaporates, cloud rains into a tank that fills
          paintSky(ctx, w, h, G, time, { top: "#0ea5e9", bottom: "#e0f2fe", sunScale: 1.3, clouds: 1, seed: 55 });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", tufts: false, seed: 56 });
          // Tank fills across the beat
          const fill = smooth(p);
          const tx = w * 0.5, ty = G - 40, tw = 150, th = 120;
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.roundRect(tx - tw / 2, ty - th, tw, th, 8);
          ctx.fill();
          ctx.fillStyle = "#0284c7";
          const fh = th * 0.9 * fill;
          ctx.fillRect(tx - tw / 2 + 6, ty - 6 - fh, tw - 12, fh);
          ctx.strokeStyle = "#075985";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(tx - tw / 2, ty - th, tw, th, 8);
          ctx.stroke();
          // Rain feeds the tank
          for (let i = 0; i < 26; i++) {
            const rx = tx - 120 + rand(57, i) * 240;
            const ry = ((rand(58, i) * 200 + time * 420) % 260) + 40;
            ctx.strokeStyle = "rgba(186,230,253,0.8)";
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 3, ry + 12);
            ctx.stroke();
          }
          // Droplet mascot bounces happily as the tank fills
          const bounce = Math.abs(Math.sin(time * 4)) * 10;
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(tx + tw / 2 + 90, G - 26 - bounce, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(tx + tw / 2 + 90 - 9, G - 30 - bounce);
          ctx.lineTo(tx + tw / 2 + 90, G - 52 - bounce);
          ctx.lineTo(tx + tw / 2 + 90 + 9, G - 30 - bounce);
          ctx.closePath();
          ctx.fill();
          drawHeroWorld(ctx, film, film.hero, G, time, 0);
          stepParts(ctx, film, c.dt);
          void t;
          void dur;
        },
      },
      {
        id: "act",
        title: "Turn It Off",
        weight: 1.2,
        camera: "medium",
        narration: "One twist later, the waste stops — and the savings begin.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          const hero = film.hero;
          hero.x = lerp(hero.x, 420, 0.05);
          hero.action = p < 0.35 ? "walk" : p < 0.62 ? "point" : "stand";
          const camX = updateFollowCam(film, 560, w * 0.5);
          paintSky(ctx, w, h, G, time, { top: "#7dd3fc", bottom: "#fef9c3", sunScale: 1, clouds: 3, ox: camX, seed: 59 });
          paintGround(ctx, w, h, time, { y: G, color: "#cfc39e", dark: "#9d8f66", ox: camX, seed: 60 });
          // Handle visibly rotates as the tap closes; stream dies out
          const open01 = 1 - smooth(phase(t, dur * 0.35, dur * 0.6));
          drawTap(ctx, 560 - camX, G - 96, 1.6, time, open01);
          if (open01 < 0.1 && p > 0.62) {
            // Saved drops hop into a bucket
            ctx.fillStyle = "#0ea5e9";
            ctx.beginPath();
            ctx.roundRect(660 - camX, G - 40, 44, 40, 5);
            ctx.fill();
            ctx.fillStyle = "#e0f2fe";
            ctx.font = "bold 11px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("SAVED", 682 - camX, G - 18);
          }
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "community",
        title: "Every Home Can Save",
        weight: 1,
        camera: "wide",
        narration: "When every home saves a little, together we save a river.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          const hero = film.hero;
          hero.action = "walk";
          hero.facing = 1;
          hero.x += c.dt * 55;
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = hero.x - 100;
          friend.facing = 1;
          friend.action = "walk";
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 4, ox: camX, seed: 61 });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", ox: camX, seed: 62 });
          // Blooming garden row passes by
          for (let i = 0; i < 6; i++) {
            const wx = 300 + i * 220;
            const sx = wx - camX;
            ctx.strokeStyle = "#166534";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(sx, G + 2);
            ctx.lineTo(sx, G - 26);
            ctx.stroke();
            ctx.fillStyle = ["#f472b6", "#facc15", "#fb7185"][i % 3] ?? "#f472b6";
            for (let pt = 0; pt < 5; pt++) {
              const a = (pt * Math.PI * 2) / 5 + Math.sin(time * 2 + i) * 0.1;
              ctx.beginPath();
              ctx.arc(sx + Math.cos(a) * 7, G - 30 + Math.sin(a) * 7, 4.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          paintFlock(ctx, time, 3, 110, 63);
          drawFriendWorld(ctx, film, G, time, camX);
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// SOLAR — "How does solar energy work?"
// ---------------------------------------------------------------------------

function solarFilm(): Film {
  return {
    id: "solar",
    title: "How Does Solar Energy Work?",
    createState: () => createFilmState(71),
    beats: [
      {
        id: "sunrise",
        title: "Sunrise",
        weight: 0.9,
        camera: "wide",
        narration: "Every morning, the sun pours more energy on Earth than we use in a year.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          // Sun climbs as the beat progresses
          const sunY = lerp(h * 0.55, h * 0.18, smooth(p));
          paintSky(ctx, w, h, G, time, {
            top: p < 0.5 ? "#c2703d" : "#38bdf8", bottom: p < 0.5 ? "#fcd34d" : "#e0f2fe",
            sunX: w * 0.5, sunY, sunScale: 1.4, clouds: 2, seed: 72,
          });
          paintGround(ctx, w, h, time, { y: G, color: "#8aa86b", dark: "#5d7f47", seed: 73 });
          // Sleepy dark panels on rooftops
          drawSolarPanel(ctx, w * 0.3, G + 10, 1.4);
          drawSolarPanel(ctx, w * 0.7, G + 10, 1.4);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "light-travel",
        title: "Light on the Move",
        weight: 1,
        camera: "follow",
        narration: "Sunlight travels to the panels, waking them up one ray at a time.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.3, clouds: 2, seed: 74 });
          paintGround(ctx, w, h, time, { y: G, color: "#8aa86b", dark: "#5d7f47", seed: 75 });
          const px = w * 0.5;
          drawSolarPanel(ctx, px, G + 10, 1.8);
          // Ray packets stream sun → panel, panel glow ramps up
          const glow = smooth(p);
          for (let i = 0; i < 8; i++) {
            const rp = ((time * 0.7 + i / 8) % 1);
            const rx = lerp(w * 0.5, px, rp);
            const ry = lerp(h * 0.16, G - 30, rp);
            ctx.fillStyle = `rgba(253,224,71,${0.9 - rp * 0.3})`;
            ctx.beginPath();
            ctx.arc(rx, ry, 5 - rp * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          if (glow > 0.05) {
            ctx.fillStyle = `rgba(253,224,71,${0.22 * glow})`;
            ctx.beginPath();
            ctx.arc(px, G - 24, 64 * glow + 20, 0, Math.PI * 2);
            ctx.fill();
          }
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "power-home",
        title: "Powering Homes",
        weight: 1.2,
        camera: "medium",
        narration: "The panels turn sunlight into electricity that powers the whole house.",
        draw(c) {
          const { ctx, w, h, t, dur, film, time } = c;
          film.hero.action = "stand";
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1, clouds: 3, seed: 76 });
          paintGround(ctx, w, h, time, { y: G, color: "#8aa86b", dark: "#5d7f47", seed: 77 });
          drawSolarPanel(ctx, w * 0.28, G + 10, 1.6);
          const lit = smooth(phase(t, dur * 0.25, dur * 0.55));
          // Current pulses flow panel → house along a wire
          const hx = w * 0.68;
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(w * 0.28, G - 20);
          ctx.quadraticCurveTo(w * 0.48, G - 90, hx, G - 50);
          ctx.stroke();
          if (lit > 0) {
            for (let i = 0; i < 5; i++) {
              const fp = ((time * 0.9 + i / 5) % 1);
              const fx = lerp(w * 0.28, hx, fp);
              const fy = G - 20 - Math.sin(fp * Math.PI) * 70;
              ctx.fillStyle = "#fde047";
              ctx.beginPath();
              ctx.arc(fx, fy, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          drawHouse(ctx, hx, G, 1.3, time, lit);
          // Meter dial spins fast, then slows as solar takes over
          const spin = lerp(9, 1.2, lit);
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.arc(w * 0.5, G - 130, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 3;
          ctx.stroke();
          const needle = time * spin;
          ctx.beginPath();
          ctx.moveTo(w * 0.5, G - 130);
          ctx.lineTo(w * 0.5 + Math.cos(needle) * 16, G - 130 + Math.sin(needle) * 16);
          ctx.stroke();
          drawHeroWorld(ctx, film, film.hero, G, time, 0);
          film.hero.x = w * 0.16;
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "spread",
        title: "Rooftop Revolution",
        weight: 1,
        camera: "follow",
        narration: "Soon, rooftops across the whole town are catching the sun.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          const hero = film.hero;
          hero.action = "walk";
          hero.facing = 1;
          hero.x += c.dt * 110;
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 3, ox: camX, seed: 78 });
          paintGround(ctx, w, h, time, { y: G, color: "#9aa578", dark: "#6b744e", ox: camX, seed: 79 });
          // Houses stream past; panels pop up as the hero passes
          for (let i = 0; i < 5; i++) {
            const wx = 200 + i * 340;
            const sx = wx - camX * 0.9;
            const popped = smooth(phase(hero.x, wx - 260, wx - 60));
            ctx.fillStyle = "#e7d8b7";
            ctx.fillRect(sx - 70, G - 90, 140, 90);
            ctx.fillStyle = "#b45309";
            ctx.beginPath();
            ctx.moveTo(sx - 80, G - 90);
            ctx.lineTo(sx, G - 130);
            ctx.lineTo(sx + 80, G - 90);
            ctx.closePath();
            ctx.fill();
            if (popped > 0) {
              ctx.save();
              ctx.globalAlpha = popped;
              drawSolarPanel(ctx, sx, G - 88, popped * 1.1);
              ctx.restore();
            }
          }
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "clean-town",
        title: "Clean Energy, Clear Skies",
        weight: 1,
        camera: "wide",
        narration: "Clean energy means clear skies — and power for everyone.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          const hero = film.hero;
          hero.action = "stand";
          hero.x = w * 0.4;
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = w * 0.55;
          friend.action = "stand";
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.2, clouds: 4, seed: 80 });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", seed: 81 });
          drawWindTurbine(ctx, w * 0.15, G, 1.1, time);
          drawSolarPanel(ctx, w * 0.3, G + 10, 1.2);
          drawHouse(ctx, w * 0.72, G, 1.2, time, 1);
          paintFlock(ctx, time, 4, 110, 82);
          drawFriendWorld(ctx, film, G, time, 0);
          drawHeroWorld(ctx, film, hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// WILDLIFE — "Protecting tigers and wildlife" (gentle: forest friends)
// ---------------------------------------------------------------------------

function wildlifeFilm(): Film {
  return {
    id: "wildlife",
    title: "Homes for Wildlife",
    createState: () => createFilmState(93),
    beats: [
      {
        id: "silent-forest",
        title: "Too Quiet",
        weight: 1,
        camera: "wide",
        narration: "This forest has gone strangely quiet — where have all the birds gone?",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          paintSky(ctx, w, h, G, time, { top: "#94a3b8", bottom: "#e2e8f0", sunScale: 0.9, clouds: 2, seed: 94 });
          paintGround(ctx, w, h, time, { y: G, color: "#6b8f5e", dark: "#47663f", seed: 95 });
          drawTree(ctx, w * 0.25, G + 4, 1.4, time, "#4d7c43");
          drawTree(ctx, w * 0.7, G + 4, 1.6, time, "#4d7c43");
          // Empty nest on a branch
          ctx.strokeStyle = "#6b3f14";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(w * 0.7 - 20, G - 120, 16, 7, 0, 0, Math.PI * 2);
          ctx.stroke();
          // A single leaf drifts down through the stillness
          const fall = (time * 0.35) % 1;
          ctx.fillStyle = "#a16207";
          ctx.beginPath();
          ctx.ellipse(w * 0.5 + Math.sin(time) * 20, 120 + fall * 220, 4, 2.5, fall * 3, 0, Math.PI * 2);
          ctx.fill();
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "feather",
        title: "A Clue",
        weight: 0.9,
        camera: "follow",
        narration: "A single feather — a sign that birds still pass through here.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const hero = film.hero;
          if (!walkHeroTo(hero, 560, c.dt, 140)) {
            // approaching
          } else {
            hero.action = "kneel";
          }
          const camX = updateFollowCam(film, hero.x, w * 0.5);
          paintSky(ctx, w, h, G, time, { top: "#7dd3fc", bottom: "#e0f2fe", sunScale: 1, clouds: 2, ox: camX, seed: 96 });
          paintGround(ctx, w, h, time, { y: G, color: "#6b8f5e", dark: "#47663f", ox: camX, seed: 97 });
          drawTree(ctx, 420 - camX, G + 4, 1.3, time);
          // Feather floats down and lands as hero kneels
          const land = smooth(phase(p, 0.2, 0.7));
          const fx = lerp(560 - camX + 120, 560 - camX + 24, land);
          const fy = lerp(80, G - 6, land) + Math.sin(time * 3) * 6 * (1 - land);
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(-0.5 + land * 1.1);
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.ellipse(0, 0, 10, 3.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "nest-box",
        title: "Building Homes",
        weight: 1.2,
        camera: "medium",
        narration: "A safe nest box gives birds a reason to stay and raise their young.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          const hero = film.hero;
          hero.x = lerp(hero.x, 380, 0.05);
          hero.action = p < 0.6 ? "point" : "stand";
          const camX = updateFollowCam(film, 520, w * 0.5);
          paintSky(ctx, w, h, G, time, { top: "#7dd3fc", bottom: "#fef9c3", sunScale: 1, clouds: 3, ox: camX, seed: 98 });
          paintGround(ctx, w, h, time, { y: G, color: "#6b8f5e", dark: "#47663f", ox: camX, seed: 99 });
          drawTree(ctx, 560 - camX, G + 4, 1.7, time);
          // Nest box rises up the trunk as hero "hangs" it
          const rise = smooth(phase(t, dur * 0.25, dur * 0.6));
          const bx = 560 - camX + 26;
          const by = lerp(G + 6, G - 120, rise);
          ctx.fillStyle = "#a16207";
          ctx.beginPath();
          ctx.roundRect(bx - 16, by - 18, 32, 30, 3);
          ctx.fill();
          ctx.fillStyle = "#020617";
          ctx.beginPath();
          ctx.arc(bx, by - 4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#57300f";
          ctx.beginPath();
          ctx.moveTo(bx - 20, by - 18);
          ctx.lineTo(bx + 20, by - 18);
          ctx.lineTo(bx, by - 30);
          ctx.closePath();
          ctx.fill();
          // Hammer taps: spark ticks synced to arm
          if (p > 0.25 && p < 0.6 && Math.sin(time * 10) > 0.6) {
            spawn(film, { x: bx, y: by - 20, vx: (Math.random() - 0.5) * 60, vy: -40, life: 0.4, maxLife: 0.4, size: 2, color: "#fde047" });
          }
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "return",
        title: "They Come Back",
        weight: 1.1,
        camera: "wide",
        narration: "Word travels fast in the forest — the birds are coming home.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 3, seed: 100 });
          paintGround(ctx, w, h, time, { y: G, color: "#5da05c", dark: "#3d7038", seed: 101 });
          drawTree(ctx, w * 0.3, G + 4, 1.5, time);
          drawTree(ctx, w * 0.68, G + 4, 1.7, time);
          // Nest box already up
          ctx.fillStyle = "#a16207";
          ctx.beginPath();
          ctx.roundRect(w * 0.68 + 10, G - 138, 32, 30, 3);
          ctx.fill();
          // Flock streams in from the right, count grows with progress
          const count = 1 + Math.floor(p * 5);
          for (let i = 0; i < count; i++) {
            const fp = smooth(phase(p, i * 0.12, i * 0.12 + 0.5));
            const bx = lerp(w + 60, w * (0.55 + (i % 3) * 0.1), fp);
            const by = 90 + (i % 4) * 36 + Math.sin(time * 2 + i) * 10;
            const wing = Math.sin(time * 9 + i) * 12;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(bx - 14, by + wing);
            ctx.quadraticCurveTo(bx - 6, by - wing * 0.6, bx, by);
            ctx.quadraticCurveTo(bx + 6, by - wing * 0.6, bx + 14, by + wing);
            ctx.stroke();
          }
          film.hero.x = w * 0.2;
          film.hero.action = "stand";
          drawHeroWorld(ctx, film, film.hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "sanctuary",
        title: "A Living Sanctuary",
        weight: 1,
        camera: "wide",
        narration: "Protect habitats, and wildlife returns the favor with birdsong.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          const hero = film.hero;
          hero.action = "stand";
          hero.x = w * 0.35;
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = w * 0.5;
          friend.action = "point";
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 4, seed: 102 });
          paintGround(ctx, w, h, time, { y: G, color: "#5da05c", dark: "#3d7038", seed: 103 });
          drawTree(ctx, w * 0.15, G + 4, 1.5, time);
          drawTree(ctx, w * 0.8, G + 4, 1.7, time);
          paintFlock(ctx, time, 5, 100, 104);
          // Butterflies loop around flowers
          for (let i = 0; i < 3; i++) {
            const a = time * 1.4 + (i * Math.PI * 2) / 3;
            const bx = w * 0.62 + Math.cos(a) * 60;
            const by = G - 60 + Math.sin(a * 1.7) * 30;
            const flap = Math.abs(Math.sin(time * 14 + i)) * 5 + 1;
            ctx.fillStyle = ["#f472b6", "#facc15", "#c084fc"][i % 3] ?? "#f472b6";
            ctx.beginPath();
            ctx.ellipse(bx - flap / 2, by, flap, 5, -0.4, 0, Math.PI * 2);
            ctx.ellipse(bx + flap / 2, by, flap, 5, 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          drawSign(ctx, w * 0.68, G - 6, 1, time, ["WILDLIFE", "SANCTUARY"]);
          drawFriendWorld(ctx, film, G, time, 0);
          drawHeroWorld(ctx, film, hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// AIR — "What causes air pollution?" (smog → action → blue skies)
// ---------------------------------------------------------------------------

function airFilm(): Film {
  return {
    id: "air",
    title: "Clearing Our Skies",
    createState: () => createFilmState(115),
    beats: [
      {
        id: "smog-street",
        title: "A Grey Morning",
        weight: 1,
        camera: "follow",
        narration: "On smoggy mornings, the air itself looks tired and grey.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const hero = film.hero;
          if (p < 0.7) {
            hero.x += c.dt * 105;
            hero.facing = 1;
            hero.action = "walk";
          } else {
            hero.action = "wipe";
          }
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, G, time, { top: "#64748b", bottom: "#cbd5e1", sunScale: 0.9, clouds: 4, ox: camX, seed: 116 });
          // Smog banks drift through
          ctx.fillStyle = "rgba(148,163,184,0.35)";
          for (let i = 0; i < 4; i++) {
            const sx = ((rand(117, i) * (w + 400) + time * (20 + i * 8)) % (w + 400)) - 200;
            ctx.beginPath();
            ctx.ellipse(sx, 150 + i * 55, 150, 34, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          paintGround(ctx, w, h, time, { y: G, color: "#9a958c", dark: "#6e6a61", ox: camX, seed: 118 });
          // Cars stream past with exhaust
          for (let i = 0; i < 2; i++) {
            const dir = i === 0 ? 1 : -1;
            const span = w + 400;
            const cxp = dir === 1
              ? ((rand(119, i) * span + time * 170) % span) - 200
              : span - 200 - ((rand(119, i) * span + time * 130) % span);
            drawCar(ctx, cxp, G + 24, 0.95, time + i * 2, i === 0 ? "#64748b" : "#475569", dir as 1 | -1);
          }
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "factory",
        title: "Where It Comes From",
        weight: 1,
        camera: "wide",
        narration: "Factories and traffic pump smoke and gases into the air we breathe.",
        draw(c) {
          const { ctx, w, h, t, dur, film, time } = c;
          film.hero.action = "stand";
          paintSky(ctx, w, h, G, time, { top: "#475569", bottom: "#94a3b8", sunScale: 0.8, clouds: 2, seed: 120 });
          paintGround(ctx, w, h, time, { y: G, color: "#8a8578", dark: "#5f5b52", tufts: false, seed: 121 });
          // Factory row with heavy stacks
          for (const [fx, s] of [[w * 0.3, 1.2], [w * 0.62, 1.5]] as const) {
            ctx.fillStyle = "#334155";
            ctx.fillRect(fx - 55 * s, G - 90 * s, 110 * s, 90 * s);
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(fx - 10 * s, G - 150 * s, 18 * s, 70 * s);
            // Thick smoke columns
            for (let i = 0; i < 5; i++) {
              const age = ((time * 0.7 + i * 0.45 + fx) % 2.4) / 2.4;
              ctx.fillStyle = `rgba(71,85,105,${(1 - age) * 0.8})`;
              ctx.beginPath();
              ctx.arc(fx - 1 * s + Math.sin(time + i * 2) * 16, G - 150 * s - age * 130, (12 + age * 34) * s, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          // AQI board glares red
          const bx = w * 0.85;
          ctx.fillStyle = "#0f172a";
          ctx.beginPath();
          ctx.roundRect(bx - 52, 120, 104, 64, 8);
          ctx.fill();
          ctx.fillStyle = "#ef4444";
          ctx.font = "bold 15px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("AQI", bx, 140);
          const aqi = Math.floor(280 + Math.sin(time * 2) * 12);
          ctx.font = "bold 24px system-ui, sans-serif";
          ctx.fillText(`${aqi}`, bx, 168);
          drawHeroWorld(ctx, film, film.hero, G, time, 0);
          film.hero.x = w * 0.15;
          stepParts(ctx, film, c.dt);
          void t;
          void dur;
        },
      },
      {
        id: "change",
        title: "Choosing Change",
        weight: 1.1,
        camera: "follow",
        narration: "Cleaner choices — cycles, buses, and feet — clear the air street by street.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const hero = film.hero;
          hero.action = "walk";
          hero.facing = 1;
          hero.x += c.dt * 115;
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          // Sky clears across the beat
          const clear = smooth(p);
          paintSky(ctx, w, h, G, time, {
            top: clear > 0.5 ? "#7dd3fc" : "#94a3b8",
            bottom: clear > 0.5 ? "#fef9c3" : "#e2e8f0",
            sunScale: 1, clouds: 3, ox: camX, seed: 122,
          });
          paintGround(ctx, w, h, time, { y: G, color: "#a8a094", dark: "#78716c", ox: camX, seed: 123 });
          // Cyclists glide past (simple two-wheel riders)
          for (let i = 0; i < 2; i++) {
            const span = w + 300;
            const cxp = span - 150 - ((rand(124, i) * span + time * 200 + i * 400) % span);
            const cy = G + 8;
            ctx.strokeStyle = "#0f172a";
            ctx.lineWidth = 3;
            for (const wx of [cxp - 16, cxp + 16]) {
              ctx.beginPath();
              ctx.arc(wx, cy, 11, 0, Math.PI * 2);
              ctx.stroke();
              const a = time * 8;
              ctx.beginPath();
              ctx.moveTo(wx, cy);
              ctx.lineTo(wx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
              ctx.stroke();
            }
            drawBird(ctx, cxp, cy - 46, 0.7, time + i);
          }
          // Saplings planted in a row along the street
          for (let i = 0; i < 5; i++) {
            const wx = 500 + i * 260;
            const planted = smooth(phase(hero.x, wx - 320, wx - 120));
            if (planted > 0) {
              ctx.save();
              ctx.globalAlpha = planted;
              drawTree(ctx, wx - camX, G + 2, 0.5 + planted * 0.4, time);
              ctx.restore();
            }
          }
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "green-belt",
        title: "The Green Belt Grows",
        weight: 1,
        camera: "up",
        narration: "Green belts of trees trap dust and breathe out fresh air.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 3, seed: 125 });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", seed: 126 });
          // Trees scale up across the beat
          for (let i = 0; i < 6; i++) {
            const g = smooth(phase(p, i * 0.1, i * 0.1 + 0.5));
            if (g > 0) drawTree(ctx, 90 + i * 150, G + 4, 0.4 + g * 1.1, time + i);
          }
          // Dust motes get caught: fade out as green rises
          ctx.fillStyle = `rgba(148,163,184,${0.4 * (1 - p)})`;
          for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.arc(rand(127, i) * w, 120 + rand(128, i) * 220, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          // AQI board flips to green
          const bx = w * 0.85;
          const green = smooth(phase(p, 0.5, 0.8));
          ctx.fillStyle = "#0f172a";
          ctx.beginPath();
          ctx.roundRect(bx - 52, 120, 104, 64, 8);
          ctx.fill();
          ctx.fillStyle = green > 0.5 ? "#22c55e" : "#ef4444";
          ctx.font = "bold 15px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("AQI", bx, 140);
          ctx.font = "bold 24px system-ui, sans-serif";
          ctx.fillText(green > 0.5 ? "42" : "268", bx, 168);
          film.hero.x = w * 0.2;
          film.hero.action = "stand";
          drawHeroWorld(ctx, film, film.hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "blue-sky",
        title: "Breathe Easy",
        weight: 1,
        camera: "wide",
        narration: "Blue skies return — proof that cleaner choices really work.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          const hero = film.hero;
          hero.action = "point";
          hero.x = w * 0.4;
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = w * 0.55;
          friend.action = "stand";
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.2, clouds: 4, seed: 129 });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", seed: 130 });
          drawTree(ctx, w * 0.15, G + 4, 1.4, time);
          drawTree(ctx, w * 0.85, G + 4, 1.5, time);
          paintFlock(ctx, time, 5, 110, 131);
          drawSign(ctx, w * 0.7, G - 6, 1, time, ["CLEAN AIR", "HEALTHY", "CITY"]);
          drawFriendWorld(ctx, film, G, time, 0);
          drawHeroWorld(ctx, film, hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// GENERAL — "Our environment" montage film
// ---------------------------------------------------------------------------

function generalFilm(): Film {
  return {
    id: "general",
    title: "Our Living Planet",
    createState: () => createFilmState(141),
    beats: [
      {
        id: "town",
        title: "Our Shared Home",
        weight: 1,
        camera: "wide",
        narration: "Everything we use — food, water, air — flows from nature around us.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          paintSky(ctx, w, h, G, time, { top: "#7dd3fc", bottom: "#fef9c3", sunScale: 1.1, clouds: 4, seed: 142 });
          paintGround(ctx, w, h, time, { y: G, color: "#8aa86b", dark: "#5d7f47", seed: 143 });
          drawTree(ctx, w * 0.2, G + 4, 1.3, time);
          drawTree(ctx, w * 0.8, G + 4, 1.4, time);
          paintFlock(ctx, time, 3, 110, 144);
          film.hero.x = w * 0.5;
          film.hero.action = "stand";
          drawHeroWorld(ctx, film, film.hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "vignettes",
        title: "Small Problems, Big Impact",
        weight: 1.1,
        camera: "follow",
        narration: "Litter on streets, taps left running, smoke in the air — small harms add up.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          const hero = film.hero;
          hero.action = "walk";
          hero.facing = 1;
          hero.x += c.dt * 110;
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, G, time, { top: "#94a3b8", bottom: "#e2e8f0", sunScale: 1, clouds: 3, ox: camX, seed: 145 });
          paintGround(ctx, w, h, time, { y: G, color: "#a8a094", dark: "#78716c", ox: camX, seed: 146 });
          // Three vignette stations the hero passes: litter, running tap, smoke
          const stations = [500, 950, 1400];
          stations.forEach((wx, i) => {
            const sx = wx - camX;
            if (i === 0) {
              drawPlasticBottle(ctx, sx, G - 6, 0.9, time);
              drawPlasticBottle(ctx, sx + 34, G - 4, 0.7, time + 2);
            } else if (i === 1) {
              drawTap(ctx, sx, G - 70, 1.2, time, 1);
            } else {
              drawBird(ctx, sx, G - 190, 0.8, time);
              ctx.fillStyle = "rgba(100,116,139,0.5)";
              ctx.beginPath();
              ctx.arc(sx + 40, G - 150, 16, 0, Math.PI * 2);
              ctx.arc(sx + 60, G - 170, 22, 0, Math.PI * 2);
              ctx.fill();
            }
            // Hero reacts passing each station
            if (Math.abs(hero.x - wx) < 60) hero.action = "wipe";
          });
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "act-montage",
        title: "Small Acts, Big Change",
        weight: 1.3,
        camera: "medium",
        narration: "Pick it up. Turn it off. Plant it green. Three acts, one healthier town.",
        draw(c) {
          const { ctx, w, h, t, dur, film, time } = c;
          // Three mini-acts inside one beat, each ~1/3
          const act = Math.min(2, Math.floor((t / dur) * 3));
          const apt = (t / dur) * 3 - act;
          paintSky(ctx, w, h, G, time, { top: "#7dd3fc", bottom: "#fef9c3", sunScale: 1, clouds: 3, seed: 147 + act });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", seed: 150 });
          const hero = film.hero;
          hero.x = w * 0.42;
          if (act === 0) {
            // ACT 1: pick up litter → bin
            hero.action = apt < 0.5 ? "kneel" : "stand";
            const bp = smooth(apt);
            drawPlasticBottle(ctx, lerp(w * 0.55, w * 0.3, bp), lerp(G - 6, G - 60, Math.sin(bp * Math.PI)) , 0.9, time);
            drawRecycleBin(ctx, w * 0.24, G, 1.2, time);
            ctx.fillStyle = "#0c4a6e";
            ctx.font = "bold 20px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("1 · PICK IT UP", w * 0.5, 120);
          } else if (act === 1) {
            // ACT 2: turn off the tap
            hero.action = apt < 0.6 ? "point" : "stand";
            drawTap(ctx, w * 0.55, G - 100, 1.6, time, 1 - smooth(phase(apt, 0.3, 0.7)));
            ctx.fillStyle = "#0c4a6e";
            ctx.font = "bold 20px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("2 · TURN IT OFF", w * 0.5, 120);
          } else {
            // ACT 3: plant + water
            hero.action = apt < 0.5 ? "kneel" : "stand";
            drawSapling(ctx, w * 0.55, G + 2, 1.1, time, 0.12 + apt * 0.2);
            if (apt > 0.55) drawWateringCan(ctx, w * 0.42, G - 40, 0.85, time);
            ctx.fillStyle = "#0c4a6e";
            ctx.font = "bold 20px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("3 · PLANT IT GREEN", w * 0.5, 120);
          }
          drawHeroWorld(ctx, film, hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "pledge",
        title: "Take the Pledge",
        weight: 0.9,
        camera: "medium",
        narration: "Promise one green habit — and invite a friend to do the same.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const hero = film.hero;
          hero.x = w * 0.38;
          hero.action = p < 0.5 ? "point" : "stand";
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = w * 0.58;
          friend.action = p < 0.5 ? "stand" : "point";
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 3, seed: 151 });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", seed: 152 });
          drawTree(ctx, w * 0.14, G + 4, 1.3, time);
          drawSign(ctx, w * 0.72, G - 6, 1.1, time, ["I PLEDGE", "ONE GREEN", "HABIT"]);
          // Pledge badge pops over hero
          if (p > 0.6) {
            const pop = smooth(phase(p, 0.6, 0.72));
            ctx.save();
            ctx.globalAlpha = pop;
            ctx.fillStyle = "#10b981";
            ctx.beginPath();
            ctx.arc(w * 0.38, G - 120, 20 * pop + 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(w * 0.38 - 8, G - 119);
            ctx.lineTo(w * 0.38 - 2, G - 113);
            ctx.lineTo(w * 0.38 + 9, G - 127);
            ctx.stroke();
            ctx.restore();
          }
          drawFriendWorld(ctx, film, G, time, 0);
          drawHeroWorld(ctx, film, hero, G, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "thriving",
        title: "Our Living Planet",
        weight: 1,
        camera: "wide",
        narration: "Small habits, multiplied by millions, keep our planet alive and thriving.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          const hero = film.hero;
          hero.action = "walk";
          hero.facing = 1;
          hero.x += c.dt * 55;
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = hero.x - 100;
          friend.facing = 1;
          friend.action = "walk";
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, G, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 4, ox: camX, seed: 153 });
          paintGround(ctx, w, h, time, { y: G, color: "#7fb069", dark: "#4d7c43", ox: camX, seed: 154 });
          for (const [wx, s] of [[420, 1.4], [760, 1.6], [1100, 1.5]] as const) {
            drawTree(ctx, wx - camX, G + 4, s, time);
          }
          drawSolarPanel(ctx, 950 - camX, G + 8, 1);
          paintFlock(ctx, time, 4, 110, 155);
          drawFriendWorld(ctx, film, G, time, camX);
          drawHeroWorld(ctx, film, hero, G, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
    ],
  };
}

export const WATER_FILM = waterFilm();
export const SOLAR_FILM = solarFilm();
export const WILDLIFE_FILM = wildlifeFilm();
export const AIR_FILM = airFilm();
export const GENERAL_FILM = generalFilm();
