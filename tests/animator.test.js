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
