// Generalized roulette curve.
//
// A "wheel" rolls without slipping along a base curve and a pen fixed to the
// wheel traces the design. The default circle wheel reproduces the classic
// hypotrochoid / epitrochoid exactly (the closed-form path below). Non-circular
// wheels (oval, triangle, …) use the general roulette construction:
//
//   world(Q) = B(s) + R(θ)·(Q − W(s))
//
// where B(s) is the base contact point, W(s) the wheel's contact point in its own
// frame (the wheel rolls so its arc length matches the base's), and θ aligns the
// wheel's tangent with the base's. Both paths share the same arc-length parameter t.

import { generateShape } from './shapes.js';

// Map a wheel-shape name to a generated, origin-centred curve sized to ~radius r.
function buildWheelShape(type, r, aspect) {
  const size = 2 * r;
  switch (type) {
    case 'oval':     return generateShape('oval', { size, aspect: aspect || 1.7 });
    case 'triangle': return generateShape('polygon', { size, sides: 3 });
    case 'square':   return generateShape('polygon', { size, sides: 4 });
    case 'pentagon': return generateShape('polygon', { size, sides: 5 });
    case 'hexagon':  return generateShape('polygon', { size, sides: 6 });
    default:         return generateShape('circle', { size });
  }
}

export function createRoulette(shape, opts) {
  const { r, d, side, type = 'circle', aspect = 1.7 } = opts;
  const { points, normals, tangents, length } = shape;
  const n = points.length;
  const sign = side === 'outside' ? 1 : -1;

  const isCircleWheel = !type || type === 'circle';

  // totalT: one full traversal of the base curve is t in [0, length].
  const totalT = length;

  // Wheel perimeter — circle is analytic (2πr); other wheels use their curve length.
  let wheelLength = 2 * Math.PI * r;
  let wheelShape = null;
  let wheelN = 0;
  if (!isCircleWheel) {
    wheelShape = buildWheelShape(type, r, aspect);
    wheelLength = wheelShape.length;
    wheelN = wheelShape.points.length;
  }

  // Interpolate base position + outward normal by arc-length s (wraps).
  function sampleBase(s) {
    const sWrap = ((s % length) + length) % length;
    const frac = (sWrap / length) * n;
    const i0 = Math.floor(frac) % n;
    const i1 = (i0 + 1) % n;
    const t = frac - Math.floor(frac);
    const p = {
      x: points[i0].x + t * (points[i1].x - points[i0].x),
      y: points[i0].y + t * (points[i1].y - points[i0].y),
    };
    const nm = {
      x: normals[i0].x + t * (normals[i1].x - normals[i0].x),
      y: normals[i0].y + t * (normals[i1].y - normals[i0].y),
    };
    const tg = {
      x: tangents[i0].x + t * (tangents[i1].x - tangents[i0].x),
      y: tangents[i0].y + t * (tangents[i1].y - tangents[i0].y),
    };
    const nmLen = Math.hypot(nm.x, nm.y) || 1;
    return { p, nx: nm.x / nmLen, ny: nm.y / nmLen, tang: Math.atan2(tg.y, tg.x) };
  }

  // Interpolate wheel-frame contact point + tangent angle by arc-length u (wraps).
  function sampleWheel(u) {
    const L = wheelLength;
    const uWrap = ((u % L) + L) % L;
    const frac = (uWrap / L) * wheelN;
    const i0 = Math.floor(frac) % wheelN;
    const i1 = (i0 + 1) % wheelN;
    const t = frac - Math.floor(frac);
    const wp = wheelShape.points;
    const wt = wheelShape.tangents;
    const x = wp[i0].x + t * (wp[i1].x - wp[i0].x);
    const y = wp[i0].y + t * (wp[i1].y - wp[i0].y);
    const tx = wt[i0].x + t * (wt[i1].x - wt[i0].x);
    const ty = wt[i0].y + t * (wt[i1].y - wt[i0].y);
    return { x, y, ang: Math.atan2(ty, tx) };
  }

  // --- Circle wheel: exact classic formula -------------------------------------
  function circlePointAt(t) {
    const s = t;
    const { p, nx, ny } = sampleBase(s);
    const cx = p.x + sign * r * nx;
    const cy = p.y + sign * r * ny;
    const a = Math.atan2(ny, nx);
    const phi = a + sign * (s / r) + (sign > 0 ? Math.PI : 0);
    return { x: cx + d * Math.cos(phi), y: cy + d * Math.sin(phi) };
  }

  // --- General wheel: roulette construction ------------------------------------
  // Body rotation θ aligns the wheel tangent with the base tangent. Returns the
  // rotation plus the contact sample so geometry helpers can reuse it.
  function generalFrame(s) {
    const B = sampleBase(s);
    const W = sampleWheel(s); // rolling: wheel arc length == base arc length
    const theta = B.tang - W.ang + (sign > 0 ? Math.PI : 0);
    return { B, W, theta, cos: Math.cos(theta), sin: Math.sin(theta) };
  }

  // Map a wheel-frame point Q to world coords for the rolling state at s.
  function toWorld(Q, fr) {
    const qx = Q.x - fr.W.x;
    const qy = Q.y - fr.W.y;
    return {
      x: fr.B.p.x + fr.cos * qx - fr.sin * qy,
      y: fr.B.p.y + fr.sin * qx + fr.cos * qy,
    };
  }

  function generalPointAt(t) {
    const fr = generalFrame(t);
    return toWorld({ x: d, y: 0 }, fr); // pen fixed in wheel frame at (d, 0)
  }

  const pointAt = isCircleWheel ? circlePointAt : generalPointAt;

  // Wheel outline + centre + pen in world coords at parameter s — used to draw
  // the manual-mode guide schematic.
  function getWheelGeometry(s = 0) {
    if (isCircleWheel) {
      const { p, nx, ny } = sampleBase(s);
      const center = { x: p.x + sign * r * nx, y: p.y + sign * r * ny };
      const outline = [];
      const STEPS = 64;
      for (let i = 0; i <= STEPS; i++) {
        const a = (2 * Math.PI * i) / STEPS;
        outline.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
      }
      return { center, outline, pen: circlePointAt(s) };
    }
    const fr = generalFrame(s);
    const center = toWorld({ x: 0, y: 0 }, fr);
    const outline = wheelShape.points.map((q) => toWorld(q, fr));
    if (outline.length) outline.push(outline[0]); // close the loop
    return { center, outline, pen: toWorld({ x: d, y: 0 }, fr) };
  }

  // How many traversals of the base curve until the pen returns to its exact
  // starting point. The base position/frame repeat only at integer multiples of
  // the base length; full closure additionally needs the wheel to complete a whole
  // number of rolls, i.e. k * baseLength / wheelLength must be an integer. Returns
  // the smallest such k; for irrational ratios the closest approximation is used.
  function getClosureLoops(maxLoops = 400, tolerance = 1e-3) {
    const ratio = length / wheelLength;
    if (!Number.isFinite(ratio) || ratio <= 0) return 1;
    let best = 1, bestErr = Infinity;
    for (let k = 1; k <= maxLoops; k++) {
      const frac = k * ratio;
      const err = Math.abs(frac - Math.round(frac));
      if (err < bestErr) { bestErr = err; best = k; }
      if (err < tolerance) return k;
    }
    return best;
  }

  return {
    pointAt,
    totalT,
    getClosureLoops,
    getWheelGeometry,
  };
}
