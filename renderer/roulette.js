// Issue #4: Generalized roulette curve (hypotrochoid / epitrochoid generalized to any closed base shape)

export function createRoulette(shape, { r, d, side }) {
  const { points, normals, tangents, length } = shape;
  const n = points.length;
  const sign = side === 'outside' ? 1 : -1;

  // Live multiplier on the pen offset, driven by audio (bass) at draw time.
  let penScale = 1;

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

    // Absolute pen direction. Two contributions:
    //  1. The base frame itself rotates as the contact point travels the curve —
    //     captured by the outward-normal angle `a`. For a circle a = s/R; for a
    //     straight edge a is constant.
    //  2. The wheel spins by s/r as it rolls without slipping.
    // Combining gives the classic spirograph result. For a circle (a = s/R):
    //   inside : phi = a - s/r  → pen term angle ((R-r)/r)·t  (hypotrochoid)
    //   outside: phi = a + s/r + π → pen term angle ((R+r)/r)·t (epitrochoid)
    const a = Math.atan2(ny, nx);
    const phi = a + sign * (s / r) + (sign > 0 ? Math.PI : 0);

    // Pen offset vector rotated by phi
    const dEff = d * penScale;
    const px = cx + dEff * Math.cos(phi);
    const py = cy + dEff * Math.sin(phi);

    return { x: px, y: py };
  }

  return {
    pointAt,
    totalT,
    setPenScale(s) { penScale = Number.isFinite(s) && s > 0 ? s : 1; },
    getPenScale() { return penScale; },
  };
}
