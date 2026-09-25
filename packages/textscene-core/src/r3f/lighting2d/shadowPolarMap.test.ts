/**
 * Expected values quote Godot's sources, so a drifting port fails against the
 * engine rather than against itself.
 */

import { describe, it, expect } from 'vitest';
import {
  SHADOW_MAP_BINS,
  SHADOW_MAP_FAR,
  buildShadowPolarMap,
  shadowMapCoord,
  type ShadowPolarLight,
} from './shadowPolarMap';
import {
  OCCLUDER_CULL_DISABLED,
  OCCLUDER_CULL_CLOCKWISE,
  OCCLUDER_CULL_COUNTER_CLOCKWISE,
  type LightRect,
  type OccluderCullMode,
  type ShadowCasterEdges,
} from './shadowVolumes';

/** A rect no occluder can fall outside, so a test not about the cull measures only its own subject. */
const UNBOUNDED: LightRect = {
  minX: -Infinity,
  minY: -Infinity,
  maxX: Infinity,
  maxY: Infinity,
};

/** A light at the world origin with no rotation or scale, reach `radius`. */
function lightAt(x: number, y: number, radius: number): ShadowPolarLight {
  return { worldToLocal: [1, 0, -x, 0, 1, -y], radius, rect: UNBOUNDED };
}

/**
 * `tex_ofs * SHADOW_MAP_BINS` rounded to the nearest bin centre. Pinned apart
 * from the mapping: quadrant 0 draws into `glViewport(0, …, shadow_texture_size / 4, 2)`
 * through `(x, y, 0) → (y, 0, -x)`, so its column is `(y/x) * 256 + 256`.
 */
function binOf(u: number): number {
  return Math.round(u * SHADOW_MAP_BINS - 0.5);
}

function segment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cullMode: OccluderCullMode = OCCLUDER_CULL_DISABLED
): ShadowCasterEdges {
  return { segments: [ax, ay, bx, by], cullMode };
}

/**
 * `drivers/gles3/shaders/canvas.glsl:821-843`, with `pos_box = pos_norm / max(pos_abs.x, pos_abs.y)`:
 * +X `tex_ofs = pos_box.y * 0.125 + 0.125`, +Y `pos_box.x * -0.125 + (0.25 + 0.125)`,
 * -X `pos_box.y * -0.125 + (0.5 + 0.125)`, -Y `pos_box.x * 0.125 + (0.75 + 0.125)`.
 * `dist` is `shadow_pos.x`, `shadow_pos.y`, `-shadow_pos.x` and `-shadow_pos.y` in turn.
 */
describe('shadowMapCoord', () => {
  it('places the four axes at the four quadrant centres', () => {
    // Godot's local space is Y-down and the previewer's is Y-up, so the builder
    // takes previewer coordinates and negates Y itself. +X stays +X.
    expect(shadowMapCoord(1, 0)).toBeCloseTo(0.125, 12);
    // Godot +Y (down) is previewer -Y.
    expect(shadowMapCoord(0, -1)).toBeCloseTo(0.375, 12);
    expect(shadowMapCoord(-1, 0)).toBeCloseTo(0.625, 12);
    expect(shadowMapCoord(0, 1)).toBeCloseTo(0.875, 12);
  });

  it('is the tan (box) mapping inside a quadrant, not uniform angle', () => {
    // Halfway along the +X quadrant by box coordinate is pos_box.y = 0.5, which
    // is 26.57 degrees, not the 22.5 a uniform-angle map would put there.
    expect(shadowMapCoord(1, -0.5)).toBeCloseTo(0.125 + 0.0625, 12);
    expect(shadowMapCoord(2, -1)).toBeCloseTo(0.125 + 0.0625, 12);
  });

  it('runs monotonically 0 to 1 once around, and wraps at the -Y/+X seam', () => {
    // The seam is Godot (1, -1)/sqrt2, previewer (1, 1). `pos_rot.y` is exactly
    // zero there, so Godot's `> 0.0` sends it to the -Y branch and it reads 1.0,
    // the same texel as 0.0 under the atlas's GL_REPEAT wrap.
    expect(shadowMapCoord(1, 1)).toBeCloseTo(1, 12);
    expect(shadowMapCoord(1, -1)).toBeCloseTo(0.25, 12);
    expect(shadowMapCoord(-1, -1)).toBeCloseTo(0.5, 12);
    expect(shadowMapCoord(-1, 1)).toBeCloseTo(0.75, 12);
  });

  it('places an antipodal direction exactly half a turn away', () => {
    // u(theta + pi) = u(theta) + 0.5 for the box mapping: the builder relies on
    // it to pick the short arc between a segment's endpoints.
    for (const [x, y] of [[3, 1], [1, 4], [-2, 5], [-7, -3]] as const) {
      const opposite = (shadowMapCoord(x, y) + 0.5) % 1;
      expect(shadowMapCoord(-x, -y)).toBeCloseTo(opposite, 12);
    }
  });
});

