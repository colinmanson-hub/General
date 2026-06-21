// Global browser-API stubs for Node.js test environment

// ---- Canvas ----
function makeMockContext2d() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    globalAlpha: 1,
    fillRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    scale: () => {},
    setTransform: () => {},
    drawImage: () => {},
  };
}

global.makeMockCanvas = (w = 800, h = 600) => ({
  getContext: () => makeMockContext2d(),
  toDataURL: () => 'data:image/png;base64,abc',
  clientWidth: w,
  clientHeight: h,
  width: w,
  height: h,
});

// ---- rAF / cAF ----
// Exposed as global so tests can advance frames manually
global._rafQueue = [];
global.requestAnimationFrame = (cb) => { global._rafQueue.push(cb); return global._rafQueue.length; };
global.cancelAnimationFrame = () => {};
global.tickFrame = () => {
  const q = global._rafQueue.splice(0);
  q.forEach(cb => cb(performance.now()));
};

// ---- window ----
global.window = {
  devicePixelRatio: 1,
  requestAnimationFrame: global.requestAnimationFrame,
};

// ---- document (minimal — supports offscreen canvas layers for auto mode) ----
global.document = {
  createElement: (tag) => (tag === 'canvas' ? makeMockCanvas() : {}),
};
