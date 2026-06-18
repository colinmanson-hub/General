// Issue #4: Generalized roulette curve (hypotrochoid / epitrochoid generalized to any closed base shape)

export function createRoulette(shape, { r, d, side }) {
  const { points, normals, tangents, length } = shape;
  const n = points.length;
  const sign = side === 'outside' ? 1 : -1;

  // totalT: advance the pen exactly `loops` times around the base curve.
  // Caller sets loops; here we just expose totalT = length so one traversal is t in [0, length].
  // Caller multiplies by loops in the main loop.
  const totalT = length;

  // Interpolate position/tangent/normal on the shape by arc-length s (wraps)
  function sampleShape(s) {
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
    const nmLen = Math.hypot(nm.x, nm.y) || 1;
    return { p, nx: nm.x / nmLen, ny: nm.y / nmLen };
  }

  function pointAt(t) {
    // s: arc-length position along the base curve
    const s = t;
    const { p, nx, ny } = sampleShape(s);

    // Wheel center: offset r along the inward (inside) or outward (outside) normal
    const cx = p.x + sign * r * nx;
    const cy = p.y + sign * r * ny;

    // Wheel rotation: phi = s/r (sign matches rolling direction)
    // For inside: wheel rotates opposite to travel; for outside: same direction
    const phi = -sign * s / r;

    // Pen offset vector rotated by phi (initial direction along +x)
    const px = cx + d * Math.cos(phi);
    const py = cy + d * Math.sin(phi);

    return { x: px, y: py };
  }

  return { pointAt, totalT };
}
