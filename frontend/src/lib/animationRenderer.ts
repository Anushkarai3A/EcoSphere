/**
 * Real-time Canvas 2D animation rendering engine for Ecosphere Animation Studio.
 * Renders environmental education scenes with parametric motion and captures them
 * into real video streams using MediaRecorder.
 */

import type { AnimationScene } from "./types";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number; // scene relative time in seconds
  globalTime: number; // total elapsed time in seconds
  scene: AnimationScene;
  sceneIndex: number;
  totalScenes: number;
}

// ---------------------------------------------------------------------------
// Drawing Primitives
// ---------------------------------------------------------------------------

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  topColor = "#0f172a",
  bottomColor = "#0284c7",
  pad = 0,
) {
  const grad = ctx.createLinearGradient(0, -pad, 0, h + pad);
  grad.addColorStop(0, topColor);
  grad.addColorStop(0.65, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
}

export function drawSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  const r = 36 * scale;

  // Outer glow
  const glow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
  glow.addColorStop(0, "rgba(251, 191, 36, 0.45)");
  glow.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Rotating rays
  ctx.save();
  ctx.rotate(time * 0.4);
  ctx.strokeStyle = "rgba(253, 224, 71, 0.85)";
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(0, r * 1.15);
    ctx.lineTo(0, r * 1.55);
    ctx.stroke();
  }
  ctx.restore();

  // Core disc
  const disc = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
  disc.addColorStop(0, "#fef08a");
  disc.addColorStop(0.7, "#facc15");
  disc.addColorStop(1, "#f59e0b");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  speed = 15,
) {
  ctx.save();
  const drift = (time * speed) % 1400;
  const currentX = ((x + drift + 200) % 1400) - 200;
  const currentY = y + Math.sin(time * 1.2 + x) * 4;
  ctx.translate(currentX, currentY);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.arc(22, -10, 28, 0, Math.PI * 2);
  ctx.arc(50, -5, 24, 0, Math.PI * 2);
  ctx.arc(70, 0, 18, 0, Math.PI * 2);
  ctx.arc(35, 12, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawWaterWaves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  waterY: number,
  time: number,
  baseColor = "#0284c7",
) {
  ctx.save();

  // Back deep wave
  ctx.fillStyle = "rgba(3, 105, 161, 0.4)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, waterY + 15);
  for (let x = 0; x <= w; x += 15) {
    const y = waterY + 15 + Math.sin(x * 0.012 + time * 1.8) * 9;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Mid wave
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, waterY);
  for (let x = 0; x <= w; x += 15) {
    const y = waterY + Math.sin(x * 0.015 - time * 2.2) * 11 + Math.cos(x * 0.008 + time) * 4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Water foam highlights
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 30) {
    const y = waterY + Math.sin(x * 0.015 - time * 2.2) * 11 + Math.cos(x * 0.008 + time) * 4;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.restore();
}

export function drawFish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  color = "#38bdf8",
) {
  ctx.save();
  const swimX = x + Math.cos(time * 1.5) * 40;
  const swimY = y + Math.sin(time * 2.2) * 12;
  const dir = Math.sin(time * 1.5) > 0 ? 1 : -1;

  ctx.translate(swimX, swimY);
  ctx.scale(dir * scale, scale);

  // Tail wag
  const wag = Math.sin(time * 12) * 6;

  // Tail fin
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-34, -14 + wag);
  ctx.lineTo(-28, 0);
  ctx.lineTo(-34, 14 + wag);
  ctx.closePath();
  ctx.fill();

  // Fish body
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fish eye
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(12, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(13, -3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Air bubbles
  const bubbleY = (time * 30) % 60;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.arc(20, -5 - bubbleY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawPlasticBottle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  color = "#93c5fd",
) {
  ctx.save();
  const driftX = x + Math.sin(time * 0.8) * 15;
  const driftY = y + Math.sin(time * 1.8 + x) * 8;
  const tilt = Math.sin(time * 1.2) * 0.25 - 0.2;

  ctx.translate(driftX, driftY);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);

  // Bottle body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-10, -22, 20, 44, 4);
  ctx.fill();

  // Cap
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.rect(-5, -28, 10, 6);
  ctx.fill();

  // Label
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-10, -10, 20, 14);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(-8, -4, 16, 2);

  // Microplastic sparkles
  ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
  ctx.beginPath();
  ctx.arc(15, 10 + Math.sin(time * 3) * 6, 2, 0, Math.PI * 2);
  ctx.arc(-14, 16 + Math.cos(time * 2.5) * 5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  leafColor = "#16a34a",
) {
  ctx.save();
  const sway = Math.sin(time * 1.4 + x * 0.05) * 0.05;
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.scale(scale, scale);

  // Trunk
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-6, -60);
  ctx.lineTo(6, -60);
  ctx.lineTo(10, 0);
  ctx.closePath();
  ctx.fill();

  // Foliage layers (lush canopy)
  ctx.fillStyle = leafColor;
  ctx.beginPath();
  ctx.arc(0, -75, 34, 0, Math.PI * 2);
  ctx.arc(-24, -62, 26, 0, Math.PI * 2);
  ctx.arc(24, -62, 26, 0, Math.PI * 2);
  ctx.arc(-16, -92, 22, 0, Math.PI * 2);
  ctx.arc(16, -92, 22, 0, Math.PI * 2);
  ctx.fill();

  // Leaf highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.arc(-10, -82, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
) {
  ctx.save();
  const flightX = ((x + time * 65) % 1350) - 50;
  const flightY = y + Math.sin(time * 3 + x) * 12;
  const wing = Math.sin(time * 9) * 12;

  ctx.translate(flightX, flightY);
  ctx.scale(scale, scale);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  // V-wings
  ctx.beginPath();
  ctx.moveTo(-14, wing);
  ctx.quadraticCurveTo(-6, -wing * 0.6, 0, 0);
  ctx.quadraticCurveTo(6, -wing * 0.6, 14, wing);
  ctx.stroke();

  ctx.restore();
}

export function drawWindTurbine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Tower
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-2, -90);
  ctx.lineTo(2, -90);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();

  // Rotor hub
  ctx.save();
  ctx.translate(0, -90);
  ctx.rotate(time * 3.5);

  // 3 blades
  ctx.fillStyle = "#f8fafc";
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(0, -48);
    ctx.lineTo(2, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Hub cap
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

export function drawSolarPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Stand
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -22);
  ctx.moveTo(-12, 0);
  ctx.lineTo(12, 0);
  ctx.stroke();

  // Angled panel
  ctx.fillStyle = "#1e3a8a";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-32, -32);
  ctx.lineTo(32, -42);
  ctx.lineTo(26, -18);
  ctx.lineTo(-38, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Grid lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -37);
  ctx.lineTo(-6, -13);
  ctx.stroke();

  ctx.restore();
}

