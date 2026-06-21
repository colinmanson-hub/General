import { createAnimator } from '../renderer/animator.js';
import { generateShape } from '../renderer/shapes.js';
import { createRoulette } from '../renderer/roulette.js';

// setup.js provides makeMockCanvas, tickFrame, requestAnimationFrame

function makeRoulette() {
  const shape = generateShape('circle', { size: 1 });
  return createRoulette(shape, { r: 0.3, d: 0.2, side: 'inside' });
}

describe('createAnimator', () => {
  test('returns expected API surface', () => {
    const canvas = makeMockCanvas();
    const a = createAnimator(canvas);
    expect(typeof a.setCurve).toBe('function');
    expect(typeof a.setStyle).toBe('function');
    expect(typeof a.start).toBe('function');
    expect(typeof a.stop).toBe('function');
    expect(typeof a.clear).toBe('function');
    expect(typeof a.savePng).toBe('function');
    expect(typeof a.onResize).toBe('function');
  });

  test('isRunning() is false initially', () => {
    const a = createAnimator(makeMockCanvas());
    expect(a.isRunning()).toBe(false);
  });
});

describe('setCurve + start', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('start() queues a rAF callback', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    a.start();
    expect(global._rafQueue.length).toBeGreaterThan(0);
    a.stop();
  });

  test('isRunning() is true after start()', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    a.start();
    expect(a.isRunning()).toBe(true);
    a.stop();
  });

  test('stop() sets isRunning() to false', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    a.start();
    a.stop();
    expect(a.isRunning()).toBe(false);
  });

  test('start() is idempotent (no double-queuing)', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    a.start();
    const lenAfterFirst = global._rafQueue.length;
    a.start();
    expect(global._rafQueue.length).toBe(lenAfterFirst);
    a.stop();
  });

  test('t advances after a frame tick', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    a.setStyle({ speed: 10 });
    a.start();
    const t0 = a.getT();
    tickFrame();
    expect(a.getT()).toBeGreaterThan(t0);
    a.stop();
  });
});

describe('clear', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('clear() resets t to 0', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    a.setStyle({ speed: 50 });
    a.start();
    tickFrame();
    expect(a.getT()).toBeGreaterThan(0);
    a.clear();
    expect(a.getT()).toBe(0);
  });

  test('clear() stops animation', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    a.start();
    a.clear();
    expect(a.isRunning()).toBe(false);
  });
});

describe('setStyle', () => {
  test('accepts partial style updates without throwing', () => {
    const a = createAnimator(makeMockCanvas());
    expect(() => a.setStyle({ lineWidth: 2 })).not.toThrow();
    expect(() => a.setStyle({ color: { mode: 'fixed', fixed: '#ff0000' } })).not.toThrow();
    expect(() => a.setStyle({ background: '#111111' })).not.toThrow();
    expect(() => a.setStyle({ speed: 60 })).not.toThrow();
  });
});

describe('savePng', () => {
  test('returns a data:image/png URL', () => {
    const canvas = makeMockCanvas();
    const a = createAnimator(canvas);
    const url = a.savePng();
    expect(typeof url).toBe('string');
    expect(url.startsWith('data:')).toBe(true);
  });
});

describe('onResize', () => {
  test('does not throw', () => {
    const a = createAnimator(makeMockCanvas());
    expect(() => a.onResize()).not.toThrow();
  });

  test('handles window.devicePixelRatio correctly', () => {
    global.window.devicePixelRatio = 2;
    const a = createAnimator(makeMockCanvas());
    expect(() => a.onResize()).not.toThrow();
    global.window.devicePixelRatio = 1;
  });
});

describe('color cycling', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('fixed color mode does not throw during draw', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 2);
    a.setStyle({ color: { mode: 'fixed', fixed: '#00ffcc' } });
    a.start();
    expect(() => tickFrame()).not.toThrow();
    a.stop();
  });

  test('cycle color mode does not throw during draw', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 2);
    a.setStyle({ color: { mode: 'cycle', cycleSpeed: 2 } });
    a.start();
    expect(() => tickFrame()).not.toThrow();
    a.stop();
  });
});

describe('totalT / setCurve', () => {
  test('getTotalT() = roulette.totalT × loops', () => {
    const a = createAnimator(makeMockCanvas());
    const r = makeRoulette();
    a.setCurve(r, 4);
    expect(a.getTotalT()).toBeCloseTo(r.totalT * 4);
  });

  test('setCurve defaults to 10 loops when omitted', () => {
    const a = createAnimator(makeMockCanvas());
    const r = makeRoulette();
    a.setCurve(r);
    expect(a.getTotalT()).toBeCloseTo(r.totalT * 10);
  });
});

