// Issue #3: Base shape generators — uniform arc-length sampled closed curves

const NUM_SAMPLES = 512;

function resample(rawPoints, closed = true) {
  // Compute cumulative arc lengths
  const n = rawPoints.length;
  const arcLen = [0];
  for (let i = 1; i < n; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x;
    const dy = rawPoints[i].y - rawPoints[i - 1].y;
    arcLen.push(arcLen[i - 1] + Math.hypot(dx, dy));
  }
  if (closed) {
    const dx = rawPoints[0].x - rawPoints[n - 1].x;
    const dy = rawPoints[0].y - rawPoints[n - 1].y;
    arcLen.push(arcLen[n - 1] + Math.hypot(dx, dy));
  }
  const totalLen = arcLen[arcLen.length - 1];
  const step = totalLen / NUM_SAMPLES;

  const points = [];
  const tangents = [];
  const normals = [];

  // Full closed raw for interpolation
  const pts = closed ? [...rawPoints, rawPoints[0]] : rawPoints;

  for (let si = 0; si < NUM_SAMPLES; si++) {
    const target = si * step;
    // Binary search
    let lo = 0, hi = arcLen.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (arcLen[mid] <= target) lo = mid; else hi = mid;
    }
    const t = (target - arcLen[lo]) / (arcLen[lo + 1] - arcLen[lo]);
    const p0 = pts[lo], p1 = pts[lo + 1];
    points.push({ x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) });

    // Tangent = direction along the curve
    const tx = p1.x - p0.x, ty = p1.y - p0.y;
    const tlen = Math.hypot(tx, ty) || 1;
    tangents.push({ x: tx / tlen, y: ty / tlen });
    // Normal points outward (left-hand rule for CCW curve = inward; we use right = outward)
    normals.push({ x: ty / tlen, y: -tx / tlen });
  }

  // The per-segment tangents/normals step discontinuously at sharp corners
  // (polygon/rect/star vertices). A rolling wheel would otherwise teleport as the
  // frame flips in a single step. Spread each corner's turn over a few samples by
  // smoothing the frame, then re-normalize to keep unit vectors.
  smoothFrame(tangents);
  smoothFrame(normals);

  return { points, tangents, normals, length: totalLen };
}

// In-place circular moving-average smoothing of a vector field, re-normalized to unit.
function smoothFrame(vecs, iterations = 16) {
  const n = vecs.length;
  for (let it = 0; it < iterations; it++) {
    const prev = vecs.map((v) => ({ x: v.x, y: v.y }));
    for (let i = 0; i < n; i++) {
      const a = prev[(i - 1 + n) % n];
      const b = prev[i];
      const c = prev[(i + 1) % n];
      let x = (a.x + 2 * b.x + c.x) / 4;
      let y = (a.y + 2 * b.y + c.y) / 4;
      const len = Math.hypot(x, y) || 1;
      vecs[i].x = x / len;
      vecs[i].y = y / len;
    }
  }
}

function generateCircle(size) {
  const r = size / 2;
  const raw = [];
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const a = (2 * Math.PI * i) / NUM_SAMPLES;
    raw.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  // Tangent/normal are analytic for circle — compute directly
  const points = raw;
  const tangents = [], normals = [];
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const a = (2 * Math.PI * i) / NUM_SAMPLES;
    tangents.push({ x: -Math.sin(a), y: Math.cos(a) });
    normals.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return { points, tangents, normals, length: 2 * Math.PI * r };
}

function generateRectangle(size, aspect) {
  const w = size * aspect;
  const h = size;
  // CCW rectangle corners
  const corners = [
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
    { x: -w / 2, y: -h / 2 },
  ];
  return resample(corners);
}

function generatePolygon(size, sides) {
  const r = size / 2;
  const raw = [];
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides - Math.PI / 2;
    raw.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return resample(raw);
}

function generateOval(size, aspect) {
  const rx = size / 2;
  const ry = (size / 2) / (aspect || 1.6);
  const raw = [];
  const M = 256;
  for (let i = 0; i < M; i++) {
    const a = (2 * Math.PI * i) / M;
    raw.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  }
  return resample(raw);
}

function generateStar(size, numPoints) {
  const outer = size / 2;
  const inner = outer * 0.4;
  const raw = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const a = (Math.PI * i) / numPoints - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    raw.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return resample(raw);
}

export function generateShape(type, params) {
  const { size = 1, sides = 6, points: numPoints = 5, aspect = 1.5 } = params;
  switch (type) {
    case 'circle':    return generateCircle(size);
    case 'rectangle': return generateRectangle(size, aspect);
    case 'oval':      return generateOval(size, aspect);
    case 'polygon':   return generatePolygon(size, sides);
    case 'star':      return generateStar(size, numPoints);
    default:          return generateCircle(size);
  }
}
