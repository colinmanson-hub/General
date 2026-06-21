// Issue #5: Canvas animator — progressive drawing with color cycling and HiDPI support
//
// Two run styles:
//   - Manual: draw the curve once and stop.
//   - Auto: continuously regenerate curves. Each completed drawing is snapshotted to
//     a fade layer and cross-faded out over FADE_MS while the next one draws on top.

const FADE_MS = 3000; // completed drawings fade away over 3 seconds

// Arc-length advance per drawn segment. The base curve's total arc length is only a
// few units, so a coarse step blasts through the whole drawing in a single frame.
// A small step both slows the draw and makes the curve smooth (thousands of segments).
// `speed` is segments-per-frame, so per-frame advance = speed * SEGMENT_STEP.
const SEGMENT_STEP = 0.001;

export function createAnimator(canvas) {
  const ctx = canvas.getContext('2d');
  let roulette = null;
  let style = {
    lineWidth: 1.5,
    color: { mode: 'cycle', fixed: '#00ffcc', cycleSpeed: 1 },
    background: '#000000',
  };
  let loops = 10;
  let speed = 30;
  let t = 0;
  let totalT = 0;
  let hue = 0;
  let rafId = null;
  let running = false;
  let scale = 1;
  let baseHalf = 1;   // half the usable canvas (px) — the radius we fit the curve into
  let fitRadius = 1;  // max extent of the current curve in normalized units
  let segAccum = 0;   // fractional carry so non-integer speeds advance precisely
  let offsetX = 0, offsetY = 0;
  let dpr = 1;

  // Manual-mode guide schematic (base outline, wheel outline, pen offset).
  let guides = null;
  let guideRadius = 0;

  // Auto mode + fade trails.
  let autoMode = false;
  let onComplete = null;
  let liveLayer = null, liveCtx = null;   // current drawing, transparent background
  let fadeLayer = null, fadeCtx = null;   // snapshot of the last completed drawing
  let fadeStart = 0;
  let fadeActive = false;

  function makeLayer() {
    if (typeof document === 'undefined') return [null, null];
    const c = document.createElement('canvas');
    return [c, c.getContext('2d')];
  }

  function ensureLayers() {
    if (!liveLayer) [liveLayer, liveCtx] = makeLayer();
    if (!fadeLayer) [fadeLayer, fadeCtx] = makeLayer();
    sizeLayers();
  }

  function sizeLayers() {
    for (const c of [liveLayer, fadeLayer]) {
      if (c) { c.width = canvas.width; c.height = canvas.height; }
    }
    if (liveCtx) liveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function computeLayout() {
    dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseHalf = Math.min(w, h) / 2 * 0.9;
    offsetX = w / 2;
    offsetY = h / 2;
    updateScale();
    if (autoMode) sizeLayers();
  }

  function updateScale() {
    scale = baseHalf / fitRadius;
  }

  // Sample the curve once to find its largest extent, so each drawing is scaled
  // to fill the frame regardless of shape/radius/pen-offset (no clipping, no tiny
  // curves lost in the middle).
  function computeFit() {
    if (!roulette) { fitRadius = 1; updateScale(); return; }
    let maxR = 0;
    const N = 720;
    for (let i = 0; i <= N; i++) {
      const p = roulette.pointAt((i / N) * totalT);
      const rr = Math.hypot(p.x, p.y);
      if (rr > maxR) maxR = rr;
    }
    // Include the guide outlines so the base shape isn't clipped when shown.
    const m = Math.max(maxR, guideRadius);
    fitRadius = m > 1e-6 ? m : 1;
    updateScale();
  }

  function guideExtent(g) {
    if (!g) return 0;
    let m = 0;
    const consider = (p) => { if (p) { const rr = Math.hypot(p.x, p.y); if (rr > m) m = rr; } };
    (g.base || []).forEach(consider);
    (g.wheel || []).forEach(consider);
    consider(g.center);
    consider(g.pen);
    return m;
  }

  function toScreen(p) {
    return { x: offsetX + p.x * scale, y: offsetY + p.y * scale };
  }

  function paintBackground() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Repaint background, then the guide schematic (manual mode only). The animated
  // curve draws over this, leaving the outlines visible in the negative space.
  function repaintBase() {
    paintBackground();
    if (guides && !autoMode) drawGuides();
  }

  function strokePolyline(pts, close) {
    if (!pts || !pts.length) return;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const q = toScreen(pts[i]);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    if (close) ctx.closePath();
    ctx.stroke();
  }

  function drawGuides() {
    if (!guides) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Base shape — dashed, faint.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.lineWidth = 1;
    if (ctx.setLineDash) ctx.setLineDash([5, 5]);
    strokePolyline(guides.base, true);
    if (ctx.setLineDash) ctx.setLineDash([]);

    // Rolling wheel — solid, cyan.
    ctx.strokeStyle = 'rgba(110, 200, 255, 0.7)';
    ctx.lineWidth = 1.5;
    strokePolyline(guides.wheel, false);

    // Pen offset — line from wheel centre to pen, with dots at each end.
    if (guides.center && guides.pen) {
      const c = toScreen(guides.center);
      const pe = toScreen(guides.pen);
      ctx.strokeStyle = 'rgba(255, 180, 80, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(pe.x, pe.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(110, 200, 255, 0.95)';
      ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = 'rgba(255, 180, 80, 1)';
      ctx.beginPath(); ctx.arc(pe.x, pe.y, 3.5, 0, 2 * Math.PI); ctx.fill();
    }

    ctx.restore();
  }

  function getCurrentColor() {
    if (style.color.mode === 'fixed') return style.color.fixed;
    return `hsl(${hue % 360}, 100%, 60%)`;
  }

  // Draw the next batch of segments onto the given context. `speed` is segments
  // per frame; a fractional carry lets non-integer speeds advance precisely
  // (integer speeds behave exactly as before).
  function drawSegments(target) {
    segAccum += speed;
    const segments = Math.floor(segAccum);
    segAccum -= segments;
    let prev = toScreen(roulette.pointAt(t));

    target.lineWidth = style.lineWidth;
    target.lineCap = 'round';

    for (let i = 0; i < segments && t < totalT; i++) {
      t += SEGMENT_STEP;
      const curr = toScreen(roulette.pointAt(t));

      target.strokeStyle = getCurrentColor();
      target.beginPath();
      target.moveTo(prev.x, prev.y);
      target.lineTo(curr.x, curr.y);
      target.stroke();

      if (style.color.mode === 'cycle') {
        // Scale by the step so a full drawing cycles the same amount of hue
        // regardless of how many segments it's divided into.
        hue += style.color.cycleSpeed * (360 / totalT) * SEGMENT_STEP;
      }

      prev = curr;
    }
  }

  // Auto mode: composite background + fading previous drawing + live drawing.
  function composite() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (fadeActive && fadeLayer) {
      const a = 1 - (performance.now() - fadeStart) / FADE_MS;
      if (a <= 0) {
        fadeActive = false;
      } else {
        ctx.globalAlpha = a;
        ctx.drawImage(fadeLayer, 0, 0);
      }
    }

    ctx.globalAlpha = 1;
    if (liveLayer) ctx.drawImage(liveLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Auto mode: the current drawing finished — snapshot it to the fade layer,
  // clear the live layer, and ask the host for the next set of random settings.
  function startNextAuto() {
    if (fadeCtx && liveLayer) {
      fadeCtx.setTransform(1, 0, 0, 1, 0, 0);
      fadeCtx.clearRect(0, 0, fadeLayer.width, fadeLayer.height);
      fadeCtx.drawImage(liveLayer, 0, 0);
      fadeStart = performance.now();
      fadeActive = true;
    }
    if (liveCtx) {
      liveCtx.setTransform(1, 0, 0, 1, 0, 0);
      liveCtx.clearRect(0, 0, liveLayer.width, liveLayer.height);
      liveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    t = 0;
    hue = 0;
    segAccum = 0;
    if (onComplete) onComplete(); // host picks new settings + background, updates curve/style
  }

  function step() {
    if (!roulette) { running = false; return; }

    if (autoMode) {
      if (t < totalT) drawSegments(liveCtx);
      composite();
      if (t >= totalT) startNextAuto();
      rafId = requestAnimationFrame(step);
      return;
    }

    // Manual mode: draw once, then stop.
    if (t >= totalT) {
      running = false;
      return;
    }

    drawSegments(ctx);
    rafId = requestAnimationFrame(step);
  }

  return {
    setCurve(newRoulette, newLoops = 10) {
      roulette = newRoulette;
      loops = newLoops;
      totalT = newRoulette.totalT * loops;
      computeFit();
    },

    // Segments-per-frame needed to draw the whole curve in `seconds` (assuming
    // ~`fps` animation frames per second). Used by auto mode to time each drawing.
    speedForDuration(seconds, fps = 60) {
      if (!(seconds > 0) || totalT <= 0) return speed;
      return totalT / (seconds * fps * SEGMENT_STEP);
    },

    setStyle(newStyle) {
      if (newStyle.lineWidth !== undefined) style.lineWidth = newStyle.lineWidth;
      if (newStyle.color !== undefined) style.color = { ...style.color, ...newStyle.color };
      if (newStyle.background !== undefined) style.background = newStyle.background;
      if (newStyle.speed !== undefined) speed = newStyle.speed;
      if (newStyle.loops !== undefined) loops = newStyle.loops;
    },

    setSpeed(s) { speed = s; },

    // Toggle continuous auto mode. onCompleteCb runs each time a drawing finishes.
    setAutoMode(enabled, onCompleteCb = null) {
      autoMode = !!enabled;
      onComplete = onCompleteCb;
      if (autoMode) {
        ensureLayers();
      } else {
        fadeActive = false;
      }
    },

    start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(step);
    },

    stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    },

    clear() {
      this.stop();
      t = 0;
      hue = 0;
      segAccum = 0;
      fadeActive = false;
      if (autoMode) {
        ensureLayers();
        if (liveCtx) {
          liveCtx.setTransform(1, 0, 0, 1, 0, 0);
          liveCtx.clearRect(0, 0, liveLayer.width, liveLayer.height);
          liveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        if (fadeCtx) {
          fadeCtx.setTransform(1, 0, 0, 1, 0, 0);
          fadeCtx.clearRect(0, 0, fadeLayer.width, fadeLayer.height);
        }
      }
      repaintBase();
    },

    // Set (or clear with null) the manual-mode guide schematic.
    setGuides(g) {
      guides = g;
      guideRadius = guideExtent(g);
      computeFit();
    },

    onResize() {
      computeLayout();
      repaintBase();
    },

    savePng() {
      return canvas.toDataURL('image/png');
    },

    isRunning() { return running; },
    getT() { return t; },
    getTotalT() { return totalT; },
  };
}
