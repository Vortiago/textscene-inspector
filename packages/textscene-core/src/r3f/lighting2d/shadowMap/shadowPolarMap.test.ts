/**
 * Expected values quote Godot's sources, so a drifting port fails against the
 * engine rather than against itself.
 */

import { describe, it, expect } from 'vitest';
import { canvasShadowAtlasSize } from '../../../godot/rendering/canvasShadowAtlas';
import { SHADOW_MAP_FAR, buildShadowPolarMap, type ShadowPolarLight } from './shadowPolarMap';
import { type LightRect, type OccluderCullMode, type ShadowCasterEdges } from '../shadowCasterEdges';
import { worldEdges } from '../testing/worldEdges';
import { OccluderPolygon2DCullMode } from '../../../godot/scene/lightOccluder2d';

/** The size Godot uses when the project sets none. */
const DEFAULT_ATLAS_SIZE = canvasShadowAtlasSize(undefined);

/** A rect no test occluder falls outside, so a test not about the cull measures only its own subject. */
const UNBOUNDED: LightRect = {
  minX: -1e9,
  minY: -1e9,
  maxX: 1e9,
  maxY: 1e9,
};

/** The map at the project's default atlas size, which every test not about the size reads. */
function buildMap(light: ShadowPolarLight, casters: readonly ShadowCasterEdges[], bins = DEFAULT_ATLAS_SIZE) {
  return buildShadowPolarMap(light, casters, bins);
}

/** A light at the world origin with no rotation or scale, reach `radius`. */
function lightAt(x: number, y: number, radius: number): ShadowPolarLight {
  return { worldToLocal: [1, 0, -x, 0, 1, -y], radius, rect: UNBOUNDED };
}

/**
 * `tex_ofs * DEFAULT_ATLAS_SIZE` rounded to the nearest bin centre. Pinned apart
 * from the mapping: quadrant 0 draws into `glViewport(0, …, shadow_texture_size / 4, 2)`
 * through `(x, y, 0) → (y, 0, -x)`, so its column is `(y/x) * 256 + 256`.
 */
function binOf(u: number): number {
  return Math.round(u * DEFAULT_ATLAS_SIZE - 0.5);
}

function segment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cullMode: OccluderCullMode = OccluderPolygon2DCullMode.DISABLED
): ShadowCasterEdges {
  return worldEdges([ax, ay, bx, by], cullMode);
}

/**
 * `drivers/gles3/shaders/canvas.glsl:821-843`, with `pos_box = pos_norm / max(pos_abs.x, pos_abs.y)`:
 * +X `tex_ofs = pos_box.y * 0.125 + 0.125`, +Y `pos_box.x * -0.125 + (0.25 + 0.125)`,
 * -X `pos_box.y * -0.125 + (0.5 + 0.125)`, -Y `pos_box.x * 0.125 + (0.75 + 0.125)`.
 * `dist` is `shadow_pos.x`, `shadow_pos.y`, `-shadow_pos.x` and `-shadow_pos.y` in turn.
 */
/** `tex_ofs` in the +X quadrant, `pos_box.y * 0.125 + 0.125` with Godot's Y down. */
function plusXCoord(x: number, yUp: number): number {
  return (-yUp / x) * 0.125 + 0.125;
}

/**
 * The bins a short occluder across the ray towards `(x, y)` covers, 100 from the light. It spans
 * about a hundredth of a turn, so it covers a few bins either side of the ray's own.
 */
function binsTowards(x: number, y: number): number[] {
  const length = Math.hypot(x, y);
  const [alongX, alongY] = [(x / length) * 100, (y / length) * 100];
  const [acrossX, acrossY] = [-y / length, x / length];
  const map = buildMap(lightAt(0, 0, 1000), [
    segment(alongX - acrossX, alongY - acrossY, alongX + acrossX, alongY + acrossY),
  ]);
  return [...map.keys()].filter((bin) => map[bin]! < SHADOW_MAP_FAR);
}

