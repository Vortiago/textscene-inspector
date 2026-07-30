import { describe, it, expect } from 'vitest';
import {
  buildShadowVolumes,
  casterInLightRect,
  edgeCastsShadow,
  edgeShadowRing,
  lightReach,
  OCCLUDER_CULL_CLOCKWISE,
  OCCLUDER_CULL_COUNTER_CLOCKWISE,
  OCCLUDER_CULL_DISABLED,
  type LightRect,
  type ShadowLight,
} from './shadowVolumes';

/** A light at the origin whose rect reaches 512 units in every direction. */
function lightAt(x = 0, y = 0, reach = 512): ShadowLight {
  return {
    x,
    y,
    rect: { minX: x - reach, minY: y - reach, maxX: x + reach, maxY: y + reach },
  };
}

/**
 * Is (px, py) covered by the emitted triangles? This reads the SHIPPED buffer
 * the way the rasteriser will, rather than re-deriving the wedge — a test that
 * recomputed the maths would pass on a broken triangulation.
 */
function covered(positions: Float32Array | null, px: number, py: number): boolean {
  if (!positions) return false;
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const ax = positions[i]!, ay = positions[i + 1]!;
    const bx = positions[i + 3]!, by = positions[i + 4]!;
    const cx = positions[i + 6]!, cy = positions[i + 7]!;
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    const anyNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const anyPos = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(anyNeg && anyPos)) return true;
  }
  return false;
}

/** Flat `[ax,ay, bx,by, …]` for a ring of points, closed or open. */
function edges(points: readonly (readonly [number, number])[], closed: boolean): Float32Array {
  const count = closed ? points.length : points.length - 1;
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.set([a[0], a[1], b[0], b[1]], i * 4);
  }
  return out;
}

describe('lightReach', () => {
  it('measures to the far corner of the rect, not its edge', () => {
    expect(lightReach(lightAt(0, 0, 10))).toBeCloseTo(Math.hypot(10, 10), 10);
  });

  it('measures from the shadow origin when the rect is offset off it', () => {
    const light: ShadowLight = { x: 0, y: 0, rect: { minX: 10, minY: 10, maxX: 30, maxY: 30 } };
    expect(lightReach(light)).toBeCloseTo(Math.hypot(30, 30), 10);
  });

  it('is zero for a degenerate rect centred on the light', () => {
    expect(lightReach({ x: 5, y: 5, rect: { minX: 5, minY: 5, maxX: 5, maxY: 5 } })).toBe(0);
  });
});

describe('edgeCastsShadow', () => {
  const L = { x: 0, y: 0 };

  it('takes every non-degenerate edge when culling is disabled', () => {
    expect(edgeCastsShadow(100, -50, 100, 50, L.x, L.y, OCCLUDER_CULL_DISABLED)).toBe(true);
    expect(edgeCastsShadow(100, 50, 100, -50, L.x, L.y, OCCLUDER_CULL_DISABLED)).toBe(true);
  });

  it('splits the two winding modes across the same edge', () => {
    const cw = edgeCastsShadow(100, -50, 100, 50, L.x, L.y, OCCLUDER_CULL_CLOCKWISE);
    const ccw = edgeCastsShadow(100, -50, 100, 50, L.x, L.y, OCCLUDER_CULL_COUNTER_CLOCKWISE);
    expect(cw).not.toBe(ccw);
  });

  it('flips which mode takes an edge when the edge is reversed', () => {
    const forward = edgeCastsShadow(100, -50, 100, 50, L.x, L.y, OCCLUDER_CULL_CLOCKWISE);
    const reversed = edgeCastsShadow(100, 50, 100, -50, L.x, L.y, OCCLUDER_CULL_CLOCKWISE);
    expect(forward).not.toBe(reversed);
  });

  it('rejects an edge collinear with the light, in front of it or straddling it', () => {
    for (const mode of [
      OCCLUDER_CULL_DISABLED,
      OCCLUDER_CULL_CLOCKWISE,
      OCCLUDER_CULL_COUNTER_CLOCKWISE,
    ] as const) {
      // Pointing away from the light along +X.
      expect(edgeCastsShadow(100, 0, 200, 0, L.x, L.y, mode)).toBe(false);
      // Straddling the light.
      expect(edgeCastsShadow(-100, 0, 100, 0, L.x, L.y, mode)).toBe(false);
    }
  });

  it('rejects a zero-length edge', () => {
    expect(edgeCastsShadow(100, 50, 100, 50, L.x, L.y, OCCLUDER_CULL_DISABLED)).toBe(false);
  });

  it('rejects an edge carrying a non-finite coordinate rather than emitting NaN downstream', () => {
    expect(edgeCastsShadow(NaN, 50, 100, -50, L.x, L.y, OCCLUDER_CULL_DISABLED)).toBe(false);
    expect(edgeCastsShadow(100, 50, Infinity, -50, L.x, L.y, OCCLUDER_CULL_DISABLED)).toBe(false);
  });
});

