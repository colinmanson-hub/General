import { generateShape } from '../renderer/shapes.js';

const TYPES = ['circle', 'rectangle', 'polygon', 'star'];

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

  test('arc-length spacing is uniform (max/min ratio < 1.05)', () => {
    const dists = spacing(shape.points);
    const max = Math.max(...dists), min = Math.min(...dists);
    expect(max / min).toBeLessThan(1.05);
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
});

describe('generateShape rectangle', () => {
  test('perimeter ≈ 2*(w+h)', () => {
    const size = 1, aspect = 2;
    const { length } = generateShape('rectangle', { size, aspect });
    expect(length).toBeCloseTo(2 * (size * aspect + size), 1);
  });
});

describe('generateShape defaults', () => {
  test('unknown type falls back to circle', () => {
    const s = generateShape('unknown', { size: 1 });
    expect(s.points.length).toBeGreaterThan(0);
  });
});