/** The middle of a run of bins that does not cross the seam. */
const middleBin = (bins: readonly number[]) => (bins[0]! + bins[bins.length - 1]!) / 2;

/** Where a ray at `u` falls in bin indices, whose centres sit half a bin in. */
const rayBin = (u: number) => u * DEFAULT_ATLAS_SIZE - 0.5;

describe('the polar mapping of the map', () => {
  it('places the four axes at the four quadrant centres', () => {
    // Godot's local space is Y-down and the previewer's is Y-up, so the builder
    // takes previewer coordinates and negates Y itself. +X stays +X.
    expect(middleBin(binsTowards(1, 0))).toBeCloseTo(rayBin(0.125), 0);
    // Godot +Y (down) is previewer -Y.
    expect(middleBin(binsTowards(0, -1))).toBeCloseTo(rayBin(0.375), 0);
    expect(middleBin(binsTowards(-1, 0))).toBeCloseTo(rayBin(0.625), 0);
    expect(middleBin(binsTowards(0, 1))).toBeCloseTo(rayBin(0.875), 0);
  });

  it('is the tan (box) mapping inside a quadrant, not uniform angle', () => {
    // Halfway along the +X quadrant by box coordinate is pos_box.y = 0.5, which
    // is 26.57 degrees, not the 22.5 a uniform-angle map would put there.
    expect(middleBin(binsTowards(1, -0.5))).toBeCloseTo(rayBin(0.125 + 0.0625), 0);
  });

  it('runs 0 to 1 once around, and wraps at the -Y/+X seam (edge case)', () => {
    // The seam is Godot (1, -1)/sqrt2, previewer (1, 1). The atlas's GL_REPEAT
    // wrap makes bin 0 and the last bin neighbours there.
    const seam = binsTowards(1, 1);
    expect(seam).toContain(0);
    expect(seam).toContain(DEFAULT_ATLAS_SIZE - 1);
    expect(middleBin(binsTowards(1, -1))).toBeCloseTo(rayBin(0.25), 0);
    expect(middleBin(binsTowards(-1, -1))).toBeCloseTo(rayBin(0.5), 0);
    expect(middleBin(binsTowards(-1, 1))).toBeCloseTo(rayBin(0.75), 0);
  });

  it('places an antipodal direction exactly half a turn away', () => {
    // u(theta + pi) = u(theta) + 0.5 for the box mapping: the builder relies on
    // it to pick the short arc between a segment's endpoints.
    for (const [x, y] of [
      [3, 1],
      [1, 4],
      [-2, 5],
      [-7, -3],
    ] as const) {
      const opposite = binsTowards(-x, -y).map((bin) => (bin + DEFAULT_ATLAS_SIZE / 2) % DEFAULT_ATLAS_SIZE);
      expect(opposite).toEqual(binsTowards(x, y));
    }
  });
});

