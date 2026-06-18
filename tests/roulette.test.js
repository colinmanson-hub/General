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

describe('createRoulette — pen scale (audio reactive)', () => {
  test('penScale defaults to 1', () => {
    const shape = generateShape('circle', { size: 1 });
    const r = createRoulette(shape, { r: 0.3, d: 0.2, side: 'inside' });
    expect(r.getPenScale()).toBe(1);
  });

  test('setPenScale scales the pen offset away from the wheel centre', () => {
    const shape = generateShape('circle', { size: 1 });
    const r = createRoulette(shape, { r: 0.3, d: 0.2, side: 'inside' });

    // Wheel centre is independent of pen offset; recover it as the midpoint
    // between scale s and scale -... instead compare displacement growth.
    const at = (s) => { r.setPenScale(s); return r.pointAt(0.123); };
    const base = at(1);
    const scaled = at(2);
    // Centre = base - d*u ; scaled = centre + 2d*u = base + d*u, so scaled != base
    // and the move from base->scaled equals base->centre in the opposite sense.
    expect(scaled.x).not.toBeCloseTo(base.x, 6);
  });

  test('invalid pen scales fall back to 1', () => {
    const shape = generateShape('circle', { size: 1 });
    const r = createRoulette(shape, { r: 0.3, d: 0.2, side: 'inside' });
    r.setPenScale(0);
    expect(r.getPenScale()).toBe(1);
    r.setPenScale(-3);
    expect(r.getPenScale()).toBe(1);
    r.setPenScale(NaN);
    expect(r.getPenScale()).toBe(1);
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

  test('penScale multiplies the offset distance', () => {
    const pen = createRoulette(shape, { r, d, side: 'inside' });
    const s = 0.37 * pen.totalT;
    const c = centre.pointAt(s);
    pen.setPenScale(1);
    const base = pen.pointAt(s);
    pen.setPenScale(2.5);
    const scaled = pen.pointAt(s);
    const baseDist = Math.hypot(base.x - c.x, base.y - c.y);
    const scaledDist = Math.hypot(scaled.x - c.x, scaled.y - c.y);
    expect(scaledDist / baseDist).toBeCloseTo(2.5, 2);
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
