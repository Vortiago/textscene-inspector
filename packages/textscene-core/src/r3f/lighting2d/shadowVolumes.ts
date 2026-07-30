/**
 * CPU-extruded 2D shadow volumes — the geometry half of Godot's `Light2D`
 * shadow pass, as plain vector math with no GL and no THREE.
 *
 * Godot builds a per-light polar depth map and samples it in `canvas.glsl`.
 * Under `shadow_filter = SHADOW_FILTER_NONE` that sampling is ONE `step()`, so
 * the result is a HARD in/out test — exactly what a stencil mask reproduces.
 * This module emits the mask geometry: for every occluder edge, the convex
 * region of points whose sightline to the light crosses that edge, extruded
 * past the light's reach.
 *
 * THIS IS THE UNFILTERED BRANCH ONLY, and unfiltered is only the property's
 * DEFAULT. PCF5/PCF13 average five or thirteen taps into a fraction, which a
 * stencil cannot carry, so a filtered light takes the other mechanism instead —
 * `shadowPolarMap.ts` plus the sampling variant in `lightQuad.ts` (ADR-0030).
 * The two are never both active on one light: `PointLight2D`'s gate picks one.
 *
 * What this module keeps is the case it is EXACT for, and it is exact rather
 * than approximate — under NONE the boundary is a one-pixel step, and analytic
 * volumes place it more precisely than the polar map's 2048 bins (0.18° each)
 * would. That precision is why the gate exists rather than one unified
 * mechanism: the `unit-lightoccluder2d-*` baselines measure ~1/255 mean here.
 *
 * SPACE. Everything here is the previewer's 2D world space: Godot pixels with
 * Y negated (three.js +Y up), which is what `polygonToSegments` already
 * produces. `edgeCastsShadow`'s winding test is stated for THAT space; the
 * signs are the negation of Godot's own Y-down convention.
 *
 * MEASURED, not derived (Godot 4.6.3, `pnpm ref:godot --probe`):
 *  - with the filter off, the lit/shadowed transition is one pixel wide and
 *    lands on the light→endpoint ray to within ~1 px (Godot's shadow map
 *    quantises the boundary by angle, so its wedge is a fraction of a pixel
 *    narrower). That boundary is the umbra edge under a filter too — PCF just
 *    ramps across it — so it is the right thing for this module to emit;
 *  - a fully shadowed pixel reads back the unlit surface colour exactly,
 *    because `Light2D.shadow_color` defaults to `Color(0, 0, 0, 0)`;
 *  - `cull_mode` selects edges by winding relative to the light, so a closed
 *    convex polygon under CULL_COUNTER_CLOCKWISE shadows only from its FAR
 *    edges and its own interior stays lit.
 */

/** `OccluderPolygon2D.CullMode`. */
export const OCCLUDER_CULL_DISABLED = 0;
export const OCCLUDER_CULL_CLOCKWISE = 1;
export const OCCLUDER_CULL_COUNTER_CLOCKWISE = 2;

export type OccluderCullMode =
  | typeof OCCLUDER_CULL_DISABLED
  | typeof OCCLUDER_CULL_CLOCKWISE
  | typeof OCCLUDER_CULL_COUNTER_CLOCKWISE;

/** An axis-aligned world rect, the shape Godot culls occluders against. */
export interface LightRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ShadowLight {
  /** Shadow origin — the light node's world position. Rays radiate from here. */
  x: number;
  y: number;
  /**
   * The world rect the light can illuminate (its cookie quad's bounds, which
   * `offset` shifts off the origin). Occluders outside it are culled, and
   * volumes are extruded past its far corner.
   */
  rect: LightRect;
}

export interface ShadowCasterEdges {
  /**
   * Flat world-space `[ax,ay, bx,by, …]` — FOUR numbers per edge, one pair per
   * endpoint. A closed polygon has already had its wrap-around edge appended.
   */
  segments: ArrayLike<number>;
  cullMode: OccluderCullMode;
}

/**
 * How far past the light's reach a volume's far cap is pushed.
 *
 * The cap is two chords across the wedge (see `edgeShadowRing`), so its closest
 * approach to the light is `far · cos(θ/4)` for a wedge of angle θ. θ is capped
 * at π — an edge can only subtend more by containing the light, which is the
 * degenerate case `edgeCastsShadow` already rejects — so `cos(θ/4) ≥ cos(45°)`
 * and a factor of √2 is the exact requirement. 1.5 keeps a margin over it
 * without pushing coordinates far enough to lose float precision.
 */
const CAP_MARGIN = 1.5;

/** Vertices emitted per casting edge: a 5-gon fanned into 3 triangles. */
const VERTICES_PER_EDGE = 9;

/**
 * Twice the signed area of triangle (light, a, b). Zero means the light is
 * collinear with the edge, whichever side of it the light lies on.
 */
function orientation(ax: number, ay: number, bx: number, by: number, lx: number, ly: number): number {
  return (ax - lx) * (by - ly) - (ay - ly) * (bx - lx);
}

/**
 * Does edge a→b cast a shadow from a light at (lx, ly) under `cullMode`?
 *
 * CULL_DISABLED takes every edge; the two winding modes take the half that
 * faces the light under one polygon winding and the half that faces away under
 * the reverse. A collinear edge (orientation 0) casts nothing in any mode — its
 * shadow has no area, and that single test also covers a light sitting exactly
 * on the edge's line, in front of it or between its endpoints.
 */
