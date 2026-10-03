/**
 * Story films A: FOREST (tree-planting epic) and OCEAN (plastic journey).
 * Each film is one continuous world: hero position, greenness, and cleanliness
 * persist across beats, so the story visibly progresses instead of restarting.
 */
import {
  drawCar,
  drawDrain,
  drawFish,
  drawPlasticBottle,
  drawRecycleBin,
  drawSapling,
  drawSign,
  drawStump,
  drawTree,
  drawTurtle,
  drawWateringCan,
  drawWaterWaves,
  drawWhale,
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

const GROUND_Y = 408;

// ---------------------------------------------------------------------------
// FOREST — "Why should we plant more trees?"
// ---------------------------------------------------------------------------

function forestFilm(): Film {
  return {
    id: "forest",
    title: "Why Plant More Trees?",
    createState: () => createFilmState(11),
    beats: [
      {
        id: "hot-street",
        title: "The Hot Neighborhood",
        weight: 1,
        camera: "follow",
        narration:
          "Have you ever noticed how much hotter a neighborhood feels when there are almost no trees?",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          const hero = film.hero;
          // Walk right for most of the beat, then stop and wipe sweat
          if (p < 0.72) {
            hero.x += c.dt * 120;
            hero.facing = 1;
            hero.action = "walk";
          } else {
            hero.action = "wipe";
          }
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, GROUND_Y, time, {
            top: "#f59e0b", bottom: "#fcd34d", sunScale: 1.5, clouds: 1, heat: 0.9, ox: camX, seed: 1,
          });
          // Dry cracked street, almost no trees: one pale sapling far behind
          paintGround(ctx, w, h, time, { y: GROUND_Y, color: "#d6a85c", dark: "#a8793a", ox: camX, seed: 5 });
          drawTree(ctx, 180 - camX * 0.85, GROUND_Y + 4, 0.9, time, "#a16207");
          // A car passes through mid-beat
          const carT = phase(t, dur * 0.15, dur * 0.7);
          if (carT > 0 && carT < 1) {
            drawCar(ctx, lerp(-120, w + 120, smooth(carT)), GROUND_Y + 26, 1, time, "#ef4444", 1);
          }
          // Dust kicked up while walking
          if (hero.action === "walk" && Math.random() < 0.5) {
            spawn(film, { x: hero.x - camX - 10, y: GROUND_Y - 2, vx: -30, vy: -28, life: 0.7, maxLife: 0.7, size: 2.6, color: "rgba(214,168,92,0.9)" });
          }
          drawHeroWorld(ctx, film, hero, GROUND_Y, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "barren-land",
        title: "What Was Lost",
        weight: 0.9,
        camera: "medium",
        narration: "When trees disappear, we lose much more than shade.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const hero = film.hero;
          // Hero arrives at the stump field, stops, points at it
          const spotX = 1080;
          if (!walkHeroTo(hero, spotX, c.dt, 150)) {
            // still walking in
          } else {
            hero.action = p > 0.75 ? "wipe" : "point";
          }
          const camX = updateFollowCam(film, hero.x, w * 0.5);
          paintSky(ctx, w, h, GROUND_Y, time, {
            top: "#78716c", bottom: "#d6a85c", sunScale: 1.2, clouds: 2, heat: 0.45, ox: camX, seed: 2,
          });
          paintGround(ctx, w, h, time, { y: GROUND_Y, color: "#c2a06b", dark: "#8a6b42", ox: camX, seed: 6 });
          // Stump field (world coords so the camera pans across them)
          for (const [wx, s] of [[860, 1.1], [990, 0.9], [1210, 1.2], [1330, 0.8]] as const) {
            drawStump(ctx, wx - camX, GROUND_Y + 2, s, time);
          }
          // Wind-blown dust sheets
          if (Math.random() < 0.8) {
            spawn(film, {
              x: Math.random() * w, y: GROUND_Y - 20 - Math.random() * 60,
              vx: -160 - Math.random() * 80, vy: 6, life: 1.1, maxLife: 1.1,
              size: 2 + Math.random() * 2, color: "rgba(214,180,130,0.7)",
            });
          }
          drawHeroWorld(ctx, film, hero, GROUND_Y, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "how-trees-help",
        title: "How Trees Help",
        weight: 1.2,
        camera: "closeup",
        narration: "Trees breathe in carbon dioxide and breathe out oxygen, while cooling the air around them.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          // Hero stands aside watching; the tree is the star
          film.hero.x = lerp(film.hero.x, 300, 0.04);
          film.hero.action = "stand";
          const camX = updateFollowCam(film, 560, w * 0.5);
          paintSky(ctx, w, h, GROUND_Y, time, {
            top: "#38bdf8", bottom: "#bae6fd", sunScale: 1, clouds: 3, ox: camX, seed: 3,
          });
          paintGround(ctx, w, h, time, { y: GROUND_Y, color: "#4d9e57", dark: "#2f7a3d", ox: camX, seed: 7 });
          const treeX = 560 - camX;
          drawTree(ctx, treeX, GROUND_Y + 6, 2.1, time, "#16a34a");
          // CO2 flows INTO leaves (grey), O2 flows OUT (pale blue)
          const emit = (n: number, inward: boolean, color: string, seed: number) => {
            for (let i = 0; i < n; i++) {
              const cyc = ((time * 0.5 + i / n + seed) % 1);
              const sx = inward ? treeX + 190 : treeX + (rand(seed, i) - 0.5) * 60;
              const ex = inward ? treeX + (rand(seed, i + 9) - 0.5) * 60 : treeX + 190;
              const x = lerp(sx, ex, cyc);
              const y = GROUND_Y - 190 + Math.sin((i * 2.1 + time * 2 + seed) * 1.4) * 46 - cyc * 20;
              ctx.globalAlpha = 0.85;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(x, y, 4.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.fillStyle = color === "#64748b" ? "#e2e8f0" : "#0c4a6e";
              ctx.font = "bold 7px system-ui, sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(inward ? "CO₂" : "O₂", x, y);
            }
          };
          emit(7, true, "#64748b", 4);
          emit(7, false, "#bae6fd", 8);
          drawHeroWorld(ctx, film, film.hero, GROUND_Y, time, camX);
          paintFlock(ctx, time, p > 0.6 ? 3 : 1, 120, 21);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "planting",
        title: "Taking Action",
        weight: 1.5,
        camera: "medium",
        narration: "One sapling, planted with care today, becomes tomorrow's shade.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          const hero = film.hero;
          const spotX = 640;
          // Phase 1: walk to the spot. Phase 2: kneel + dig (soil bursts).
          // Phase 3: sapling rises. Phase 4: stand + water. Phase 5: smile.
          const walkP = phase(t, 0, dur * 0.22);
          if (walkP < 1) {
            hero.x = lerp(420, spotX - 46, smooth(walkP));
            hero.facing = 1;
            hero.action = "walk";
          } else if (p < 0.52) {
            hero.x = spotX - 46;
            hero.action = "kneel";
            // Digging bursts synced to arm rhythm
            if (Math.sin(time * 7) > 0.55) {
              for (let i = 0; i < 3; i++) {
                spawn(film, {
                  x: spotX - 20 + Math.random() * 40, y: GROUND_Y - 4,
                  vx: (Math.random() - 0.5) * 90, vy: -90 - Math.random() * 70,
                  life: 0.7, maxLife: 0.7, size: 2.6, color: "#6b3f14", grav: 420,
                });
              }
            }
          } else {
            hero.x = spotX - 46;
            hero.action = "stand";
          }
          const camX = updateFollowCam(film, spotX, w * 0.5);
          paintSky(ctx, w, h, GROUND_Y, time, {
            top: "#7dd3fc", bottom: "#fef9c3", sunScale: 1, clouds: 3, ox: camX, seed: 4,
          });
          paintGround(ctx, w, h, time, { y: GROUND_Y, color: "#65a34d", dark: "#3f7a34", ox: camX, seed: 8 });
          // Sapling rises once digging passes; hero waters it, then stands back
          const growIn = smooth(phase(t, dur * 0.4, dur * 0.62));
          if (growIn > 0) {
            drawSapling(ctx, spotX - camX, GROUND_Y + 2, 1.05, time, growIn * 0.3);
          }
          if (p > 0.62 && p < 0.86) {
            drawWateringCan(ctx, spotX - 18 - camX, GROUND_Y - 34, 0.9, time);
          }
          drawHeroWorld(ctx, film, hero, GROUND_Y, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "timelapse",
        title: "Time Passes",
        weight: 1.1,
        camera: "up",
        narration: "Season after season, the little sapling reaches for the sky.",
        draw(c) {
          const { ctx, w, h, t, p, film, time } = c;
          film.hero.action = "stand";
          const camX = updateFollowCam(film, 640, w * 0.5);
          // Fast day cycle: sky hue oscillates
          const dayMix = 0.5 + 0.5 * Math.sin(t * 1.8);
          paintSky(ctx, w, h, GROUND_Y, time * 3, {
            top: dayMix > 0.5 ? "#7dd3fc" : "#1e1b4b",
            bottom: dayMix > 0.5 ? "#fef9c3" : "#312e81",
            sunScale: 1, clouds: 2, ox: camX, seed: 9,
          });
          paintGround(ctx, w, h, time * 2, { y: GROUND_Y, color: "#65a34d", dark: "#3f7a34", ox: camX, seed: 10 });
          // The hero tree grows from sprout to young tree across the beat
          film.growth01 = p;
          drawSapling(ctx, 640 - camX, GROUND_Y + 2, 1.7, time * 2, 0.04 + p * 0.9);
          if (p > 0.55) {
            drawSapling(ctx, 480 - camX, GROUND_Y + 2, 1.1, time * 2 + 1, (p - 0.55) * 1.4);
            drawSapling(ctx, 800 - camX, GROUND_Y + 2, 1.2, time * 2 + 2, (p - 0.6) * 1.5);
          }
          // Rain burst mid-lapse feeds the growth
          if (p > 0.35 && p < 0.6) {
            for (let i = 0; i < 4; i++) {
              spawn(film, {
                x: Math.random() * w, y: -10, vx: -30, vy: 420,
                life: 0.8, maxLife: 0.8, size: 2, color: "rgba(125,211,252,0.9)", grav: 0,
              });
            }
          }
          drawHeroWorld(ctx, film, film.hero, GROUND_Y, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "green-result",
        title: "Plant a Tree. Protect Our Future.",
        weight: 1,
        camera: "wide",
        narration: "One tree may seem small, but millions of trees can transform our planet.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          film.green01 = Math.min(1, film.green01 + c.dt * 0.4);
          const hero = film.hero;
          hero.action = "walk";
          hero.facing = 1;
          hero.x += c.dt * 60;
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = hero.x - 90;
          friend.facing = 1;
          friend.action = "walk";
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, GROUND_Y, time, {
            top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 4, ox: camX, seed: 12,
          });
          paintGround(ctx, w, h, time, { y: GROUND_Y, color: "#57a85a", dark: "#357a3a", ox: camX, seed: 13 });
          // A lush row of mature trees
          for (const [wx, s] of [[420, 1.5], [700, 1.8], [980, 1.6], [1260, 1.4]] as const) {
            drawTree(ctx, wx - camX, GROUND_Y + 6, s, time, "#16a34a");
          }
          paintFlock(ctx, time, 4, 110, 22);
          drawSign(ctx, 1150 - camX, GROUND_Y - 6, 1, time, ["PLANT A TREE", "PROTECT OUR", "FUTURE"]);
          drawFriendWorld(ctx, film, GROUND_Y, time, camX);
          drawHeroWorld(ctx, film, hero, GROUND_Y, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// OCEAN — "Plastic waste reaching the ocean"
// ---------------------------------------------------------------------------

const OCEAN_Y = 400;

function oceanFilm(): Film {
  return {
    id: "ocean",
    title: "Plastic Waste Reaching the Ocean",
    createState: () => createFilmState(23),
    beats: [
      {
        id: "discard",
        title: "A Bottle Is Dropped",
        weight: 1,
        camera: "follow",
        narration: "It starts with something small — a plastic bottle tossed aside on the street.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const hero = film.hero;
          if (p < 0.7) {
            hero.x += c.dt * 120;
            hero.facing = 1;
            hero.action = "carry";
          } else {
            hero.action = "stand";
          }
          const camX = updateFollowCam(film, hero.x, w * 0.42);
          paintSky(ctx, w, h, OCEAN_Y, time, {
            top: "#7dd3fc", bottom: "#e0f2fe", sunScale: 1, clouds: 3, ox: camX, seed: 31,
          });
          paintGround(ctx, w, h, time, { y: OCEAN_Y, color: "#b8b2a7", dark: "#8a8478", ox: camX, seed: 32 });
          // Sidewalk slabs scrolling past
          ctx.fillStyle = "rgba(0,0,0,0.1)";
          for (let i = 0; i < 8; i++) {
            const sx = ((i * 240 - camX) % (w + 240) + (w + 240)) % (w + 240) - 120;
            ctx.fillRect(sx, OCEAN_Y + 30, 3, 60);
          }
          const heroSX = hero.x - camX;
          if (p < 0.7) {
            // Bottle carried in hands
            drawPlasticBottle(ctx, heroSX + 16, OCEAN_Y - 46, 0.8, time);
          } else {
            // Tossed: arcs to the ground and settles by the drain
            const tp = smooth(phase(p, 0.7, 0.85));
            const bx = lerp(heroSX + 16, heroSX + 120, tp);
            const by = lerp(OCEAN_Y - 46, OCEAN_Y - 8, tp) - Math.sin(tp * Math.PI) * 40;
            drawPlasticBottle(ctx, bx, by, 0.8, time);
            if (tp >= 1) drawDrain(ctx, heroSX + 150, OCEAN_Y + 4, 1, time);
          }
          drawHeroWorld(ctx, film, hero, OCEAN_Y, time, camX);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "drain",
        title: "Down the Drain",
        weight: 0.9,
        camera: "closeup",
        narration: "Rain washes the bottle into a drain, starting its journey to the sea.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          film.hero.action = "stand";
          const camX = updateFollowCam(film, 700, w * 0.5);
          paintSky(ctx, w, h, OCEAN_Y, time, {
            top: "#475569", bottom: "#94a3b8", sunScale: 0.8, clouds: 4, ox: camX, seed: 33,
          });
          paintGround(ctx, w, h, time, { y: OCEAN_Y, color: "#8a8f96", dark: "#5b6067", ox: camX, seed: 34 });
          // Rain streaks
          for (let i = 0; i < 40; i++) {
            const rx = rand(35, i) * w;
            const ry = ((rand(36, i) * h + time * 520) % (h + 40)) - 20;
            ctx.strokeStyle = "rgba(186,230,253,0.55)";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 4, ry + 14);
            ctx.stroke();
          }
          const drainX = 700 - camX;
          drawDrain(ctx, drainX, OCEAN_Y + 4, 1.3, time);
          // Bottle slides in, tips, and sinks through the grate
          const slideP = smooth(phase(t, 0, dur * 0.45));
          const sinkP = smooth(phase(t, dur * 0.45, dur * 0.8));
          const bx = lerp(drainX - 170, drainX, slideP);
          const by = lerp(OCEAN_Y - 8, OCEAN_Y + 2, sinkP);
          ctx.save();
          ctx.globalAlpha = 1 - smooth(phase(t, dur * 0.7, dur * 0.95));
          drawPlasticBottle(ctx, bx, by, 1, time);
          ctx.restore();
          // Gurgle rings on the grate
          if (sinkP > 0 && sinkP < 1) {
            ctx.strokeStyle = "rgba(186,230,253,0.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(drainX, OCEAN_Y + 2, 20 + sinkP * 26, 5 + sinkP * 7, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          drawHeroWorld(ctx, film, film.hero, OCEAN_Y, time, camX);
          stepParts(ctx, film, c.dt);
          void p;
        },
      },
      {
        id: "river",
        title: "Carried by the River",
        weight: 1.1,
        camera: "follow",
        narration: "Rivers act like conveyor belts, carrying plastic far from where it was dropped.",
        draw(c) {
          const { ctx, w, h, p, film, time } = c;
          const camX = updateFollowCam(film, 900 + p * 500, w * 0.5);
          paintSky(ctx, w, h, OCEAN_Y, time, {
            top: "#38bdf8", bottom: "#d9f99d", sunScale: 1, clouds: 3, ox: camX, seed: 37,
          });
          // River fills lower half, banks scroll
          ctx.fillStyle = "#4d7c0f";
          ctx.fillRect(0, OCEAN_Y - 70, w, 70);
          drawTree(ctx, 300 - camX * 0.7, OCEAN_Y - 66, 1, time);
          drawTree(ctx, 900 - camX * 0.7, OCEAN_Y - 66, 1.2, time);
          drawWaterWaves(ctx, w, h, OCEAN_Y - 40, time, "#0284c7");
          // Current streaks show flow direction
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 9; i++) {
            const sx = ((rand(38, i) * (w + 300) + time * (140 + i * 12)) % (w + 300)) - 150;
            const sy = OCEAN_Y + 10 + rand(39, i) * 90;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + 34, sy);
            ctx.stroke();
          }
          // The bottle rides the current left → right
          const bx = lerp(-60, w + 60, p);
          const by = OCEAN_Y + 30 + Math.sin(time * 2.2) * 7;
          drawPlasticBottle(ctx, bx, by, 1.1, time);
          // Fish leap as it passes
          for (let i = 0; i < 2; i++) {
            const jp = ((time * 0.5 + i * 0.5) % 1);
            const jx = lerp(100, w - 100, (p + i * 0.4) % 1);
            const jy = OCEAN_Y + 20 - Math.sin(jp * Math.PI) * 70;
            drawFish(ctx, jx, jy, 0.9, time + i, "#38bdf8");
          }
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "ocean-suffer",
        title: "Trouble at Sea",
        weight: 1.2,
        camera: "closeup",
        narration: "In the ocean, plastic endangers turtles, fish, and whales.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          const grey = 1 - film.clean01;
          const top = grey > 0.5 ? "#475569" : "#0369a1";
          paintSky(ctx, w, h, OCEAN_Y - 120, time, { top, bottom: "#bae6fd", sunScale: 0.9, clouds: 2, seed: 40 });
          drawWaterWaves(ctx, w, h, OCEAN_Y - 120, time, grey > 0.5 ? "#475569" : "#0284c7");
          // Floating plastic patch
          for (let i = 0; i < 4; i++) {
            drawPlasticBottle(
              ctx,
              w * (0.2 + 0.18 * i) + Math.sin(time * 0.9 + i * 2) * 14,
              OCEAN_Y - 40 + (i % 2) * 36,
              0.8 + (i % 2) * 0.3,
              time + i,
            );
          }
          // Sad turtle circles a bottle; whale passes behind
          drawTurtle(ctx, w * 0.42, OCEAN_Y + 30, 1.3, time, true);
          drawWhale(ctx, w * 0.75, OCEAN_Y + 110, 1.1, time + 2, grey > 0.5 ? "#475569" : "#3b82f6");
          drawFish(ctx, w * 0.2, OCEAN_Y + 80, 0.9, time, "#94a3b8");
          // Hero on the shore, pointing in alarm
          film.hero.x = 200;
          film.hero.action = p > 0.5 ? "point" : "stand";
          drawHeroWorld(ctx, film, film.hero, OCEAN_Y - 128, time, 0);
          // Beach strip
          ctx.fillStyle = "#e7d8b7";
          ctx.fillRect(0, OCEAN_Y - 140, w, 20);
          stepParts(ctx, film, c.dt);
          void t;
          void dur;
        },
      },
      {
        id: "cleanup",
        title: "The Cleanup",
        weight: 1.3,
        camera: "medium",
        narration: "But it is not too late — every bottle collected is a life protected.",
        draw(c) {
          const { ctx, w, h, t, dur, p, film, time } = c;
          // Water visibly clears as the beat progresses
          film.clean01 = smooth(p);
          const mix = (a: number, b: number) => Math.round(lerp(a, b, film.clean01));
          const water = `rgb(${mix(71, 2)},${mix(85, 132)},${mix(105, 199)})`;
          paintSky(ctx, w, h, OCEAN_Y - 120, time, { top: "#7dd3fc", bottom: "#e0f2fe", sunScale: 1, clouds: 3, seed: 41 });
          drawWaterWaves(ctx, w, h, OCEAN_Y - 120, time, water);
          ctx.fillStyle = "#e7d8b7";
          ctx.fillRect(0, OCEAN_Y - 140, w, 20);
          const hero = film.hero;
          hero.x = 330;
          const grabP = smooth(phase(t, dur * 0.15, dur * 0.45));
          const binP = smooth(phase(t, dur * 0.55, dur * 0.8));
          hero.action = grabP < 1 ? "walk" : binP < 1 ? "kneel" : "stand";
          // Bottle travels: water → hero hands → bin
          const bx = grabP < 1 ? lerp(620, 360, grabP) : lerp(360, 560, binP);
          const by = grabP < 1 ? OCEAN_Y - 60 : lerp(OCEAN_Y - 60, OCEAN_Y - 170, binP) - Math.sin(Math.min(1, Math.max(grabP, binP)) * Math.PI) * 30;
          if (binP < 1) drawPlasticBottle(ctx, bx, by, 0.9, time);
          drawRecycleBin(ctx, 560, OCEAN_Y - 138, 1.4, time);
          // Second bottle already binned + sparkle
          drawPlasticBottle(ctx, 560, OCEAN_Y - 160, 0.6, time + 3);
          if (binP > 0.8 && Math.random() < 0.6) {
            spawn(film, {
              x: 560 + (Math.random() - 0.5) * 40, y: OCEAN_Y - 180,
              vx: (Math.random() - 0.5) * 30, vy: -40, life: 0.8, maxLife: 0.8,
              size: 2.4, color: "#fde047",
            });
          }
          drawHeroWorld(ctx, film, hero, OCEAN_Y - 140, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
      {
        id: "clean-seas",
        title: "Clean Seas, Full of Life",
        weight: 1,
        camera: "wide",
        narration: "Clean seas are full of life — and it starts with refusing single-use plastic.",
        draw(c) {
          const { ctx, w, h, film, time } = c;
          paintSky(ctx, w, h, OCEAN_Y - 120, time, { top: "#38bdf8", bottom: "#fef9c3", sunScale: 1.1, clouds: 4, seed: 42 });
          drawWaterWaves(ctx, w, h, OCEAN_Y - 120, time, "#0284c7");
          ctx.fillStyle = "#f3e9c8";
          ctx.fillRect(0, OCEAN_Y - 140, w, 20);
          // Thriving school + happy turtle + whale
          for (let i = 0; i < 5; i++) {
            drawFish(ctx, w * 0.15 + i * 70, OCEAN_Y - 30 + Math.sin(time * 2 + i) * 12, 0.85, time + i * 0.8, i % 2 ? "#38bdf8" : "#f472b6");
          }
          drawTurtle(ctx, w * 0.6, OCEAN_Y + 60, 1.3, time, false);
          drawWhale(ctx, w * 0.8, OCEAN_Y + 120, 1.2, time + 1);
          paintFlock(ctx, time, 4, 90, 43);
          const hero = film.hero;
          hero.x = 250;
          hero.action = "stand";
          const friend = film.friend;
          friend.palette = FRIEND_PALETTE;
          friend.x = 330;
          friend.action = "stand";
          drawSign(ctx, 700, OCEAN_Y - 146, 1.1, time, ["CLEAN SEAS", "START WITH", "YOU"]);
          drawFriendWorld(ctx, film, OCEAN_Y - 140, time, 0);
          drawHeroWorld(ctx, film, hero, OCEAN_Y - 140, time, 0);
          stepParts(ctx, film, c.dt);
        },
      },
    ],
  };
}

export const FOREST_FILM = forestFilm();
export const OCEAN_FILM = oceanFilm();