describe('edgeShadowRing', () => {
  const light = lightAt();
  const reach = lightReach(light);

  it('opens on the edge itself and closes past the light reach', () => {
    const ring = edgeShadowRing(100, -50, 100, 50, light, reach)!;
    expect(ring).not.toBeNull();
    expect(Array.from(ring.slice(0, 4))).toEqual([100, -50, 100, 50]);
    for (let i = 4; i < 10; i += 2) {
      expect(Math.hypot(ring[i]!, ring[i + 1]!)).toBeGreaterThan(reach);
    }
  });

  it('keeps every far vertex on its own ray from the light', () => {
    const ring = edgeShadowRing(100, -50, 100, 50, light, reach)!;
    // bFar is colinear with b, aFar with a (cross product of the two directions is 0).
    expect(ring[4]! * 50 - ring[5]! * 100).toBeCloseTo(0, 6);
    expect(ring[8]! * -50 - ring[9]! * 100).toBeCloseTo(0, 6);
  });

  it('returns null for a zero-length edge', () => {
    expect(edgeShadowRing(100, 50, 100, 50, light, reach)).toBeNull();
  });

  it('returns null when an endpoint sits exactly on the light', () => {
    expect(edgeShadowRing(0, 0, 100, 50, light, reach)).toBeNull();
    expect(edgeShadowRing(100, 50, 0, 0, light, reach)).toBeNull();
  });

  it('returns null when the light lies between the endpoints', () => {
    expect(edgeShadowRing(-100, 0, 100, 0, light, reach)).toBeNull();
  });

  it('pushes the cap past an endpoint that is already outside the light reach', () => {
    const far = 4000;
    const ring = edgeShadowRing(far, -50, far, 50, light, reach)!;
    for (let i = 4; i < 10; i += 2) {
      expect(Math.hypot(ring[i]!, ring[i + 1]!)).toBeGreaterThan(far);
    }
  });

  it('never produces a NaN coordinate', () => {
    const ring = edgeShadowRing(1e-6, -1e-6, 100, 50, light, reach)!;
    expect(Array.from(ring).every(Number.isFinite)).toBe(true);
  });
});

describe('casterInLightRect', () => {
  const rect: LightRect = { minX: -10, minY: -10, maxX: 10, maxY: 10 };

  it('keeps an occluder overlapping the rect', () => {
    expect(casterInLightRect(new Float32Array([5, 5, 40, 40]), rect)).toBe(true);
  });

  it('keeps an occluder that merely touches the rect edge', () => {
    expect(casterInLightRect(new Float32Array([10, 0, 40, 0]), rect)).toBe(true);
  });

  it('drops an occluder entirely outside the rect', () => {
    expect(casterInLightRect(new Float32Array([20, 20, 40, 40]), rect)).toBe(false);
  });

  it('drops an empty or half-specified segment list', () => {
    expect(casterInLightRect(new Float32Array([]), rect)).toBe(false);
    expect(casterInLightRect(new Float32Array([1, 2]), rect)).toBe(false);
  });
});

