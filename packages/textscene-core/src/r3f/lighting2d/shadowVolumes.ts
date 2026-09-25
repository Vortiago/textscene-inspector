/**
 * CPU-extruded 2D shadow volumes: the stencil geometry for a `Light2D` under
 * `shadow_filter = NONE`, whose one `step()` in `canvas.glsl` is a hard test. A filtered
 * light samples `shadowPolarMap.ts` instead (ADR-0030), and `PointLight2D`'s
 * gate picks one. Everything is in the previewer's 2D world space, Y up.
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
  /** Shadow origin: the light node's world position. Rays radiate from here. */
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
   * Flat world-space `[ax,ay, bx,by, …]`: four numbers per edge, one pair per
   * endpoint. A closed polygon has already had its wrap-around edge appended.
   */
  segments: ArrayLike<number>;
  cullMode: OccluderCullMode;
}

/**
 * How far past the light's reach a volume's far cap is pushed. The two-chord cap
 * comes within `far · cos(θ/4)` of the light, and θ ≤ π for a casting edge, so
 * √2 is the exact requirement. 1.5 keeps a margin without losing float precision.
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
 * Does edge a→b cast a shadow from a light at (lx, ly) under `cullMode`? The
 * winding modes take the edges facing toward or away from the light, with signs
 * that negate Godot's Y-down convention. Measured: a closed convex polygon under
 * CULL_COUNTER_CLOCKWISE shadows only from its far edges.
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
  // A collinear edge has no shadow area, and this also covers a light on the
  // edge's line, in front of it or between its endpoints.
  if (!Number.isFinite(orient) || orient === 0) return false;
  if (cullMode === OCCLUDER_CULL_CLOCKWISE) return orient > 0;
  if (cullMode === OCCLUDER_CULL_COUNTER_CLOCKWISE) return orient < 0;
  return true;
}

/**
 * The convex ring `[a, b, bFar, mFar, aFar]` of one edge's shadow volume, or null
 * when it has no area. The edge is the near boundary. `mFar` caps the far ends
 * along the bisector, so a wide wedge's cap cannot cut back into the lit area.
 * Measured: Godot's unfiltered boundary lands on the light→endpoint ray within ~1 px.
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

  // Past the light's reach and past both endpoints, so the cap never lands
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
 * light's rect (`RendererCanvasRenderRD::light_update_shadow`). Bounding the
 * transformed points is never looser than Godot's transformed-AABB test.
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
 * Every casting edge's volume as one non-indexed `[x,y,z, …]` buffer, z 0, or
 * null when nothing casts. Drawn with face culling off under a `REPLACE` stencil,
 * so winding and overlap need no resolving. Under NONE this beats the polar
 * map's 0.18° bins at the one-pixel step: the goldens measure ~1/255 mean.
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
