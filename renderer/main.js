// App assembly and integration.

import { generateShape } from './shapes.js';
import { createRoulette } from './roulette.js';
import { createAnimator } from './animator.js';
import { bindControls } from './controls.js';

// --- Default settings ---
const settings = {
  shape: { type: 'circle', sides: 6, points: 5, aspect: 1.5, size: 0.8 },
  wheel: { r: 0.3, d: 0.4, side: 'inside', type: 'circle' },
  draw: { speed: 30, lineWidth: 1.5 },
  color: { mode: 'cycle', fixed: '#00ffcc', cycleSpeed: 1 },
  background: '#000000',
};

const canvas = document.getElementById('stage');
const panelEl = document.getElementById('panel');

const animator = createAnimator(canvas);

// Render mode: 'manual' (draw once) or 'auto' (continuous random loop with fade).
let mode = 'manual';

// --- Build + start pipeline ---
function buildAndStart() {
  applyCurve();
  applyStyle();
  animator.clear();
  animator.start();
}

// Regenerate the roulette curve from the current settings without restarting.
// The curve draws until it returns to its exact starting point (closure) rather
// than for a fixed number of loops.
function applyCurve() {
  const shape = generateShape(settings.shape.type, settings.shape);
  const roulette = createRoulette(shape, settings.wheel);
  animator.setCurve(roulette, roulette.getClosureLoops());

  // Manual mode shows a schematic of the base shape, the rolling wheel, and the
  // pen offset. Auto mode hides it.
  if (mode === 'manual') {
    const g = roulette.getWheelGeometry(0);
    animator.setGuides({ base: shape.points, wheel: g.outline, center: g.center, pen: g.pen });
  } else {
    animator.setGuides(null);
  }
}

function applyStyle() {
  animator.setStyle({
    lineWidth: settings.draw.lineWidth,
    color: settings.color,
    background: settings.background,
    speed: settings.draw.speed,
  });
}

// --- Randomize ---
// Mutate `settings` in place with a fresh random design (no rebuild side effect).
function randomizeSettings() {
  const types = ['circle', 'rectangle', 'polygon', 'star'];
  const sides_list = ['inside', 'outside'];
  settings.shape.type = types[Math.floor(Math.random() * types.length)];
  settings.wheel.side = sides_list[Math.floor(Math.random() * 2)];

  settings.shape.sides = 3 + Math.floor(Math.random() * 8);
  settings.shape.points = 3 + Math.floor(Math.random() * 7);
  settings.shape.size = 0.6 + Math.random() * 0.35;
  settings.shape.aspect = 1 + Math.random() * 1.5;
  settings.wheel.d = 0.2 + Math.random() * 0.6;
  settings.wheel.type = 'circle'; // circle wheels close exactly

  // Pick a wheel radius that makes the curve close exactly after a few loops.
  setClosingWheelRadius();

  settings.color.mode = Math.random() > 0.3 ? 'cycle' : 'fixed';
  settings.color.fixed = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;
  settings.color.cycleSpeed = 0.5 + Math.random() * 3;
  settings.draw.lineWidth = 0.5 + Math.random() * 2.5;
}

// Closure happens when length / (2π r) is a rational p/q (closes in q loops).
// Solving for r given a target ratio p/q makes any base shape close exactly,
// in a small number of loops. We try ratios in random order and take the first
// that lands the radius inside the usable slider range.
function setClosingWheelRadius() {
  const shape = generateShape(settings.shape.type, settings.shape);
  const L = shape.length;
  const ratios = [[3, 1], [4, 1], [5, 1], [5, 2], [7, 2], [7, 3], [8, 3], [9, 2], [5, 3], [7, 4], [9, 4], [11, 3]];
  const order = ratios.slice().sort(() => Math.random() - 0.5);
  for (const [p, q] of order) {
    const r = (L * q) / (2 * Math.PI * p);
    if (r >= 0.06 && r <= 0.9) { settings.wheel.r = r; return; }
  }
  settings.wheel.r = Math.min(0.9, Math.max(0.06, L / (2 * Math.PI * 4)));
}