/**
 * `drivers/gles3/shaders/canvas_occlusion.glsl:28,56`: a bin holds the axis distance,
 * `depth = dot(direction, vtx.xy); out_depth = depth / z_far;`.
 */
describe('buildShadowPolarMap', () => {
  // `servers/rendering/renderer_viewport.cpp:485,556`: `radius_cache =
  // local_rect.size.length()`, `near = radius/1000`, `far = radius * 1.1`.
  const RADIUS = 1000;
  const ZFAR = RADIUS * 1.1;

  it('leaves every bin at far when nothing casts', () => {
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), []);
    expect(map).toHaveLength(SHADOW_MAP_BINS);
    expect([...map].every((v) => v === SHADOW_MAP_FAR)).toBe(true);
  });

  it('stores the AXIS distance, not the Euclidean one', () => {
    // A vertical segment at x = 100 spanning y in [-50, 50] (previewer space).
    // Every ray that reaches it crosses x = 100, so every covered bin holds
    // 100 / zfar however far along the segment the hit lands. A Euclidean map
    // would hold up to hypot(100, 50) / zfar at the ends.
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(100, -50, 100, 50)]);
    const centre = binOf(shadowMapCoord(100, 0));
    const nearEnd = binOf(shadowMapCoord(100, 49));
    expect(map[centre]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[nearEnd]).toBeCloseTo(100 / ZFAR, 6);
  });

  it('covers exactly the bins between the endpoints, and no others', () => {
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(100, -50, 100, 50)]);
    // Endpoint coords under the box mapping: pos_box.y = -y/x in Godot space.
    const lo = binOf(shadowMapCoord(100, 50));
    const hi = binOf(shadowMapCoord(100, -50));
    expect(lo).toBeLessThan(hi);
    for (let bin = 0; bin < SHADOW_MAP_BINS; bin += 1) {
      const covered = map[bin]! < SHADOW_MAP_FAR;
      // The two boundary bins straddle the endpoint ray, so only the strictly
      // interior range is asserted covered and the strictly exterior uncovered.
      if (bin > lo + 1 && bin < hi - 1) expect(covered).toBe(true);
      if (bin < lo - 1 || bin > hi + 1) expect(covered).toBe(false);
    }
  });

  it('lands the endpoint rays on the bins the box mapping names', () => {
    // 100 wide, 100 tall: the endpoints sit on the quadrant diagonals, so
    // pos_box.y = -+1 and the covered range is exactly the +X quadrant.
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(100, -100, 100, 100)]);
    expect(map[0]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[SHADOW_MAP_BINS / 4 - 1]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[SHADOW_MAP_BINS / 4]).toBe(SHADOW_MAP_FAR);
    expect(map[SHADOW_MAP_BINS - 1]).toBe(SHADOW_MAP_FAR);
  });

  it('spans three quadrants, and the wrap, for a wide segment', () => {
    // A horizontal segment 100 above the light in previewer space, reaching 150
    // either side. Its endpoints sit at u = 0.708 and u = 0.042, so the covered
    // arc runs through the -X quadrant, the whole of -Y, and across the seam
    // into +X, which holds only if the walk takes the short way.
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(-150, 100, 150, 100)]);
    // Straight up: Godot -Y, the quadrant centre at u = 0.875, axis distance 100.
    expect(map[binOf(0.875)]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[binOf(0.72)]).toBeLessThan(SHADOW_MAP_FAR);
    // A +X-quadrant bin stores the distance along +X, not the perpendicular
    // 100. Inverting `tex_ofs = pos_box.y * 0.125 + 0.125` by hand at bin 40's
    // centre gives the ray (1, 8u - 1), which meets Godot y = -100 at
    // x = 100 / (1 - 8u).
    const u = 40.5 / SHADOW_MAP_BINS;
    expect(binOf(0.02)).toBe(40);
    expect(map[40]).toBeCloseTo(100 / (1 - 8 * u) / ZFAR, 6);
    // Off the ends of the arc: beyond the left endpoint, and straight down.
    expect(map[binOf(0.65)]).toBe(SHADOW_MAP_FAR);
    expect(map[binOf(0.375)]).toBe(SHADOW_MAP_FAR);
  });

  it('leaves the opposite quadrant clear for a segment behind the light', () => {
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(-100, -50, -100, 50)]);
    expect(map[binOf(shadowMapCoord(-100, 0))]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[binOf(shadowMapCoord(100, 0))]).toBe(SHADOW_MAP_FAR);
  });

  it('fills every bin when the light sits inside a closed polygon', () => {
    // A square wound as a closed occluder, the wrap edge already appended, as
    // `polygonToSegments` hands it over.
    const square: ShadowCasterEdges = {
      segments: [
        -80, -80, 80, -80,
        80, -80, 80, 80,
        80, 80, -80, 80,
        -80, 80, -80, -80,
      ],
      cullMode: OCCLUDER_CULL_DISABLED,
    };
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [square]);
    expect([...map].every((v) => v < SHADOW_MAP_FAR)).toBe(true);
    // On the axes the nearest wall is 80 away along that axis.
    expect(map[binOf(0.125)]).toBeCloseTo(80 / ZFAR, 6);
    expect(map[binOf(0.625)]).toBeCloseTo(80 / ZFAR, 6);
  });

  it('packs the quadrants contiguously across a diagonal, switching the axis', () => {
    // The Godot-local segment x = 100, y in [50, 150] crosses y = x at (100, 100).
    // `light_update_shadow` gives quadrant 0 the texels [0, 512) and quadrant 1
    // [512, 1024), so the run is unbroken at 512 while the stored quantity
    // switches from `shadow_pos.x` to `shadow_pos.y`.
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(100, -50, 100, -150)]);

    // Quadrant 0's last texel: ray (1, 8u − 1), axis +X, so it stores x = 100.
    expect(map[511]).toBeCloseTo(100 / ZFAR, 6);
    // Quadrant 1's first: ray (3 − 8u, 1), axis +Y, so it stores y where the ray
    // meets x = 100: a different number for a neighbouring texel, by design.
    expect(map[512]).toBeCloseTo(100 / (3 - 8 * (512.5 / SHADOW_MAP_BINS)) / ZFAR, 6);
    expect(map[512]).not.toBeCloseTo(map[511]!, 6);

    // Endpoint bins by hand from the box mapping: pos_box.y = 0.5 at one end
    // (u = 0.1875) and pos_box.x = 2/3 at the other (u = 0.29167).
    for (let bin = 384; bin <= 596; bin += 1) {
      expect(map[bin], `bin ${bin}`).toBeLessThan(SHADOW_MAP_FAR);
    }
    expect(map[383]).toBe(SHADOW_MAP_FAR);
    expect(map[597]).toBe(SHADOW_MAP_FAR);
  });

  it('normalises by radius * 1.1, which is what makes z_far cancel in the test', () => {
    // `canvas_occlusion.glsl:56` divides the stored depth by z_far and
    // `canvas.glsl:845` multiplies the fragment's axis distance by the same
    // `shadow_zfar_inv`, so `step(sd, dist)` is scale-free only while the builder
    // uses Godot's divisor, the shader's uniform 1 / (radius * 1.1).
    const small = buildShadowPolarMap(lightAt(0, 0, 500), [segment(100, -50, 100, 50)]);
    const large = buildShadowPolarMap(lightAt(0, 0, 2000), [segment(100, -50, 100, 50)]);
    expect(small[binOf(0.125)]).toBeCloseTo(100 / (500 * 1.1), 6);
    expect(large[binOf(0.125)]).toBeCloseTo(100 / (2000 * 1.1), 6);
  });

  it('keeps the nearest of two occluders in the same direction', () => {
    const map = buildShadowPolarMap(lightAt(0, 0, RADIUS), [
      segment(200, -50, 200, 50),
      segment(100, -50, 100, 50),
    ]);
    expect(map[binOf(0.125)]).toBeCloseTo(100 / ZFAR, 6);
  });

  it('drops an occluder whose bounds miss the light rect, as the stencil path does', () => {
    // Godot culls occluders against `rect_cache` before the shadow map is drawn
    // at all, so an occluder inside the far plane but outside the cookie's own
    // extent casts nothing. Both mechanisms must answer this the same way or a
    // light's shadow would change shape at `shadow_filter = NONE`.
    const rect: LightRect = { minX: -200, minY: -200, maxX: 200, maxY: 200 };
    const outside = buildShadowPolarMap(
      { worldToLocal: [1, 0, 0, 0, 1, 0], radius: RADIUS, rect },
      [segment(400, -50, 400, 50)]
    );
    expect(outside[binOf(0.125)]).toBe(SHADOW_MAP_FAR);

    // The same occluder inside the rect still casts, so the rejection above is
    // the rect and not the geometry.
    const inside = buildShadowPolarMap(
      { worldToLocal: [1, 0, 0, 0, 1, 0], radius: RADIUS, rect },
      [segment(100, -50, 100, 50)]
    );
    expect(inside[binOf(0.125)]).toBeCloseTo(100 / ZFAR, 6);
  });

  it('drops an occluder clipped away by the near or the far plane', () => {
    // near = radius / 1000 = 1, far = radius * 1.1 = 1100.
    const tooClose = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(0.5, -50, 0.5, 50)]);
    expect(tooClose[binOf(0.125)]).toBe(SHADOW_MAP_FAR);
    const tooFar = buildShadowPolarMap(lightAt(0, 0, RADIUS), [segment(2000, -50, 2000, 50)]);
    expect(tooFar[binOf(0.125)]).toBe(SHADOW_MAP_FAR);
  });

  it('honours cull_mode by the edge winding relative to the light', () => {
    // Same edge, both windings, under both culling modes. This is the test
    // `edgeCastsShadow` already answers for the stencil path; the polar map must
    // answer it identically or a filtered light would shadow from the far side.
    const forward = segment(100, -50, 100, 50, OCCLUDER_CULL_CLOCKWISE);
    const reversed = segment(100, 50, 100, -50, OCCLUDER_CULL_CLOCKWISE);
    const bin = binOf(0.125);
    const a = buildShadowPolarMap(lightAt(0, 0, RADIUS), [forward])[bin]!;
    const b = buildShadowPolarMap(lightAt(0, 0, RADIUS), [reversed])[bin]!;
    expect([a === SHADOW_MAP_FAR, b === SHADOW_MAP_FAR]).toEqual([false, true]);

    const ccw = buildShadowPolarMap(lightAt(0, 0, RADIUS), [
      segment(100, -50, 100, 50, OCCLUDER_CULL_COUNTER_CLOCKWISE),
    ])[bin]!;
    expect(ccw).toBe(SHADOW_MAP_FAR);
  });

  it('works from a light that is translated, rotated and scaled', () => {
    // The light sits at world (400, 300), rotated a quarter turn. Its local +X
    // points along world +Y, so an occluder 100 along world +Y from the light
    // must land in the local +X quadrant at axis distance 100.
    const c = Math.cos(Math.PI / 2);
    const s = Math.sin(Math.PI / 2);
    // world -> local = R(-t) * (p - origin)
    const worldToLocal: [number, number, number, number, number, number] = [
      c, s, -(c * 400 + s * 300),
      -s, c, -(-s * 400 + c * 300),
    ];
    const map = buildShadowPolarMap({ worldToLocal, radius: RADIUS, rect: UNBOUNDED }, [
      segment(350, 400, 450, 400),
    ]);
    expect(map[binOf(0.125)]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[binOf(0.625)]).toBe(SHADOW_MAP_FAR);
  });

  it('ignores a degenerate edge and a caster with no segments', () => {
    const degenerate = buildShadowPolarMap(lightAt(0, 0, RADIUS), [
      segment(100, 0, 100, 0),
      { segments: [], cullMode: OCCLUDER_CULL_DISABLED },
      // Collinear with the light: no area, and `edgeCastsShadow` rejects it.
      segment(100, 0, 200, 0),
    ]);
    expect([...degenerate].every((v) => v === SHADOW_MAP_FAR)).toBe(true);
  });
});