describe('buildShadowVolumes — a single segment east of the light', () => {
  const light = lightAt();
  // Wedge boundary rays run from (0,0) through (100, ∓50), so at x = 200 the
  // shadow spans y ∈ (−100, 100).
  const caster = { segments: new Float32Array([100, -50, 100, 50]), cullMode: OCCLUDER_CULL_DISABLED } as const;
  const volumes = buildShadowVolumes(light, [caster]);

  it('emits one 5-gon fanned into three triangles', () => {
    expect(volumes).not.toBeNull();
    expect(volumes!.length).toBe(27);
    expect(Array.from(volumes!).every(Number.isFinite)).toBe(true);
  });

  it('leaves z at the canvas plane', () => {
    for (let i = 2; i < volumes!.length; i += 3) expect(volumes![i]).toBe(0);
  });

  it('shadows directly behind the segment', () => {
    expect(covered(volumes, 200, 0)).toBe(true);
    expect(covered(volumes, 480, 0)).toBe(true);
  });

  it('leaves the space between the light and the segment lit', () => {
    expect(covered(volumes, 50, 0)).toBe(false);
    expect(covered(volumes, 99, 0)).toBe(false);
  });

  it('leaves the far side of the light lit', () => {
    expect(covered(volumes, -200, 0)).toBe(false);
  });

  it('bounds the wedge by the rays through the endpoints', () => {
    expect(covered(volumes, 200, 90)).toBe(true);
    expect(covered(volumes, 200, -90)).toBe(true);
    expect(covered(volumes, 200, 110)).toBe(false);
    expect(covered(volumes, 200, -110)).toBe(false);
  });

  it('covers the rect out to its far edge, where the cap could have cut in', () => {
    // The wedge spans |y| < x/2, so (512, 250) is the deepest in-wedge point of
    // the rect and the one a too-short extrusion would miss.
    expect(covered(volumes, 512, 250)).toBe(true);
    expect(covered(volumes, 512, -250)).toBe(true);
  });

  it('still covers the rect corner for a wedge that nearly wraps the light', () => {
    // The light sits 1 unit off the middle of a long segment, so the wedge
    // subtends almost π — the case the bisector cap exists for.
    const wide = buildShadowVolumes(light, [
      { segments: new Float32Array([1, -4000, 1, 4000]), cullMode: OCCLUDER_CULL_DISABLED },
    ]);
    expect(covered(wide, 512, 512)).toBe(true);
    expect(covered(wide, 512, -512)).toBe(true);
    expect(covered(wide, 5, 0)).toBe(true);
  });

  it('returns null when the only occluder lies outside the light rect', () => {
    const outside = buildShadowVolumes(light, [
      { segments: new Float32Array([900, -50, 900, 50]), cullMode: OCCLUDER_CULL_DISABLED },
    ]);
    expect(outside).toBeNull();
  });

  it('returns null for an empty caster list and for a caster with no casting edge', () => {
    expect(buildShadowVolumes(light, [])).toBeNull();
    expect(
      buildShadowVolumes(light, [
        { segments: new Float32Array([100, 0, 200, 0]), cullMode: OCCLUDER_CULL_DISABLED },
      ])
    ).toBeNull();
  });

  it('ignores a dangling half-edge instead of reading past the end', () => {
    const ragged = buildShadowVolumes(light, [
      { segments: new Float32Array([100, -50, 100, 50, 100, 60]), cullMode: OCCLUDER_CULL_DISABLED },
    ]);
    expect(ragged!.length).toBe(27);
    expect(Array.from(ragged!).every(Number.isFinite)).toBe(true);
  });
});

describe('buildShadowVolumes — open versus closed polygons', () => {
  const light = lightAt();
  // An L of three points. Closed, the wrap-around edge (0,120)→(120,-120)
  // faces the light and shadows the region behind it.
  const points = [
    [120, -120],
    [120, 120],
    [0, 120],
  ] as const;

  it('a closed polygon emits one more edge than the open chain', () => {
    const open = buildShadowVolumes(light, [
      { segments: edges(points, false), cullMode: OCCLUDER_CULL_DISABLED },
    ]);
    const closed = buildShadowVolumes(light, [
      { segments: edges(points, true), cullMode: OCCLUDER_CULL_DISABLED },
    ]);
    expect(closed!.length - open!.length).toBe(27);
  });

  it('shadows the polygon interior only once it is closed', () => {
    const open = buildShadowVolumes(light, [
      { segments: edges(points, false), cullMode: OCCLUDER_CULL_DISABLED },
    ]);
    const closed = buildShadowVolumes(light, [
      { segments: edges(points, true), cullMode: OCCLUDER_CULL_DISABLED },
    ]);
    // Just inside the closing edge, on the light's side of the other two.
    expect(covered(open, 80, 30)).toBe(false);
    expect(covered(closed, 80, 30)).toBe(true);
  });
});

/**
 * Pinned against real Godot 4.6.3, from three copies of the shadow fixture that
 * differ only in `OccluderPolygon2D.cull_mode` — an 80×80 square at Godot
 * (576,324) wound (-40,-40) (40,-40) (40,40) (-40,40) in place of the segment,
 * each run through `pnpm ref:godot … --probe 560,324 --probe 576,324 --probe
 * 610,324 --probe 700,324`.
 *
 * All three probes inside the square read 63 (shadowed) under cull_mode 0 and
 * 1, and 111 / 106 / 97 (lit) under cull_mode 2 — so a winding mode really does
 * drop half the edges, and the two modes pick opposite halves. Godot (700,324),
 * behind the square, reads 63 in all three. Reversing the polygon's winding
 * swaps which mode does what, which is what makes the test below a winding
 * test rather than a hard-coded near/far rule.
 *
 * Coordinates below are the previewer's: Godot pixels with Y negated.
 */