function randomize() {
  randomizeSettings();
  buildAndStart();
}

// A dark, saturated random background so strokes stay legible.
function randomBackground() {
  return `hsl(${Math.floor(Math.random() * 360)}, ${40 + Math.floor(Math.random() * 40)}%, ${4 + Math.floor(Math.random() * 9)}%)`;
}

// Each auto drawing should take somewhere in this window to complete.
const AUTO_MIN_SEC = 10;
const AUTO_MAX_SEC = 30;

// Auto mode: curated random settings chosen to look good — classic spirograph
// bases, a bold pen offset, full-canvas size, and cycling colour. Closure is kept
// to a few loops and the draw speed is timed separately (see startAutoDrawing).
function randomizeAuto() {
  // Rectangle roulettes read as the least "spirograph-like", so favour the
  // rounder bases that produce symmetric, pleasing patterns.
  const types = ['circle', 'polygon', 'star', 'circle'];
  settings.shape.type = types[Math.floor(Math.random() * types.length)];
  settings.wheel.side = Math.random() < 0.5 ? 'inside' : 'outside';

  settings.shape.sides = 3 + Math.floor(Math.random() * 6);   // 3..8
  settings.shape.points = 5 + Math.floor(Math.random() * 4);  // 5..8
  settings.shape.size = 0.78 + Math.random() * 0.16;          // fills the frame
  settings.shape.aspect = 1.3 + Math.random() * 0.4;
  settings.wheel.d = 0.35 + Math.random() * 0.5;              // bold, looping pen
  settings.wheel.type = 'circle';                             // closes exactly

  // Curated closure ratios — enough lobes to be interesting, few enough loops
  // to stay clean. setClosingWheelRadius makes the curve close exactly.
  setClosingWheelRadius();

  settings.color.mode = 'cycle';                              // cycling reads best
  settings.color.cycleSpeed = 0.6 + Math.random() * 1.8;
  settings.color.fixed = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;
  settings.draw.lineWidth = 1.0 + Math.random() * 1.4;

  settings.background = randomBackground();
  syncAutoUI();
}

// Keep the panel honest about the values auto mode is driving.
function syncAutoUI() {
  const speedEl = document.getElementById('draw-speed');
  if (speedEl) speedEl.value = settings.draw.speed;
  const bgEl = document.getElementById('background');
  // <input type=color> needs a hex value; skip hsl() backgrounds.
  if (bgEl && settings.background.startsWith('#')) bgEl.value = settings.background;
}

// Build one auto drawing: pick settings, set the curve, then derive the draw
// speed so it completes within the target time window. Used both to start auto
// mode and as the per-completion callback.
function startAutoDrawing() {
  randomizeAuto();
  applyCurve(); // sets the curve + closure loops, so totalT is known
  const target = AUTO_MIN_SEC + Math.random() * (AUTO_MAX_SEC - AUTO_MIN_SEC);
  settings.draw.speed = animator.speedForDuration(target);
  applyStyle();
}

function setMode(newMode) {
  mode = newMode;
  if (mode === 'auto') {
    animator.setAutoMode(true, startAutoDrawing);
    startAutoDrawing();
    animator.clear();
    animator.start();
  } else {
    animator.setAutoMode(false);
    buildAndStart();
  }
}

// --- Controls ---
bindControls(panelEl, settings, {
  onChange(s, structural) {
    if (structural) {
      buildAndStart();
    } else {
      applyStyle();
    }
  },
  onRandomize: randomize,
  onRestart: buildAndStart,
  onSavePng() {
    const dataUrl = animator.savePng();
    window.api?.savePng(dataUrl);
  },
});

// --- Render mode (manual / auto) ---
document.getElementById('render-mode')?.addEventListener('change', (e) => {
  setMode(e.target.value);
});

// --- Resize ---
window.addEventListener('resize', () => animator.onResize());

// --- Init ---
animator.onResize();
buildAndStart();
