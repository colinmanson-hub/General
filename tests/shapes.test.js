import { generateShape } from '../renderer/shapes.js';

const TYPES = ['circle', 'rectangle', 'oval', 'polygon', 'star'];

// Helpers
function spacing(points) {
  const dists = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    dists.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  return dists;
}

function isUnit(v, tol = 1e-6) {
  return Math.abs(Math.hypot(v.x, v.y) - 1) < tol;
}

describe.each(TYPES)('generateShape("%s")', (type) => {
  const params = { size: 1, sides: 6, points: 5, aspect: 1.5 };
  let shape;

  beforeEach(() => { shape = generateShape(type, params); });

  test('returns points, tangents, normals, length', () => {
    expect(shape).toHaveProperty('points');
    expect(shape).toHaveProperty('tangents');
    expect(shape).toHaveProperty('normals');
    expect(shape).toHaveProperty('length');
    expect(shape.points.length).toBeGreaterThan(0);
    expect(shape.points.length).toBe(shape.tangents.length);
    expect(shape.points.length).toBe(shape.normals.length);
  });

  test('curve is closed (last point ≈ first)', () => {
    const pts = shape.points;
    const dx = pts[0].x - pts[pts.length - 1].x;
    const dy = pts[0].y - pts[pts.length - 1].y;
    expect(Math.hypot(dx, dy)).toBeLessThan(0.05);
  });

  test('sampled uniformly in arc-length (no chord exceeds the step)', () => {
    // Uniform arc-length sampling means each consecutive chord is at most the
    // arc-length step (chord <= arc). Across a corner the chord is shorter, but
    // it must never be *longer* — that would mean the sampling stretched somewhere.
    const dists = spacing(shape.points);
    const step = shape.length / shape.points.length;
    const max = Math.max(...dists);
    expect(max).toBeLessThanOrEqual(step * 1.01);
  });

  test('all tangents are unit vectors', () => {
    for (const t of shape.tangents) expect(isUnit(t)).toBe(true);
  });

  test('all normals are unit vectors', () => {
    for (const n of shape.normals) expect(isUnit(n)).toBe(true);
  });

  test('length is positive', () => {
    expect(shape.length).toBeGreaterThan(0);
  });
});

describe('generateShape circle', () => {
  test('normals point outward (dot with position > 0)', () => {
    const { points, normals } = generateShape('circle', { size: 2 });
    for (let i = 0; i < points.length; i++) {
      const dot = points[i].x * normals[i].x + points[i].y * normals[i].y;
      expect(dot).toBeGreaterThan(0);
    }
  });

  test('perimeter ≈ 2πr', () => {
    const r = 0.5;
    const { length } = generateShape('circle', { size: r * 2 });
    expect(length).toBeCloseTo(2 * Math.PI * r, 1);
  });

  test('chord spacing is tightly uniform (smooth curve, ratio < 1.01)', () => {
    const { points } = generateShape('circle', { size: 1 });
    const dists = spacing(points);
    const max = Math.max(...dists), min = Math.min(...dists);
    expect(max / min).toBeLessThan(1.01);
  });
});

describe('generateShape rectangle', () => {
  test('perimeter ≈ 2*(w+h)', () => {
    const size = 1, aspect = 2;
    const { length } = generateShape('rectangle', { size, aspect });
    expect(length).toBeCloseTo(2 * (size * aspect + size), 1);
  });
});

describe('generateShape oval', () => {
  test('aspect makes it wider than tall (x extent > y extent)', () => {
    const { points } = generateShape('oval', { size: 1, aspect: 2 });
    const maxX = Math.max(...points.map((p) => Math.abs(p.x)));
    const maxY = Math.max(...points.map((p) => Math.abs(p.y)));
    expect(maxX).toBeGreaterThan(maxY * 1.5);
  });

  test('aspect 1 is effectively a circle', () => {
    const { length } = generateShape('oval', { size: 1, aspect: 1 });
    expect(length).toBeCloseTo(Math.PI, 1); // 2π·(0.5)
  });
});

describe('generateShape defaults', () => {
  test('unknown type falls back to circle', () => {
    const s = generateShape('unknown', { size: 1 });
    expect(s.points.length).toBeGreaterThan(0);
  });
});

describe('generateShape — size scaling', () => {
  test.each(TYPES)('%s: doubling size roughly doubles the perimeter', (type) => {
    const p = { size: 1, sides: 6, points: 5, aspect: 1.5 };
    const a = generateShape(type, p);
    const b = generateShape(type, { ...p, size: 2 });
    expect(b.length / a.length).toBeCloseTo(2, 1);
  });

  test.each(TYPES)('%s: all sampled points lie within the bounding radius', (type) => {
    const size = 1;
    const shape = generateShape(type, { size, sides: 6, points: 5, aspect: 1 });
    const maxR = Math.max(...shape.points.map((p) => Math.hypot(p.x, p.y)));
    // For aspect 1 the farthest point is at radius size/2 (circle/polygon/star)
    // or the rectangle half-diagonal; allow generous slack for the rectangle.
    expect(maxR).toBeLessThanOrEqual((size / 2) * Math.SQRT2 + 1e-6);
  });
});

describe('generateShape polygon — perimeter geometry', () => {
  test.each([3, 4, 6, 8])('regular %i-gon perimeter ≈ n·2r·sin(π/n)', (n) => {
    const size = 1, r = size / 2;
    const { length } = generateShape('polygon', { size, sides: n });
    const expected = n * 2 * r * Math.sin(Math.PI / n);
    expect(length).toBeCloseTo(expected, 2);
  });

  test('polygon normals point outward (dot with position > 0 on flat edges)', () => {
    const { points, normals } = generateShape('polygon', { size: 2, sides: 4 });
    // Most samples sit on flat edges where the outward normal aligns with position.
    let outward = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].x * normals[i].x + points[i].y * normals[i].y > 0) outward++;
    }
    expect(outward / points.length).toBeGreaterThan(0.9);
  });
});

describe('generateShape star — geometry', () => {
  test('farthest sampled point ≈ outer radius (size/2)', () => {
    const size = 1;
    const { points } = generateShape('star', { size, points: 5 });
    const maxR = Math.max(...points.map((p) => Math.hypot(p.x, p.y)));
    expect(maxR).toBeCloseTo(size / 2, 1);
  });

  test('more points → longer perimeter', () => {
    const a = generateShape('star', { size: 1, points: 4 });
    const b = generateShape('star', { size: 1, points: 9 });
    expect(b.length).toBeGreaterThan(a.length);
  });
});

describe('generateShape — sample count is fixed', () => {
  test.each(TYPES)('%s yields a consistent, large sample count', (type) => {
    const shape = generateShape(type, { size: 1, sides: 7, points: 6, aspect: 1.2 });
    expect(shape.points.length).toBe(512);
    expect(shape.tangents.length).toBe(512);
    expect(shape.normals.length).toBe(512);
  });
});