export function edgeCastsShadow(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  lx: number,
  ly: number,
  cullMode: OccluderCullMode
): boolean {
  const orient = orientation(ax, ay, bx, by, lx, ly);
  if (!Number.isFinite(orient) || orient === 0) return false;
  if (cullMode === OCCLUDER_CULL_CLOCKWISE) return orient > 0;
  if (cullMode === OCCLUDER_CULL_COUNTER_CLOCKWISE) return orient < 0;
  return true;
}

/**
 * The convex ring of one edge's shadow volume, as flat `[x,y, …]`:
 * `[a, b, bFar, mFar, aFar]`.
 *
 * `a`/`b` are the edge itself (the near boundary — points between the light and
 * the edge stay lit). `aFar`/`bFar` sit on the two boundary rays past the
 * light's reach, and `mFar` caps the gap between them along the angular
 * bisector so the cap cannot cut back inside the lit area for a wide wedge.
 *
 * Returns null when the volume has no area: a zero-length edge, an endpoint
 * exactly on the light, or an edge collinear with it.
 */
export function edgeShadowRing(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  light: ShadowLight,
  reach: number
): Float32Array | null {
  const { x: lx, y: ly } = light;
  const dax = ax - lx;
  const day = ay - ly;
  const dbx = bx - lx;
  const dby = by - ly;

  const da = Math.hypot(dax, day);
  const db = Math.hypot(dbx, dby);
  if (!(da > 0) || !(db > 0)) return null;

  const uax = dax / da;
  const uay = day / da;
  const ubx = dbx / db;
  const uby = dby / db;

  // Parallel rays mean a wedge of zero angle: a zero-length edge, an edge
  // pointing straight away from the light, or (antiparallel) the light sitting
  // between the endpoints. None of them shadow any area.
  if (uax * uby - uay * ubx === 0) return null;

  let mx = uax + ubx;
  let my = uay + uby;
  const ml = Math.hypot(mx, my);
  if (!(ml > 0)) return null;
  mx /= ml;
  my /= ml;

  // Past the light's reach AND past both endpoints, so the cap never lands
  // between the light and the edge for an occluder outside the lit rect.
  const far = CAP_MARGIN * Math.max(reach, da, db);
  if (!Number.isFinite(far)) return null;

  return new Float32Array([
    ax, ay,
    bx, by,
    lx + ubx * far, ly + uby * far,
    lx + mx * far, ly + my * far,
    lx + uax * far, ly + uay * far,
  ]);
}

/** Longest distance from the shadow origin to a corner of the light's rect. */
export function lightReach(light: ShadowLight): number {
  const { rect } = light;
  const dx = Math.max(Math.abs(rect.minX - light.x), Math.abs(rect.maxX - light.x));
  const dy = Math.max(Math.abs(rect.minY - light.y), Math.abs(rect.maxY - light.y));
  return Math.hypot(dx, dy);
}

/**
 * Godot's occluder cull: keep an occluder only while its bounds overlap the
 * light's rect (`RendererCanvasRenderRD::light_update_shadow`). Ours bounds the
 * already-transformed points, so it is at least as tight as Godot's transformed
 * -AABB test — never looser, so it can only agree.
 */
export function casterInLightRect(segments: ArrayLike<number>, rect: LightRect): boolean {
  if (segments.length < 4) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < segments.length; i += 2) {
    const x = segments[i]!;
    const y = segments[i + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return false;
  return minX <= rect.maxX && maxX >= rect.minX && minY <= rect.maxY && maxY >= rect.minY;
}

/**
 * Every casting edge's volume, triangulated into one non-indexed `[x,y,z, …]`
 * buffer (z is 0 — the 2D canvas plane; position the mesh, not the vertices).
 *
 * Fed to a stencil pre-pass with colour writes off and face culling OFF: the
 * rings are emitted in whichever winding the polygon gave, and overlapping
 * volumes are idempotent under a `REPLACE` stencil op, so neither winding nor
 * overlap needs resolving.
 *
 * Returns null when nothing casts, which is the common case and lets the caller
 * skip the stencil clear entirely.
 */
export function buildShadowVolumes(
  light: ShadowLight,
  casters: readonly ShadowCasterEdges[]
): Float32Array | null {
  const reach = lightReach(light);
  const rings: Float32Array[] = [];

  for (const caster of casters) {
    const { segments, cullMode } = caster;
    if (!casterInLightRect(segments, light.rect)) continue;
    for (let i = 0; i + 3 < segments.length; i += 4) {
      const ax = segments[i]!;
      const ay = segments[i + 1]!;
      const bx = segments[i + 2]!;
      const by = segments[i + 3]!;
      if (!edgeCastsShadow(ax, ay, bx, by, light.x, light.y, cullMode)) continue;
      const ring = edgeShadowRing(ax, ay, bx, by, light, reach);
      if (ring) rings.push(ring);
    }
  }

  if (rings.length === 0) return null;

  const out = new Float32Array(rings.length * VERTICES_PER_EDGE * 3);
  let o = 0;
  for (const ring of rings) {
    // Fan the convex 5-gon from vertex 0: (0,1,2) (0,2,3) (0,3,4).
    for (let t = 1; t + 1 < 5; t++) {
      for (const v of [0, t, t + 1]) {
        out[o] = ring[v * 2]!;
        out[o + 1] = ring[v * 2 + 1]!;
        out[o + 2] = 0;
        o += 3;
      }
    }
  }
  return out;
}
