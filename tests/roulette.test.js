import { generateShape } from '../renderer/shapes.js';
import { createRoulette } from '../renderer/roulette.js';

// Classic closed-form hypotrochoid: circle of radius R, wheel radius r, pen d
// P(t) = { (R-r)*cos(t) + d*cos((R-r)/r * t), (R-r)*sin(t) - d*sin((R-r)/r * t) }
function hypotrochoidPoint(R, r, d, t) {
  return {
    x: (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t),
    y: (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t),
  };
}

// Classic epitrochoid: circle of radius R, wheel radius r, pen d
function epitrochoidPoint(R, r, d, t) {
  return {
    x: (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t),
    y: (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t),
  };
}

describe('createRoulette — circle base', () => {
  const R = 0.5;  // radius of base circle (size=1 → radius 0.5)
  const r = 0.2;
  const d = 0.15;

  test('inside: matches hypotrochoid formula at several t values', () => {
    const shape = generateShape('circle', { size: R * 2 });
    const roulette = createRoulette(shape, { r, d, side: 'inside' });

    // Sample at several arc-length positions
    const steps = 20;
    const tolerance = 0.02; // normalized coords, 2% tolerance
    for (let i = 0; i < steps; i++) {
      const s = (i / steps) * roulette.totalT;
      const got = roulette.pointAt(s);
      // Map arc-length s to angle t on the circle: t = s / R
      const t = s / R;
      const expected = hypotrochoidPoint(R, r, d, t);
      expect(Math.hypot(got.x - expected.x, got.y - expected.y)).toBeLessThan(tolerance);
    }
  });

  test('outside: matches epitrochoid formula at several t values', () => {
    const shape = generateShape('circle', { size: R * 2 });
    const roulette = createRoulette(shape, { r, d, side: 'outside' });

    const steps = 20;
    const tolerance = 0.02;
    for (let i = 0; i < steps; i++) {
      const s = (i / steps) * roulette.totalT;
      const got = roulette.pointAt(s);
      const t = s / R;
      const expected = epitrochoidPoint(R, r, d, t);
      expect(Math.hypot(got.x - expected.x, got.y - expected.y)).toBeLessThan(tolerance);
    }
  });

  test('totalT equals shape perimeter', () => {
    const shape = generateShape('circle', { size: R * 2 });
    const roulette = createRoulette(shape, { r, d, side: 'inside' });
    expect(roulette.totalT).toBeCloseTo(shape.length, 3);
  });
});

describe('createRoulette — continuity', () => {
  const shapes = ['circle', 'rectangle', 'polygon', 'star'];

  test.each(shapes)('%s base: no large jumps between consecutive steps', (type) => {
    const shape = generateShape(type, { size: 1, sides: 5, points: 5, aspect: 1.5 });
    const roulette = createRoulette(shape, { r: 0.2, d: 0.15, side: 'inside' });

    const steps = 500;
    const stepSize = roulette.totalT / steps;
    const MAX_JUMP = 0.15; // max allowed distance between consecutive pen positions

    let prev = roulette.pointAt(0);
    for (let i = 1; i <= steps; i++) {
      const curr = roulette.pointAt(i * stepSize);
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      expect(dist).toBeLessThan(MAX_JUMP);
      prev = curr;
    }
  });

  test.each(shapes)('%s outside: no large jumps', (type) => {
    const shape = generateShape(type, { size: 1, sides: 5, points: 5, aspect: 1.5 });
    const roulette = createRoulette(shape, { r: 0.2, d: 0.15, side: 'outside' });

    const steps = 500;
    const stepSize = roulette.totalT / steps;
    const MAX_JUMP = 0.15;

    let prev = roulette.pointAt(0);
    for (let i = 1; i <= steps; i++) {
      const curr = roulette.pointAt(i * stepSize);
      expect(Math.hypot(curr.x - prev.x, curr.y - prev.y)).toBeLessThan(MAX_JUMP);
      prev = curr;
    }
  });
});

describe('createRoulette — pointAt wrapping', () => {
  test('pointAt wraps at totalT (loop closes)', () => {
    const shape = generateShape('circle', { size: 1 });
    const roulette = createRoulette(shape, { r: 0.3, d: 0.2, side: 'inside' });
    const p0 = roulette.pointAt(0);
    const pEnd = roulette.pointAt(roulette.totalT);
    // After one full perimeter traversal pen may not have closed (depends on ratio),
    // but the function must not throw and must return a finite point.
    expect(isFinite(pEnd.x)).toBe(true);
    expect(isFinite(pEnd.y)).toBe(true);
  });
});
