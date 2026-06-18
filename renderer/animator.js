// Issue #5: Canvas animator — progressive drawing with color cycling and HiDPI support

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
  let offsetX = 0, offsetY = 0;

  function computeLayout() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    scale = Math.min(w, h) / 2 * 0.9;
    offsetX = w / 2;
    offsetY = h / 2;
  }

  function toScreen(p) {
    return { x: offsetX + p.x * scale, y: offsetY + p.y * scale };
  }

  function paintBackground() {
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }

  function getCurrentColor() {
    if (style.color.mode === 'fixed') return style.color.fixed;
    return `hsl(${hue % 360}, 100%, 60%)`;
  }

  function step() {
    if (!roulette || t >= totalT) {
      running = false;
      return;
    }

    const segments = Math.ceil(speed);
    let prev = toScreen(roulette.pointAt(t));

    ctx.lineWidth = style.lineWidth;
    ctx.lineCap = 'round';

    for (let i = 0; i < segments && t < totalT; i++) {
      t += 1;
      const curr = toScreen(roulette.pointAt(t));

      ctx.strokeStyle = getCurrentColor();
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();

      if (style.color.mode === 'cycle') {
        hue += style.color.cycleSpeed * (360 / totalT);
      }

      prev = curr;
    }

    rafId = requestAnimationFrame(step);
  }

  return {
    setCurve(newRoulette, newLoops = 10) {
      roulette = newRoulette;
      loops = newLoops;
      totalT = newRoulette.totalT * loops;
    },

    setStyle(newStyle) {
      if (newStyle.lineWidth !== undefined) style.lineWidth = newStyle.lineWidth;
      if (newStyle.color !== undefined) style.color = { ...style.color, ...newStyle.color };
      if (newStyle.background !== undefined) style.background = newStyle.background;
      if (newStyle.speed !== undefined) speed = newStyle.speed;
      if (newStyle.loops !== undefined) loops = newStyle.loops;
    },

    setSpeed(s) { speed = s; },

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
      paintBackground();
    },

    onResize() {
      computeLayout();
      paintBackground();
    },

    savePng() {
      return canvas.toDataURL('image/png');
    },

    isRunning() { return running; },
    getT() { return t; },
    getTotalT() { return totalT; },
  };
}