describe('buildShadowPolarMap at another shadow_atlas/size', () => {
  const RADIUS = 1000;

  it.each([128, 512, 4096])('holds `size` bins, one per column of the four size / 4 frusta (%i)', (bins) => {
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(100, -100, 100, 100)], bins);
    expect(map).toHaveLength(bins);
    // The endpoints sit on the quadrant diagonals, so the +X frustum is columns 0 to size / 4 - 1.
    expect(map[0]).toBeLessThan(SHADOW_MAP_FAR);
    expect(map[bins / 4 - 1]).toBeLessThan(SHADOW_MAP_FAR);
    expect(map[bins / 4]).toBe(SHADOW_MAP_FAR);
    expect(map[bins - 1]).toBe(SHADOW_MAP_FAR);
  });

  it('stores the same axis distance at the quadrant centre whatever the size', () => {
    // `tex_ofs` is 0.125 at the +X axis, so the centre column is size / 8.
    for (const bins of [256, 1024]) {
      const map = buildMap(lightAt(0, 0, RADIUS), [segment(100, -50, 100, 50)], bins);
      expect(map[bins / 8]).toBeCloseTo(100 / (RADIUS * 1.1), 6);
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
    const map = buildMap(lightAt(0, 0, RADIUS), []);
    expect(map).toHaveLength(DEFAULT_ATLAS_SIZE);
    expect([...map].every((v) => v === SHADOW_MAP_FAR)).toBe(true);
  });

  it('stores the AXIS distance, not the Euclidean one', () => {
    // A vertical segment at x = 100 spanning y in [-50, 50] (previewer space).
    // Every ray that reaches it crosses x = 100, so every covered bin holds
    // 100 / zfar however far along the segment the hit lands. A Euclidean map
    // would hold up to hypot(100, 50) / zfar at the ends.
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(100, -50, 100, 50)]);
    const centre = binOf(plusXCoord(100, 0));
    const nearEnd = binOf(plusXCoord(100, 49));
    expect(map[centre]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[nearEnd]).toBeCloseTo(100 / ZFAR, 6);
  });

  it('covers exactly the bins between the endpoints, and no others', () => {
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(100, -50, 100, 50)]);
    // Endpoint coords under the box mapping: pos_box.y = -y/x in Godot space.
    const lo = binOf(plusXCoord(100, 50));
    const hi = binOf(plusXCoord(100, -50));
    expect(lo).toBeLessThan(hi);
    for (let bin = 0; bin < DEFAULT_ATLAS_SIZE; bin += 1) {
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
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(100, -100, 100, 100)]);
    expect(map[0]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[DEFAULT_ATLAS_SIZE / 4 - 1]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[DEFAULT_ATLAS_SIZE / 4]).toBe(SHADOW_MAP_FAR);
    expect(map[DEFAULT_ATLAS_SIZE - 1]).toBe(SHADOW_MAP_FAR);
  });

  it('fills floor(size / 4) columns per frustum and leaves the rest of an uneven size unwritten', () => {
    // Godot reads the project value raw (`renderer_canvas_render_rd.cpp:2060`) and gives each
    // frustum `size / 4` columns, integer division (`:1095`): 130 is 32 columns, so 128 and 129 are
    // never drawn. A segment across all four quadrants shows them still at the clear value.
    const ring = [
      segment(-300, -300, 300, -300),
      segment(300, -300, 300, 300),
      segment(300, 300, -300, 300),
      segment(-300, 300, -300, -300),
    ].flat();
    const map = buildMap(lightAt(0, 0, RADIUS), ring, 130);
    expect(map).toHaveLength(130);
    expect(map[127]).toBeLessThan(SHADOW_MAP_FAR);
    expect([map[128], map[129]]).toEqual([SHADOW_MAP_FAR, SHADOW_MAP_FAR]);
  });

  it('spans three quadrants, and the wrap, for a wide segment', () => {
    // A horizontal segment 100 above the light in previewer space, reaching 150
    // either side. Its endpoints sit at u = 0.708 and u = 0.042, so the covered
    // arc runs through the -X quadrant, the whole of -Y, and across the seam
    // into +X, which holds only if the walk takes the short way.
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(-150, 100, 150, 100)]);
    // Straight up: Godot -Y, the quadrant centre at u = 0.875, axis distance 100.
    expect(map[binOf(0.875)]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[binOf(0.72)]).toBeLessThan(SHADOW_MAP_FAR);
    // A +X-quadrant bin stores the distance along +X, not the perpendicular
    // 100. Inverting `tex_ofs = pos_box.y * 0.125 + 0.125` by hand at bin 40's
    // centre gives the ray (1, 8u - 1), which meets Godot y = -100 at
    // x = 100 / (1 - 8u).
    const u = 40.5 / DEFAULT_ATLAS_SIZE;
    expect(binOf(0.02)).toBe(40);
    expect(map[40]).toBeCloseTo(100 / (1 - 8 * u) / ZFAR, 6);
    // Off the ends of the arc: beyond the left endpoint, and straight down.
    expect(map[binOf(0.65)]).toBe(SHADOW_MAP_FAR);
    expect(map[binOf(0.375)]).toBe(SHADOW_MAP_FAR);
  });

  it('leaves the opposite quadrant clear for a segment behind the light', () => {
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(-100, -50, -100, 50)]);
    expect(map[binOf(0.625)]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[binOf(plusXCoord(100, 0))]).toBe(SHADOW_MAP_FAR);
  });

  it('fills every bin when the light sits inside a closed polygon', () => {
    // A square wound as a closed occluder, the wrap edge already appended, as
    // `godotPolylineToSegments` hands it over.
    const square: ShadowCasterEdges = worldEdges(
      [-80, -80, 80, -80, 80, -80, 80, 80, 80, 80, -80, 80, -80, 80, -80, -80],
      OccluderPolygon2DCullMode.DISABLED
    );
    const map = buildMap(lightAt(0, 0, RADIUS), [square]);
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
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(100, -50, 100, -150)]);

    // Quadrant 0's last texel: ray (1, 8u − 1), axis +X, so it stores x = 100.
    expect(map[511]).toBeCloseTo(100 / ZFAR, 6);
    // Quadrant 1's first: ray (3 − 8u, 1), axis +Y, so it stores y where the ray
    // meets x = 100: a different number for a neighbouring texel, by design.
    expect(map[512]).toBeCloseTo(100 / (3 - 8 * (512.5 / DEFAULT_ATLAS_SIZE)) / ZFAR, 6);
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
    const small = buildMap(lightAt(0, 0, 500), [segment(100, -50, 100, 50)]);
    const large = buildMap(lightAt(0, 0, 2000), [segment(100, -50, 100, 50)]);
    expect(small[binOf(0.125)]).toBeCloseTo(100 / (500 * 1.1), 6);
    expect(large[binOf(0.125)]).toBeCloseTo(100 / (2000 * 1.1), 6);
  });

  it('keeps the nearest of two occluders in the same direction', () => {
    const map = buildMap(lightAt(0, 0, RADIUS), [segment(200, -50, 200, 50), segment(100, -50, 100, 50)]);
    expect(map[binOf(0.125)]).toBeCloseTo(100 / ZFAR, 6);
  });

  it('drops an occluder whose bounds miss the light rect', () => {
    // Godot culls occluders against `rect_cache` before the shadow map is drawn
    // at all, so an occluder inside the far plane but outside the cookie's own
    // extent casts nothing.
    const rect: LightRect = { minX: -200, minY: -200, maxX: 200, maxY: 200 };
    const outside = buildMap({ worldToLocal: [1, 0, 0, 0, 1, 0], radius: RADIUS, rect }, [
      segment(400, -50, 400, 50),
    ]);
    expect(outside[binOf(0.125)]).toBe(SHADOW_MAP_FAR);

    // The same occluder inside the rect still casts, so the rejection above is
    // the rect and not the geometry.
    const inside = buildMap({ worldToLocal: [1, 0, 0, 0, 1, 0], radius: RADIUS, rect }, [
      segment(100, -50, 100, 50),
    ]);
    expect(inside[binOf(0.125)]).toBeCloseTo(100 / ZFAR, 6);
  });

  it('drops an occluder clipped away by the near or the far plane', () => {
    // near = radius / 1000 = 1, far = radius * 1.1 = 1100.
    const tooClose = buildMap(lightAt(0, 0, RADIUS), [segment(0.5, -50, 0.5, 50)]);
    expect(tooClose[binOf(0.125)]).toBe(SHADOW_MAP_FAR);
    const tooFar = buildMap(lightAt(0, 0, RADIUS), [segment(2000, -50, 2000, 50)]);
    expect(tooFar[binOf(0.125)]).toBe(SHADOW_MAP_FAR);
  });

  it('honours cull_mode by the edge winding relative to the light', () => {
    // Same edge, both windings, under both culling modes, as `edgeCastsShadow` answers it.
    const forward = segment(100, -50, 100, 50, OccluderPolygon2DCullMode.CLOCKWISE);
    const reversed = segment(100, 50, 100, -50, OccluderPolygon2DCullMode.CLOCKWISE);
    const bin = binOf(0.125);
    const a = buildMap(lightAt(0, 0, RADIUS), [forward])[bin]!;
    const b = buildMap(lightAt(0, 0, RADIUS), [reversed])[bin]!;
    expect([a === SHADOW_MAP_FAR, b === SHADOW_MAP_FAR]).toEqual([false, true]);

    const ccw = buildMap(lightAt(0, 0, RADIUS), [
      segment(100, -50, 100, 50, OccluderPolygon2DCullMode.COUNTER_CLOCKWISE),
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
      c,
      s,
      -(c * 400 + s * 300),
      -s,
      c,
      -(-s * 400 + c * 300),
    ];
    const map = buildMap({ worldToLocal, radius: RADIUS, rect: UNBOUNDED }, [segment(350, 400, 450, 400)]);
    expect(map[binOf(0.125)]).toBeCloseTo(100 / ZFAR, 6);
    expect(map[binOf(0.625)]).toBe(SHADOW_MAP_FAR);
  });

  it('ignores a degenerate edge and a caster with no segments', () => {
    const degenerate = buildMap(lightAt(0, 0, RADIUS), [
      segment(100, 0, 100, 0),
      worldEdges([], OccluderPolygon2DCullMode.DISABLED),
      // Collinear with the light: no area, and `edgeCastsShadow` rejects it.
      segment(100, 0, 200, 0),
    ]);
    expect([...degenerate].every((v) => v === SHADOW_MAP_FAR)).toBe(true);
  });
});