describe('completion', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('stops running once t reaches totalT', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 1); // short curve
    a.setStyle({ speed: 5000 });   // burn through it fast (advance is speed * SEGMENT_STEP)
    a.start();
    // Drive frames until the queue drains or the animator reports completion.
    for (let i = 0; i < 50 && a.isRunning(); i++) tickFrame();
    expect(a.isRunning()).toBe(false);
    expect(a.getT()).toBeGreaterThanOrEqual(a.getTotalT());
  });

  test('higher speed advances t further per frame', () => {
    const slow = createAnimator(makeMockCanvas());
    slow.setCurve(makeRoulette(), 10);
    slow.setStyle({ speed: 5 });
    slow.start();
    tickFrame();
    const slowT = slow.getT();
    slow.stop();

    global._rafQueue = [];
    const fast = createAnimator(makeMockCanvas());
    fast.setCurve(makeRoulette(), 10);
    fast.setStyle({ speed: 40 });
    fast.start();
    tickFrame();
    const fastT = fast.getT();
    fast.stop();

    expect(fastT).toBeGreaterThan(slowT);
  });
});

describe('completion stops the animation', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('manual mode stops once the curve is fully drawn', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 1);
    a.setStyle({ speed: 5000 });
    a.start();
    for (let i = 0; i < 50 && a.isRunning(); i++) tickFrame();
    expect(a.isRunning()).toBe(false);
  });
});

describe('setGuides', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('accepting guides and drawing them does not throw', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 2);
    a.onResize();
    const guides = {
      base: [{ x: 0.5, y: 0 }, { x: 0, y: 0.5 }, { x: -0.5, y: 0 }, { x: 0, y: -0.5 }],
      wheel: [{ x: 0.2, y: 0 }, { x: 0, y: 0.2 }, { x: -0.2, y: 0 }],
      center: { x: 0.2, y: 0 },
      pen: { x: 0.35, y: 0 },
    };
    expect(() => a.setGuides(guides)).not.toThrow();
    expect(() => a.clear()).not.toThrow(); // clear() repaints the guides
  });

  test('setGuides(null) clears guides without throwing', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 2);
    expect(() => a.setGuides(null)).not.toThrow();
    expect(() => a.clear()).not.toThrow();
  });

  test('guides extend the fit so a large base outline is not clipped', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 2); // small curve
    a.onResize();
    // A base outline far larger than the curve should still be accommodated
    // (no throw, fit recomputed). Mostly a smoke test on the fit path.
    const guides = { base: [{ x: 5, y: 0 }, { x: 0, y: 5 }, { x: -5, y: 0 }], wheel: [], center: { x: 0, y: 0 }, pen: { x: 1, y: 0 } };
    expect(() => a.setGuides(guides)).not.toThrow();
  });
});

describe('speedForDuration', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('returns current speed when duration is invalid', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 2);
    a.setStyle({ speed: 12 });
    expect(a.speedForDuration(0)).toBe(12);
  });

  test('drawing completes in roughly the requested number of frames', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 3);
    const fps = 60, seconds = 2;
    a.setStyle({ speed: a.speedForDuration(seconds, fps) });
    a.start();
    let frames = 0;
    while (a.isRunning() && frames < fps * seconds * 3) { tickFrame(); frames++; }
    expect(frames).toBeGreaterThan(fps * seconds * 0.7);
    expect(frames).toBeLessThan(fps * seconds * 1.3);
  });
});

describe('auto mode', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('setAutoMode does not throw and exposes no new completion when manual', () => {
    const a = createAnimator(makeMockCanvas());
    expect(() => a.setAutoMode(true, () => {})).not.toThrow();
    expect(() => a.setAutoMode(false)).not.toThrow();
  });

  test('fires onComplete and keeps looping across completion', () => {
    const a = createAnimator(makeMockCanvas());
    let completions = 0;
    a.setAutoMode(true, () => { completions++; });
    a.setCurve(makeRoulette(), 1);
    a.setStyle({ speed: 5000 });
    a.onResize();
    a.start();
    for (let i = 0; i < 60; i++) tickFrame();
    expect(completions).toBeGreaterThan(0);
    expect(a.isRunning()).toBe(true);
    a.stop();
  });

  test('auto-mode drawing does not throw during frames', () => {
    const a = createAnimator(makeMockCanvas());
    a.setAutoMode(true, () => {});
    a.setCurve(makeRoulette(), 2);
    a.setStyle({ speed: 10 });
    a.onResize();
    a.start();
    expect(() => { for (let i = 0; i < 10; i++) tickFrame(); }).not.toThrow();
    a.stop();
  });
});

describe('stop / restart', () => {
  beforeEach(() => { global._rafQueue = []; });

  test('after clear, start resumes from t=0', () => {
    const a = createAnimator(makeMockCanvas());
    a.setCurve(makeRoulette(), 5);
    a.setStyle({ speed: 20 });
    a.start();
    tickFrame();
    a.clear();
    expect(a.getT()).toBe(0);
    a.start();
    expect(a.isRunning()).toBe(true);
    tickFrame();
    expect(a.getT()).toBeGreaterThan(0);
    a.stop();
  });
});
