// Issue #11 + #10: App assembly, integration, and audio->visual mapping

import { generateShape } from './shapes.js';
import { createRoulette } from './roulette.js';
import { createAnimator } from './animator.js';
import { createAudioEngine } from './audio.js';
import { bindControls } from './controls.js';

// --- Default settings (epic #1 contract) ---
const settings = {
  shape: { type: 'circle', sides: 6, points: 5, aspect: 1.5, size: 0.8 },
  wheel: { r: 0.3, d: 0.4, side: 'inside' },
  draw: { speed: 30, loops: 10, lineWidth: 1.5 },
  color: { mode: 'cycle', fixed: '#00ffcc', cycleSpeed: 1 },
  background: '#000000',
  audio: {
    enabled: false,
    source: 'file',
    mappings: {
      level:    { enabled: true, sensitivity: 1 },
      bass:     { enabled: true, sensitivity: 1 },
      spectrum: { enabled: true, sensitivity: 1 },
      beat:     { enabled: true, sensitivity: 1 },
    },
  },
};

const canvas = document.getElementById('stage');
const panelEl = document.getElementById('panel');

const animator = createAnimator(canvas);
const audioEngine = createAudioEngine();

let systemAudioStream = null;

// --- Build + start pipeline ---
function buildAndStart() {
  const shape = generateShape(settings.shape.type, settings.shape);
  const roulette = createRoulette(shape, settings.wheel);
  animator.setCurve(roulette, settings.draw.loops);
  applyStyle();
  animator.clear();
  animator.start();
}

function applyStyle() {
  animator.setStyle({
    lineWidth: settings.draw.lineWidth,
    color: settings.color,
    background: settings.background,
    speed: settings.draw.speed,
    loops: settings.draw.loops,
  });
}

// --- Randomize ---
function randomize() {
  const types = ['circle', 'rectangle', 'polygon', 'star'];
  const sides_list = ['inside', 'outside'];
  settings.shape.type = types[Math.floor(Math.random() * types.length)];
  settings.wheel.side = sides_list[Math.floor(Math.random() * 2)];

  // Favor coprime-ish ratios for circles
  const rVals = [1/3, 2/5, 3/7, 1/4, 2/7, 3/8, 1/5, 3/11, 5/13];
  const rv = rVals[Math.floor(Math.random() * rVals.length)];
  settings.wheel.r = rv;
  settings.wheel.d = 0.2 + Math.random() * 0.6;

  settings.shape.sides = 3 + Math.floor(Math.random() * 8);
  settings.shape.points = 3 + Math.floor(Math.random() * 7);
  settings.shape.size = 0.6 + Math.random() * 0.35;
  settings.shape.aspect = 1 + Math.random() * 1.5;

  settings.color.mode = Math.random() > 0.3 ? 'cycle' : 'fixed';
  settings.color.fixed = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;
  settings.color.cycleSpeed = 0.5 + Math.random() * 3;
  settings.draw.loops = 5 + Math.floor(Math.random() * 20);
  settings.draw.lineWidth = 0.5 + Math.random() * 2.5;

  buildAndStart();
}

// --- Audio mode frame hook ---
// We patch animator to call our audio modulation before each segment.
// We hook into the rAF loop by overriding setStyle dynamically each frame.
let audioFrameHook = null;

function enableAudioHook() {
  audioFrameHook = () => {
    if (!settings.audio.enabled || !audioEngine.isPlaying()) return;
    const f = audioEngine.getFeatures();
    const m = settings.audio.mappings;

    const lineWidth = m.level.enabled
      ? settings.draw.lineWidth * (1 + f.level * m.level.sensitivity * 3)
      : settings.draw.lineWidth;

    const d = m.bass.enabled
      ? settings.wheel.d * (1 + f.bass * m.bass.sensitivity * 0.8)
      : settings.wheel.d;

    // Hue shift from spectrum balance
    let hueShift = 0;
    if (m.spectrum.enabled) {
      hueShift = (f.treble - f.bass) * 180 * m.spectrum.sensitivity;
    }

    // Beat: speed kick
    const beatKick = m.beat.enabled && f.beat ? m.beat.sensitivity * 60 : 0;

    animator.setStyle({
      lineWidth,
      speed: settings.draw.speed + beatKick,
      color: {
        ...settings.color,
        cycleSpeed: settings.color.cycleSpeed + hueShift * 0.1,
      },
    });
  };
}

function disableAudioHook() {
  audioFrameHook = null;
  applyStyle();
}

// Patch requestAnimationFrame to inject audio hook
(function patchRAF() {
  const origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return origRAF((ts) => {
      if (audioFrameHook) audioFrameHook();
      cb(ts);
    });
  };
})();

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
  onToggleAudio(enabled) {
    if (enabled) {
      enableAudioHook();
      if (settings.audio.source === 'system' && systemAudioStream) {
        audioEngine.useSystemAudio(systemAudioStream);
      }
    } else {
      audioEngine.stop();
      disableAudioHook();
    }
  },
  async onLoadAudioFile(file) {
    await audioEngine.loadFile(file);
    enableAudioHook();
  },
});

// --- System audio (issue #9) ---
document.getElementById('audio-source')?.addEventListener('change', async (e) => {
  if (e.target.value === 'system' && settings.audio.enabled) {
    try {
      const stream = await window.api.requestSystemAudio();
      systemAudioStream = stream;
      // Discard video tracks immediately
      stream.getVideoTracks().forEach(t => t.stop());
      audioEngine.useSystemAudio(stream);
    } catch (err) {
      console.error('System audio capture failed:', err);
    }
  }
});

// --- Resize ---
window.addEventListener('resize', () => animator.onResize());

// --- Init ---
animator.onResize();
buildAndStart();