/**
 * Whether NONE's single tap shadows the +X-quadrant fragment `(dx, dyUp)` from the light: it reads
 * the one bin `tex_ofs` floors to and steps against it (`canvas.glsl:507-510`). z_far divides both
 * sides, so the test is the axis distance against the bin's.
 */
function noneTapShadows(map: Float32Array, dx: number, dyUp: number): boolean {
  const depth = map[Math.floor(plusXCoord(dx, dyUp) * DEFAULT_ATLAS_SIZE)]!;
  return depth <= dx / (1000 * 1.1);
}

/** Flat `[ax,ay, bx,by, …]` for a closed ring of points. */
function ring(points: readonly (readonly [number, number])[]): number[] {
  return points.flatMap((a, i) => {
    const b = points[(i + 1) % points.length]!;
    return [a[0], a[1], b[0], b[1]];
  });
}

/**
 * Pinned against Godot 4.6.3: an 80×80 square at Godot (576,324) wound (-40,-40) (40,-40) (40,40)
 * (-40,40), once per `cull_mode`, through `pnpm ref:godot … --probe 560,324 --probe 576,324
 * --probe 610,324 --probe 700,324`. Godot reads 63 (shadowed) at the three interior probes under
 * cull_mode 0 and 1, and 111 / 106 / 97 (lit) under cull_mode 2.
 */