export function drawFactory(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Building body
  ctx.fillStyle = "#334155";
  ctx.fillRect(-45, -55, 90, 55);

  // Sawtooth roof
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.moveTo(-45, -55);
  ctx.lineTo(-20, -75);
  ctx.lineTo(-20, -55);
  ctx.lineTo(10, -75);
  ctx.lineTo(10, -55);
  ctx.lineTo(45, -75);
  ctx.lineTo(45, -55);
  ctx.closePath();
  ctx.fill();

  // Chimneys
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(20, -100, 16, 45);
  ctx.fillRect(-35, -85, 14, 30);

  // Window grid
  ctx.fillStyle = "#facc15";
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillRect(-35 + c * 26, -42 + r * 18, 12, 10);
    }
  }

  ctx.restore();
}

export function drawSmoke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
) {
  ctx.save();
  ctx.translate(x, y);

  // Multiple rising puffs
  for (let i = 0; i < 5; i++) {
    const puffAge = ((time * 0.8 + i * 0.4) % 2.0) / 2.0;
    const puffY = -puffAge * 85 * scale;
    const puffX = Math.sin(time + i) * 14 * scale;
    const puffRadius = (10 + puffAge * 28) * scale;
    const alpha = (1 - puffAge) * 0.65;

    ctx.fillStyle = `rgba(100, 116, 139, ${alpha})`;
    ctx.beginPath();
    ctx.arc(puffX, puffY, puffRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawRecycleBin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
) {
  ctx.save();
  const bounce = Math.abs(Math.sin(time * 3)) * 4;
  ctx.translate(x, y - bounce);
  ctx.scale(scale, scale);

  // Bin body
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.moveTo(-18, -35);
  ctx.lineTo(18, -35);
  ctx.lineTo(14, 0);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();

  // Lid
  ctx.fillStyle = "#15803d";
  ctx.beginPath();
  ctx.roundRect(-22, -42, 44, 8, 3);
  ctx.fill();

  // Recycle symbol (chasing arrows)
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -18, 7, 0, Math.PI * 1.5);
  ctx.stroke();

  ctx.restore();
}

/** Tree stump: evidence of felled trees (deforestation beats). */
export function drawStump(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Roots
  ctx.strokeStyle = "#57300f";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-16, 2);
  ctx.moveTo(4, 0);
  ctx.lineTo(16, 2);
  ctx.stroke();
  // Stump body
  ctx.fillStyle = "#8a5a2b";
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.lineTo(-11, -22);
  ctx.lineTo(11, -22);
  ctx.lineTo(13, 0);
  ctx.closePath();
  ctx.fill();
  // Cut rings
  ctx.fillStyle = "#d9a866";
  ctx.beginPath();
  ctx.ellipse(0, -22, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a5a2b";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -22, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -22, 3.5, 1.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  // A couple of sorrowful falling leaves nearby
  const fall = (time * 22) % 60;
  ctx.fillStyle = "rgba(202,138,4,0.8)";
  ctx.beginPath();
  ctx.ellipse(20, -30 + fall * 0.7, 3, 2, fall * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Growth-stage sapling: growth 0 = freshly planted sprout, 1 = young tree.
 * Drive growth 0→1 over the scene for a real time-lapse effect.
 */
export function drawSapling(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  growth = 0.5,
) {
  const g = Math.max(0, Math.min(1, growth));
  const height = 14 + g * 66;
  const sway = Math.sin(time * 1.6 + x * 0.05) * (0.03 + g * 0.03);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.scale(scale, scale);
  // Mound of soil
  ctx.fillStyle = "#57300f";
  ctx.beginPath();
  ctx.ellipse(0, 1, 12 + g * 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stem (grows + thickens)
  ctx.strokeStyle = g < 0.35 ? "#4d7c0f" : "#6b3f14";
  ctx.lineWidth = 2 + g * 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(3, -height * 0.6, 0, -height);
  ctx.stroke();
  // Leaves appear progressively
  const leafCount = Math.floor(g * 9);
  const leafSpots: Array<[number, number, number]> = [
    [0, -height * 0.55, 7], [-7, -height * 0.7, 8], [7, -height * 0.75, 8],
    [-4, -height * 0.9, 9], [5, -height * 0.95, 9], [0, -height - 4, 10],
    [-10, -height * 0.82, 6], [10, -height * 0.6, 6], [0, -height * 0.4, 5],
  ];
  ctx.fillStyle = "#22c55e";
  for (let i = 0; i < Math.min(leafCount, leafSpots.length); i++) {
    const spot = leafSpots[i];
    if (!spot) continue;
    const flutter = Math.sin(time * 2.4 + i * 1.7) * 1.6;
    ctx.beginPath();
    ctx.ellipse(spot[0] + flutter, spot[1], spot[2] * (0.5 + g * 0.5), spot[2] * 0.62 * (0.5 + g * 0.5), flutter * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Highlight
  if (g > 0.25) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(-3, -height * 0.8, 5, 3.4, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Watering can tipping out animated droplets (planting beats). */
export function drawWateringCan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const tilt = -0.5 + Math.sin(time * 1.5) * 0.05;
  ctx.rotate(tilt);
  // Body
  ctx.fillStyle = "#0ea5e9";
  ctx.beginPath();
  ctx.roundRect(-16, -22, 30, 24, 4);
  ctx.fill();
  // Spout
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(12, -14);
  ctx.lineTo(30, -4);
  ctx.stroke();
  // Rose head
  ctx.fillStyle = "#0369a1";
  ctx.beginPath();
  ctx.arc(31, -3, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Handle
  ctx.strokeStyle = "#0369a1";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.quadraticCurveTo(-26, -14, -24, 0);
  ctx.stroke();
  ctx.restore();
  // Falling droplets (world space, below the spout)
  ctx.save();
  ctx.fillStyle = "rgba(125,211,252,0.9)";
  for (let i = 0; i < 6; i++) {
    const cycle = ((time * 1.6 + i / 6) % 1);
    const dx = x + 30 * scale + Math.sin((time + i) * 3) * 2;
    const dy = y - 2 * scale + cycle * 46 * scale;
    ctx.globalAlpha = 1 - cycle * 0.6;
    ctx.beginPath();
    ctx.ellipse(dx, dy, 2.2 * scale, 3.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Car with genuinely rotating wheels (traffic beats). dir: 1 = right, -1 = left. */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  color = "#ef4444",
  dir: 1 | -1 = 1,
) {
  ctx.save();
  ctx.translate(x, y + Math.abs(Math.sin(time * 9)) * -1.2);
  ctx.scale(dir * scale, scale);
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-42, -26, 84, 22, 7);
  ctx.fill();
  // Cabin
  ctx.fillStyle = "#bae6fd";
  ctx.beginPath();
  ctx.roundRect(-26, -42, 48, 20, 6);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(-2, -42, 4, 20);
  // Wheels (rotate with time)
  const spin = time * 10;
  for (const wx of [-26, 26]) {
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(wx, -2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2.4;
    for (let s = 0; s < 3; s++) {
      const a = spin + (s * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(wx, -2);
      ctx.lineTo(wx + Math.cos(a) * 7, -2 + Math.sin(a) * 7);
      ctx.stroke();
    }
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(wx, -2, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Exhaust puffs
  const puff = (time * 1.4) % 1;
  ctx.fillStyle = `rgba(100,116,139,${0.5 * (1 - puff)})`;
  ctx.beginPath();
  ctx.arc(-48 - puff * 22, -8 - puff * 8, 3 + puff * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Sea turtle: flapping flippers, bobbing swim. */
export function drawTurtle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  sad = false,
) {
  ctx.save();
  const swimX = x + Math.cos(time * 0.9) * 26;
  const swimY = y + Math.sin(time * 1.7) * 9;
  ctx.translate(swimX, swimY);
  ctx.scale(scale, scale);
  const flap = Math.sin(time * 3.2) * 0.55;
  // Back flippers
  ctx.fillStyle = "#15803d";
  ctx.beginPath();
  ctx.ellipse(-14, 8, 7, 3.4, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Front flippers (flap)
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 4, 2);
    ctx.rotate(side * (0.5 + flap));
    ctx.beginPath();
    ctx.ellipse(side * 12, 4, 11, 4, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Shell
  ctx.fillStyle = "#166534";
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#22c55e";
  for (const [px, py] of [[-7, -4], [0, -6], [7, -4], [-4, 3], [5, 3]] as const) {
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(20, -3, 6, 0, Math.PI * 2);
  ctx.fill();
  // Eye: droopy when sad (entangled), bright otherwise
  ctx.fillStyle = "#052e16";
  if (sad) {
    ctx.fillRect(21, -4, 2.4, 1.2);
    ctx.strokeStyle = "#052e16";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(24, 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(21.5, -4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Whale silhouette cruising with tail flukes. */
export function drawWhale(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  color = "#3b82f6",
) {
  ctx.save();
  const swimX = x + Math.cos(time * 0.6) * 34;
  const swimY = y + Math.sin(time * 1.1) * 10;
  ctx.translate(swimX, swimY);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail stalk + flukes (swish)
  const swish = Math.sin(time * 2.4) * 0.35;
  ctx.save();
  ctx.translate(-40, 0);
  ctx.rotate(swish);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, -12);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-16, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Dorsal fin
  ctx.beginPath();
  ctx.moveTo(-6, -15);
  ctx.quadraticCurveTo(2, -30, 10, -14);
  ctx.closePath();
  ctx.fill();
  // Eye + spout
  ctx.fillStyle = "#eff6ff";
  ctx.beginPath();
  ctx.arc(28, -4, 2.4, 0, Math.PI * 2);
  ctx.fill();
  if (Math.sin(time * 0.8) > 0.55) {
    ctx.fillStyle = "rgba(191,219,254,0.7)";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(18 + i * 3, -22 - i * 7, 2.5 - i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Water tap: handle rotates to open/close; stream flows when open01. */
export function drawTap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  open01 = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Pipe + body
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.roundRect(-8, -46, 16, 30, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-8, -46, 30, 12, 4);
  ctx.fill();
  ctx.fillStyle = "#64748b";
  ctx.fillRect(18, -34, 6, 18);
  // Handle (rotates with openness)
  ctx.save();
  ctx.translate(0, -50);
  ctx.rotate(-0.5 + open01 * 1.1 + Math.sin(time * 30) * 0.02 * (1 - open01));
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.restore();
  // Stream
  if (open01 > 0.03) {
    const wob = Math.sin(time * 18) * 1.2;
    ctx.fillStyle = "rgba(125,211,252,0.85)";
    ctx.beginPath();
    ctx.moveTo(19, -16);
    ctx.lineTo(23, -16);
    ctx.lineTo(23 + wob, 26);
    ctx.lineTo(19 + wob, 26);
    ctx.closePath();
    ctx.fill();
    // Splash
    for (let i = 0; i < 4; i++) {
      const a = time * 6 + (i * Math.PI * 2) / 4;
      ctx.beginPath();
      ctx.arc(21 + Math.cos(a) * 7, 28 + Math.sin(a * 1.3) * 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Simple house; windows glow when powered (lit01). */
export function drawHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  lit01 = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Walls
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.rect(-40, -44, 80, 44);
  ctx.fill();
  // Roof
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.moveTo(-48, -44);
  ctx.lineTo(0, -72);
  ctx.lineTo(48, -44);
  ctx.closePath();
  ctx.fill();
  // Door
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.roundRect(-8, -26, 16, 26, 2);
  ctx.fill();
  // Windows glow with power
  const glow = 0.25 + 0.75 * lit01;
  ctx.fillStyle = `rgba(253,224,71,${glow})`;
  ctx.beginPath();
  ctx.rect(-32, -34, 16, 14);
  ctx.rect(16, -34, 16, 14);
  ctx.fill();
  if (lit01 > 0.5) {
    ctx.fillStyle = "rgba(253,224,71,0.18)";
    ctx.beginPath();
    ctx.arc(-24, -27, 20, 0, Math.PI * 2);
    ctx.arc(24, -27, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  // Smoke from chimney when unpowered (fossil) vs clean air
  if (lit01 < 0.5 && Math.sin(time * 0.7) > -0.2) {
    drawSmoke(ctx, 30, -78, 0.5, time);
  }
  ctx.restore();
}

/** Storm drain grate set into the ground; bottle drops through. */
export function drawDrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  _time = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Pit
  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Grate bars
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 9, -7);
    ctx.lineTo(i * 9, 7);
    ctx.stroke();
  }
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Wooden sign board with short text (sanctuary / pledge messages). */
export function drawSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  lines: string[] = ["ECO ZONE"],
) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 1.3) * 1);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#6b3f14";
  ctx.fillRect(-3, -34, 6, 34);
  ctx.fillStyle = "#a16207";
  ctx.strokeStyle = "#57300f";
  ctx.lineWidth = 2;
  const h = 14 + lines.length * 11;
  ctx.beginPath();
  ctx.roundRect(-44, -34 - h, 88, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fefce8";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => {
    ctx.fillText(line.slice(0, 20), 0, -34 - h + 12 + i * 11);
  });
  ctx.restore();
}

/**
 * Consistent 2D educational-cartoon protagonist ("Eco Hero"): green tee,
 * denim-blue pants, brown skin-tone head with hair, simple friendly face.
 * Same palette/proportions in every scene for character consistency.
 *
 * Actions: "walk" (full gait cycle), "stand", "bounce", "kneel" (planting),
 * "point" (presenting), "carry" (holding a sapling/watering can), "wipe".
 */
export interface HeroPalette {
  skin: string;
  hair: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  shoe: string;
}

export const HERO_PALETTE: HeroPalette = {
  skin: "#f2b880",
  hair: "#3f2d20",
  shirt: "#10b981",
  shirtDark: "#047857",
  pants: "#1d4ed8",
  shoe: "#422006",
};

export const FRIEND_PALETTE: HeroPalette = {
  skin: "#c98d5e",
  hair: "#14100c",
  shirt: "#f59e0b",
  shirtDark: "#b45309",
  pants: "#334155",
  shoe: "#1c0a00",
};

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time = 0,
  action = "walk",
  palette: HeroPalette = HERO_PALETTE,
) {
  const SKIN = palette.skin;
  const HAIR = palette.hair;
  const SHIRT = palette.shirt;
  const PANTS = palette.pants;
  const SHOE = palette.shoe;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const walking = action === "walk" || action === "carry";
  const phase = time * 7; // gait frequency (~1.1 steps/sec per leg)
  const swing = walking ? Math.sin(phase) : 0;
  const lift = walking ? Math.max(0, Math.sin(phase + Math.PI / 2)) : 0;
  const lift2 = walking ? Math.max(0, Math.sin(phase - Math.PI / 2 + Math.PI)) : 0;
  const bob = walking ? Math.abs(Math.sin(phase)) * 2.2 : action === "bounce" ? Math.abs(Math.sin(time * 4)) * 5 : 0;
  const kneel = action === "kneel" ? 1 : 0;

  const hipY = -26 + bob * 0.4 - kneel * 10;
  const shoulderY = hipY - 16;
  const headY = shoulderY - 11;

  // Shadow (grounds the character)
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 13, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- Legs (two-segment with knees, alternating gait) ----
  const drawLeg = (side: 1 | -1, swingAmt: number, liftAmt: number) => {
    const hipX = side * 3.4;
    const footX = hipX + swingAmt * 7;
    const footY = -liftAmt * 7;
    const kneeX = hipX + swingAmt * 4.5;
    const kneeY = hipY + 7 - liftAmt * 2;
    ctx.strokeStyle = PANTS;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // Shoe
    ctx.fillStyle = SHOE;
    ctx.beginPath();
    ctx.ellipse(footX + side * 1.5, footY - 0.5, 4.4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  if (kneel > 0) {
    // Kneeling: one knee on ground, one foot planted
    ctx.strokeStyle = PANTS;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3, hipY);
    ctx.lineTo(-7, 0);
    ctx.lineTo(2, 0);
    ctx.moveTo(3, hipY);
    ctx.lineTo(9, -4);
    ctx.lineTo(9, 0);
    ctx.stroke();
  } else {
    drawLeg(1, swing, lift);
    drawLeg(-1, -swing, lift2);
  }

  // ---- Torso ----
  const lean = walking ? 0.06 : 0;
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.fillStyle = SHIRT;
  ctx.beginPath();
  ctx.roundRect(-8, -17, 16, 17, 4);
  ctx.fill();
  // Collar
  ctx.fillStyle = palette.shirtDark;
  ctx.beginPath();
  ctx.roundRect(-4, -17, 8, 4, 2);
  ctx.fill();
  ctx.restore();

  // ---- Arms (swing opposite to legs) ----
  const armSwing = walking ? Math.sin(phase + Math.PI) * 7 : Math.sin(time * 2) * 1.5;
  const drawArm = (side: 1 | -1, sw: number, raised: boolean) => {
    const shX = side * 8.5;
    const shY = shoulderY + 1;
    const handX = shX + side * 2 + (raised ? side * 4 : sw * 0.6);
    const handY = raised ? shY - 12 : shY + 11 + Math.abs(sw) * 0.3;
    const elbowX = shX + side * 1.5 + (raised ? side * 3 : sw * 0.35);
    const elbowY = (shY + handY) / 2;
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    // Sleeve stub
    ctx.moveTo(shX, shY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.fillStyle = SHIRT;
    ctx.beginPath();
    ctx.arc(shX, shY, 3.4, 0, Math.PI * 2);
    ctx.fill();
  };
  if (action === "point") {
    drawArm(1, 0, true);
    drawArm(-1, 0, false);
  } else if (action === "wipe") {
    // Wiping sweat: right hand to forehead, slight lean, sweat drops
    drawArm(1, 0, true);
    drawArm(-1, 0, false);
    ctx.fillStyle = "rgba(125,211,252,0.95)";
    const drip = (time * 2.2) % 1;
    ctx.beginPath();
    ctx.ellipse(10, -46 + drip * 10, 1.8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-9, -44 + ((drip + 0.5) % 1) * 8, 1.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (action === "carry") {
    // Both arms forward holding (sapling/can in front)
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, shoulderY + 1);
    ctx.lineTo(-2, shoulderY + 8);
    ctx.moveTo(8, shoulderY + 1);
    ctx.lineTo(2, shoulderY + 8);
    ctx.stroke();
  } else {
    drawArm(1, armSwing, false);
    drawArm(-1, -armSwing, false);
  }

  // ---- Head + face + hair (consistent identity) ----
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, headY, 8.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair cap
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(0, headY - 1.5, 8.5, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-5.5, headY - 5, 3.2, 0, Math.PI * 2);
  ctx.arc(5.5, headY - 5, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // Eyes (blink every ~4s)
  const blink = (time % 4.1) < 0.12 ? 0.15 : 1;
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(-3, headY + 0.5, 1.3, 1.6 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(3, headY + 0.5, 1.3, 1.6 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = "#7c2d12";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, headY + 3, 3.4, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  // Cheeks
  ctx.fillStyle = "rgba(244,114,182,0.5)";
  ctx.beginPath();
  ctx.arc(-5, headY + 3, 1.4, 0, Math.PI * 2);
  ctx.arc(5, headY + 3, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Subtitle and HUD Overlay
// ---------------------------------------------------------------------------

export function drawCinematicOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: AnimationScene,
  sceneIndex: number,
  totalScenes: number,
  _time?: number,
) {
  ctx.save();

  // Top header bar (translucent dark gradient)
  const topGrad = ctx.createLinearGradient(0, 0, 0, 60);
  topGrad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
  topGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, 60);

  // Scene indicator pill
  ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
  ctx.beginPath();
  ctx.roundRect(24, 18, 120, 24, 12);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`SCENE ${sceneIndex + 1} OF ${totalScenes}`, 84, 30);

  // Bottom Subtitle Ribbon (high contrast readable box)
  const bottomGrad = ctx.createLinearGradient(0, h - 110, 0, h);
  bottomGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
  bottomGrad.addColorStop(0.35, "rgba(15, 23, 42, 0.85)");
  bottomGrad.addColorStop(1, "rgba(15, 23, 42, 0.98)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, h - 110, w, 110);

  // Narration subtitle text
  const subtitle = scene.narration || scene.dialogue || scene.visualDescription || "";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Text wrap if long
  if (subtitle.length > 75) {
    const mid = subtitle.lastIndexOf(" ", 75);
    const line1 = subtitle.slice(0, mid > 0 ? mid : 75);
    const line2 = subtitle.slice(mid > 0 ? mid + 1 : 75);
    ctx.fillText(line1, w / 2, h - 62);
    ctx.fillText(line2, w / 2, h - 38);
  } else {
    ctx.fillText(subtitle, w / 2, h - 50);
  }

  // Educational point badge at bottom
  if (scene.educational_point || scene.keyTakeaway) {
    const point = `Key takeaway: ${scene.educational_point || scene.keyTakeaway}`;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(52, 211, 153, 0.95)";
    ctx.fillText(point, w / 2, h - 18);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Depth layering: explicit paint order so the protagonist is never
// accidentally hidden behind set dressing. Lower layers paint first.
// 0 sky · 1 structures · 2 nature/props · 3 tools/animals · 4 protagonist · 5 weather
// ---------------------------------------------------------------------------

const ELEMENT_LAYER: Record<string, number> = {
  sun: 0, cloud: 0, bird: 0, butterfly: 0, bee: 0, mountain: 0,
  factory: 1, smoke: 1, building: 1, wind_turbine: 1, solar_panel: 1,
  tree: 2, plant: 2, sapling: 2, stump: 2, flower: 2, leaf: 2,
  water: 2, ocean: 2, river: 2, algae: 2, fish: 2, whale: 2, turtle: 2,
  plastic: 2,
  recycling_bin: 3, car: 3, animal: 3, watering_can: 3,
  character: 4, student: 4,
  rain: 5,
};

function layerOf(type: string): number {
  return ELEMENT_LAYER[type] ?? 2;
}

/** Procedural fallback camera when the storyboard omits direction. */
export function defaultCameraFor(sceneIndex: number, totalScenes: number): string {
  if (totalScenes <= 1) return "wide";
  if (sceneIndex === 0 || sceneIndex === totalScenes - 1) return "wide";
  const middle = ["follow", "closeup", "medium", "up"];
  return middle[(sceneIndex - 1) % middle.length] ?? "medium";
}

interface CameraPose {
  scale: number;
  cx: number;
  cy: number;
}

/** Slow cinematic drift: subtle push-in / pan that supports the story beat. */
export function cameraPose(camera: string, progress: number, w: number, h: number): CameraPose {
  const p = Math.max(0, Math.min(1, progress));
  switch (camera) {
    case "follow": // track action laterally
      return { scale: 1.12, cx: w * (0.4 + 0.2 * p), cy: h * 0.52 };
    case "closeup": // detail / explanation
      return { scale: 1.32 + 0.1 * p, cx: w * 0.5, cy: h * 0.46 };
    case "medium": // character action
      return { scale: 1.14 + 0.04 * p, cx: w * (0.52 - 0.04 * p), cy: h * 0.55 };
    case "up": // rising time-lapse
      return { scale: 1.06 + 0.12 * p, cx: w * 0.5, cy: h * (0.58 - 0.12 * p) };
    case "static":
      return { scale: 1, cx: w / 2, cy: h / 2 };
    case "wide":
    default: // establishing shot, gentle push-in
      return { scale: 1 + 0.06 * p, cx: w * (0.5 + 0.02 * p), cy: h * 0.5 };
  }
}

// ---------------------------------------------------------------------------
// Scene Dispatcher
// ---------------------------------------------------------------------------

export function renderSceneFrame(rCtx: RenderContext) {
  const { ctx, width: w, height: h, time, scene, sceneIndex, totalScenes } = rCtx;
  const duration = scene.duration > 0 ? scene.duration : 10;
  const progress = Math.max(0, Math.min(1, time / duration));
  const camera = typeof scene.camera === "string" && scene.camera.length > 0
    ? scene.camera
    : defaultCameraFor(sceneIndex, totalScenes);
  const pose = cameraPose(camera, progress, w, h);

  // Camera transform applies to the WORLD (background + elements), never to
  // the subtitle overlay, which stays locked for readability.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(pose.scale, pose.scale);
  ctx.translate(-pose.cx, -pose.cy);

  // 1. Background gradient (overscanned so zoom never reveals edges)
  const pad = Math.max(w, h) * 0.3;
  drawBackground(
    ctx,
    w,
    h,
    scene.background_top || "#0f172a",
    scene.background_bottom || "#0284c7",
    pad,
  );

  // 2. Elements, painted back-to-front by explicit depth layer.
  const elements = (scene.elements || [])
    .map((el, i) => ({ el, i }))
    .sort((a, b) => layerOf(a.el.type) - layerOf(b.el.type) || a.i - b.i)
    .map(({ el }) => el);

  // If scene elements exist, render them
  for (const el of elements) {
    const elX = (el.x / 100) * w;
    const elY = (el.y / 100) * h;
    const scale = el.scale || 1.0;
    const color = el.color || undefined;

    switch (el.type) {
      case "sun":
        drawSun(ctx, elX, elY, scale, time);
        break;
      case "cloud":
        drawCloud(ctx, elX, elY, scale, time);
        break;
      case "water":
      case "ocean":
      case "river":
        drawWaterWaves(ctx, w, h, elY, time, color);
        break;
      case "fish":
        drawFish(ctx, elX, elY, scale, time, color);
        break;
      case "plastic":
        drawPlasticBottle(ctx, elX, elY, scale, time, color);
        break;
      case "tree":
      case "plant":
      case "sapling":
        drawTree(ctx, elX, elY, scale, time, color);
        break;
      case "bird":
        drawBird(ctx, elX, elY, scale, time);
        break;
      case "wind_turbine":
        drawWindTurbine(ctx, elX, elY, scale, time);
        break;
      case "solar_panel":
        drawSolarPanel(ctx, elX, elY, scale);
        break;
      case "factory":
        drawFactory(ctx, elX, elY, scale);
        break;
      case "smoke":
        drawSmoke(ctx, elX, elY, scale, time);
        break;
      case "recycling_bin":
        drawRecycleBin(ctx, elX, elY, scale, time);
        break;
      case "character":
      case "student":
        drawCharacter(ctx, elX, elY, scale, time, el.motion === "none" ? "stand" : el.motion || "walk");
        break;
      case "stump":
        drawStump(ctx, elX, elY, scale, time);
        break;
      case "sapling":
        drawSapling(
          ctx,
          elX,
          elY,
          scale,
          time,
          el.g0 !== undefined || el.g1 !== undefined
            ? (el.g0 ?? 0) + ((el.g1 ?? 1) - (el.g0 ?? 0)) * progress
            : 0.55,
        );
        break;
      case "watering_can":
        drawWateringCan(ctx, elX, elY, scale, time);
        break;
      default:
        // Default floating eco particle
        ctx.save();
        ctx.fillStyle = color || "#10b981";
        ctx.beginPath();
        ctx.arc(elX + Math.sin(time + elX) * 10, elY + Math.cos(time + elY) * 6, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
  }

  // 3. Fallback visuals if no explicit elements provided in scene
  if (elements.length === 0) {
    drawSun(ctx, w * 0.8, h * 0.22, 1.2, time);
    drawCloud(ctx, w * 0.2, h * 0.18, 1.0, time);
    drawCloud(ctx, w * 0.65, h * 0.26, 0.8, time);
    drawTree(ctx, w * 0.25, h * 0.68, 1.2, time);
    drawTree(ctx, w * 0.75, h * 0.70, 1.1, time);
    drawWaterWaves(ctx, w, h, h * 0.72, time);
  }

  ctx.restore(); // end camera transform — overlay stays screen-locked

  // 4. Cinematic Overlay (Subtitles, Takeaways, Scene HUD)
  drawCinematicOverlay(ctx, w, h, scene, sceneIndex, totalScenes, time);
}
