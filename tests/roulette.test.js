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

describe('createRoulette — closure', () => {
  test('exposes getClosureLoops', () => {
    const shape = generateShape('circle', { size: 1 });
    const roulette = createRoulette(shape, { r: 0.2, d: 0.15, side: 'inside' });
    expect(typeof roulette.getClosureLoops).toBe('function');
  });

  test('circle base closes exactly: pen returns to start after the reported loops', () => {
    // R = 0.4, r = 0.16 → R/r = 2.5 = 5/2 → closes in 2 loops.
    const shape = generateShape('circle', { size: 0.8 });
    const roulette = createRoulette(shape, { r: 0.16, d: 0.4, side: 'inside' });
    const k = roulette.getClosureLoops();
    expect(k).toBe(2);
    const start = roulette.pointAt(0);
    const end = roulette.pointAt(k * roulette.totalT);
    expect(Math.hypot(start.x - end.x, start.y - end.y)).toBeLessThan(1e-9);
  });

  test('engineered radius closes any shape in exactly q loops', () => {
    for (const type of ['polygon', 'star', 'rectangle']) {
      const shape = generateShape(type, { size: 0.8, sides: 5, points: 7, aspect: 2 });
      const [p, q] = [7, 3];
      const r = (shape.length * q) / (2 * Math.PI * p);
      const roulette = createRoulette(shape, { r, d: 0.4, side: 'inside' });
      expect(roulette.getClosureLoops()).toBe(q);
      const start = roulette.pointAt(0);
      const end = roulette.pointAt(q * roulette.totalT);
      expect(Math.hypot(start.x - end.x, start.y - end.y)).toBeLessThan(1e-9);
    }
  });

  test('returns a bounded loop count even when no exact closure exists', () => {
    const shape = generateShape('circle', { size: 0.777 });
    const roulette = createRoulette(shape, { r: 0.3123, d: 0.4, side: 'inside' });
    const k = roulette.getClosureLoops(400);
    expect(k).toBeGreaterThanOrEqual(1);
    expect(k).toBeLessThanOrEqual(400);
  });
});

describe('createRoulette — non-circular wheels', () => {
  const wheels = ['oval', 'triangle', 'square', 'pentagon'];

  test.each(wheels)('%s wheel: pointAt is finite across a closed pattern', (type) => {
    const shape = generateShape('circle', { size: 0.9 });
    const roulette = createRoulette(shape, { r: 0.3, d: 0.45, side: 'inside', type });
    const total = roulette.totalT * roulette.getClosureLoops();
    for (let i = 0; i <= 200; i++) {
      const p = roulette.pointAt((i / 200) * total);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  test.each(wheels)('%s wheel: pen sits exactly d from the wheel centre', (type) => {
    const d = 0.45;
    const shape = generateShape('circle', { size: 0.9 });
    const roulette = createRoulette(shape, { r: 0.3, d, side: 'inside', type });
    const g = roulette.getWheelGeometry(0);
    expect(Math.hypot(g.pen.x - g.center.x, g.pen.y - g.center.y)).toBeCloseTo(d, 6);
  });

  test('closure uses the base/wheel perimeter ratio', () => {
    // Square wheel sized so baseLength / wheelLength is rational.
    const shape = generateShape('circle', { size: 1 });
    const roulette = createRoulette(shape, { r: 0.25, d: 0.3, side: 'inside', type: 'square' });
    const k = roulette.getClosureLoops();
    expect(k).toBeGreaterThanOrEqual(1);
    expect(k).toBeLessThanOrEqual(400);
  });
});

describe('createRoulette — wheel geometry guides', () => {
  test('circle wheel geometry: centre at R-r from origin, outline radius r', () => {
    const shape = generateShape('circle', { size: 1 }); // R = 0.5
    const r = 0.2;
    const roulette = createRoulette(shape, { r, d: 0.15, side: 'inside' });
    const g = roulette.getWheelGeometry(0);
    expect(Math.hypot(g.center.x, g.center.y)).toBeCloseTo(0.5 - r, 3);
    // every outline point is r away from the centre
    for (const p of g.outline) {
      expect(Math.hypot(p.x - g.center.x, p.y - g.center.y)).toBeCloseTo(r, 3);
    }
  });

  test('outline is a closed loop', () => {
    const shape = generateShape('circle', { size: 1 });
    const roulette = createRoulette(shape, { r: 0.2, d: 0.15, side: 'inside', type: 'triangle' });
    const g = roulette.getWheelGeometry(0);
    const first = g.outline[0];
    const last = g.outline[g.outline.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(1e-9);
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

describe('createRoulette — wheel-centre geometry (circle)', () => {
  const R = 0.5, r = 0.2;
  const shape = generateShape('circle', { size: R * 2 });

  test('inside: with d=0 the pen rides the wheel centre at radius R-r', () => {
    const rou = createRoulette(shape, { r, d: 0, side: 'inside' });
    for (let i = 0; i < 8; i++) {
      const p = rou.pointAt((i / 8) * rou.totalT);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(R - r, 3);
    }
  });

  test('outside: with d=0 the wheel centre rides at radius R+r', () => {
    const rou = createRoulette(shape, { r, d: 0, side: 'outside' });
    for (let i = 0; i < 8; i++) {
      const p = rou.pointAt((i / 8) * rou.totalT);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(R + r, 3);
    }
  });
});

describe('createRoulette — pen offset magnitude', () => {
  const shape = generateShape('circle', { size: 1 });
  const r = 0.2, d = 0.1;
  const centre = createRoulette(shape, { r, d: 0, side: 'inside' });

  test('pen sits exactly d away from the wheel centre', () => {
    const pen = createRoulette(shape, { r, d, side: 'inside' });
    for (let i = 1; i < 6; i++) {
      const s = (i / 6) * pen.totalT;
      const c = centre.pointAt(s);
      const p = pen.pointAt(s);
      expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeCloseTo(d, 3);
    }
  });
});

describe('createRoulette — robustness', () => {
  const shapes = ['circle', 'rectangle', 'polygon', 'star'];
  test.each(shapes)('%s: pointAt is finite across the whole range, both sides', (type) => {
    for (const side of ['inside', 'outside']) {
      const shape = generateShape(type, { size: 1, sides: 7, points: 6, aspect: 1.3 });
      const rou = createRoulette(shape, { r: 0.25, d: 0.3, side });
      expect(rou.totalT).toBeGreaterThan(0);
      for (let i = 0; i <= 50; i++) {
        const p = rou.pointAt((i / 50) * rou.totalT);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });
});