describe('buildShadowVolumes — cull_mode against measured Godot', () => {
  const light = lightAt(400, -324);
  const square = [
    [536, -284],
    [616, -284],
    [616, -364],
    [536, -364],
  ] as const;
  const inside = [
    [560, -324],
    [576, -324],
    [610, -324],
  ] as const;

  function volumes(cullMode: 0 | 1 | 2) {
    return buildShadowVolumes(light, [{ segments: edges(square, true), cullMode }]);
  }

  it('CULL_DISABLED shadows the square interior', () => {
    const v = volumes(OCCLUDER_CULL_DISABLED);
    for (const [x, y] of inside) expect(covered(v, x, y)).toBe(true);
  });

  it('CULL_CLOCKWISE shadows the square interior for this winding', () => {
    const v = volumes(OCCLUDER_CULL_CLOCKWISE);
    for (const [x, y] of inside) expect(covered(v, x, y)).toBe(true);
  });

  it('CULL_COUNTER_CLOCKWISE leaves the square interior lit for this winding', () => {
    const v = volumes(OCCLUDER_CULL_COUNTER_CLOCKWISE);
    for (const [x, y] of inside) expect(covered(v, x, y)).toBe(false);
  });

  it('shadows behind the square in every cull mode', () => {
    for (const mode of [
      OCCLUDER_CULL_DISABLED,
      OCCLUDER_CULL_CLOCKWISE,
      OCCLUDER_CULL_COUNTER_CLOCKWISE,
    ] as const) {
      expect(covered(volumes(mode), 700, -324)).toBe(true);
    }
  });

  it('reverses which interior a winding mode shadows when the polygon is reversed', () => {
    const reversed = [...square].reverse();
    const v = buildShadowVolumes(light, [
      { segments: edges(reversed, true), cullMode: OCCLUDER_CULL_CLOCKWISE },
    ]);
    for (const [x, y] of inside) expect(covered(v, x, y)).toBe(false);
  });
});

/**
 * The shadow boundary, pinned against real Godot 4.6.3 via
 *
 *   pnpm ref:godot scenes/fixtures/unit-lightoccluder2d-shadow.tscn \
 *     --probe 300,324 --probe 500,324 --probe 700,324 \
 *     --probe 620,198 --probe 620,199 --probe 620,448 --probe 620,449
 *
 * (committed render: scripts/godot-ref/reference/unit-lightoccluder2d-shadow.png).
 * That fixture is a full-frame Color(0.25,0.25,0.25) surface — byte 63 unlit —
 * a PointLight2D at Godot (400,324) with `shadow_enabled`, and an open
 * OccluderPolygon2D segment from Godot (576,224) to (576,424).
 *
 *   300,324 → 121 lit       500,324 → 118 lit       700,324 → 63 shadowed
 *   620,198 →  97 lit       620,199 →  63 shadowed
 *   620,448 →  63 shadowed  620,449 →  96 lit
 *
 * A fully shadowed pixel reads the unlit surface EXACTLY: `shadow_color`
 * defaults to `Color(0,0,0,0)`, and canvas.glsl multiplies its alpha into the
 * light's before blending, so the shadowed light contributes nothing at all.
 * Both boundaries are a one-pixel step — `shadow_filter = NONE` really is a
 * hard test — and both land exactly where the light→endpoint ray crosses the
 * pixel centres.
 *
 * Further out Godot's boundary drifts up to a pixel inside the geometric ray,
 * because its shadow map quantises by angle where extruded volumes do not: at
 * Godot (700, …) the step measures between 153 and 154 where the ray crosses at
 * 153.26. That is the whole of the divergence, and it is sub-pixel at the radii
 * the corpus lights cover.
 */
describe('buildShadowVolumes — boundary against measured Godot', () => {
  const light = lightAt(400, -324, 512);
  const volumes = buildShadowVolumes(light, [
    { segments: new Float32Array([576, -224, 576, -424]), cullMode: OCCLUDER_CULL_DISABLED },
  ]);

  it('puts Godot pixel (620,198) outside the shadow and (620,199) inside', () => {
    expect(covered(volumes, 620.5, -198.5)).toBe(false);
    expect(covered(volumes, 620.5, -199.5)).toBe(true);
  });

  it('mirrors the same step on the other boundary', () => {
    expect(covered(volumes, 620.5, -448.5)).toBe(true);
    expect(covered(volumes, 620.5, -449.5)).toBe(false);
  });

  it('shadows the whole span between the boundaries', () => {
    for (let y = 200; y <= 448; y += 8) expect(covered(volumes, 620.5, -y - 0.5)).toBe(true);
  });
});