describe('cull_mode against measured Godot', () => {
  const SQUARE = [
    [136, 40],
    [216, 40],
    [216, -40],
    [136, -40],
  ] as const;
  const INSIDE = [160, 176, 210];

  function mapUnder(cullMode: OccluderCullMode, points: readonly (readonly [number, number])[] = SQUARE) {
    return buildMap(lightAt(0, 0, 1000), [worldEdges(ring(points), cullMode)]);
  }

  it('shadows the square interior under CULL_DISABLED and CULL_CLOCKWISE for this winding', () => {
    for (const mode of [OccluderPolygon2DCullMode.DISABLED, OccluderPolygon2DCullMode.CLOCKWISE] as const) {
      for (const dx of INSIDE)
        expect(noneTapShadows(mapUnder(mode), dx, 0), `mode ${mode} at ${dx}`).toBe(true);
    }
  });

  it('leaves the square interior lit under CULL_COUNTER_CLOCKWISE for this winding', () => {
    const map = mapUnder(OccluderPolygon2DCullMode.COUNTER_CLOCKWISE);
    for (const dx of INSIDE) expect(noneTapShadows(map, dx, 0)).toBe(false);
  });

  it('shadows behind the square in every cull mode', () => {
    // Godot (700,324) reads 63 in all three modes.
    for (const mode of [
      OccluderPolygon2DCullMode.DISABLED,
      OccluderPolygon2DCullMode.CLOCKWISE,
      OccluderPolygon2DCullMode.COUNTER_CLOCKWISE,
    ] as const) {
      expect(noneTapShadows(mapUnder(mode), 300, 0)).toBe(true);
    }
  });

  it('reverses which interior a winding mode shadows when the polygon is reversed', () => {
    const map = mapUnder(OccluderPolygon2DCullMode.CLOCKWISE, [...SQUARE].reverse());
    for (const dx of INSIDE) expect(noneTapShadows(map, dx, 0)).toBe(false);
  });
});

/**
 * Pinned against Godot 4.6.3 on lavapipe: `unit-pointlight2d-shadow-atlas-size.tscn` with its
 * project's `2d/shadow_atlas/size` set to 1000. Its occluder end (70, 100) lands at window x 37.5
 * of the +Y frustum's 250 columns, the centre of column 37. Godot's ramp at y = 520 starts one bin later than a covered column 37 puts it.
 */
describe('a column centre exactly on an occluder end', () => {
  const BINS = 1000;
  const COLUMN_37 = 250 + 37;

  it('leaves the column clear when the occluder lies before the end', () => {
    const map = buildMap(lightAt(0, 0, 1000), [segment(100, -50, 70, -100)], BINS);
    expect(map[COLUMN_37 - 1]).toBeLessThan(SHADOW_MAP_FAR);
    expect(map[COLUMN_37]).toBe(SHADOW_MAP_FAR);
  });

  it('covers the column when the occluder lies after the end', () => {
    const map = buildMap(lightAt(0, 0, 1000), [segment(70, -100, -50, -100)], BINS);
    expect(map[COLUMN_37 - 1]).toBe(SHADOW_MAP_FAR);
    expect(map[COLUMN_37]).toBeLessThan(SHADOW_MAP_FAR);
  });

  it('gives a bin the snap adds past an end that end depth, not the line extended', () => {
    // Window x in the +X frustum at 2048 bins is 256 + 256 · (Godot y / x). The near end sits
    // 0.001 px right of column 76's centre, so the snap covers 76 from outside the segment.
    const godotY = (windowX: number, x: number) => ((windowX - 256) / 256) * x;
    const map = buildMap(lightAt(0, 0, 1000), [segment(100, -godotY(76.501, 100), 300, -godotY(76.6, 300))]);
    expect(map[76]).toBeCloseTo(100 / 1100, 6);
  });
});

/**
 * Pinned against Godot 4.6.3 (`scripts/godot-ref/reference/unit-lightoccluder2d-shadow.png`): a
 * light at Godot (400,324) and an open occluder from (576,224) to (576,424), probed with
 * `pnpm ref:godot scenes/fixtures/unit-lightoccluder2d-shadow.tscn --probe 620,198 --probe 620,199
 * --probe 620,448 --probe 620,449`. Godot reads 97 lit, 63 shadowed, 63 shadowed and 96 lit.
 */
describe('the NONE boundary against measured Godot', () => {
  const map = buildMap(lightAt(0, 0, 1000), [segment(176, 100, 176, -100)]);

  it('puts Godot pixel (620,198) outside the shadow and (620,199) inside', () => {
    expect(noneTapShadows(map, 220.5, 125.5)).toBe(false);
    expect(noneTapShadows(map, 220.5, 124.5)).toBe(true);
  });

  it('mirrors the same step on the other boundary', () => {
    expect(noneTapShadows(map, 220.5, -124.5)).toBe(true);
    expect(noneTapShadows(map, 220.5, -125.5)).toBe(false);
  });
});
