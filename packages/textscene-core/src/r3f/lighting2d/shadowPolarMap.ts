/**
 * Godot's per-light 2D shadow map — a 1D POLAR depth buffer — built on the CPU.
 *
 * This is the half of `Light2D`'s shadow that a stencil cannot express. Under
 * `shadow_filter = NONE` the sampler takes ONE tap and the result is a hard
 * in/out test, which `shadowVolumes.ts` reproduces exactly with geometry. Under
 * PCF5/PCF13 the sampler takes five or thirteen taps offset along the map's
 * ANGULAR axis and averages them into a FRACTION — a penumbra a binary mask has
 * no way to represent. So a filtered light samples this map instead
 * (`lightQuad.ts`), and an unfiltered one keeps the stencil.
 *
 * WHAT A BIN HOLDS. `drivers/gles3/rasterizer_canvas_gles3.cpp:1639`
 * (`light_update_shadow`) renders the light's occluders four times through 90°
 * frusta into one atlas row of `rendering/2d/shadow_atlas/size` texels (project
 * default 2048), and `drivers/gles3/shaders/canvas_occlusion.glsl:28,56` writes
 *
 *   depth = dot(direction, vtx.xy);   out_depth = depth / z_far;
 *
 * with `direction` the quadrant's AXIS. So a bin holds the axis distance to the
 * nearest occluder in that direction, normalised by `z_far`, NOT the Euclidean
 * distance — and the item side compares against the same axis component
 * (`canvas.glsl:830-845`), so the two agree and `z_far` cancels out of the test.
 * `GL_LESS` over the four passes resolves overlapping occluders, which is a
 * `min`.
 *
 * WHICH BIN. `canvas.glsl:821-843` addresses the atlas by a BOX mapping, not by
 * angle: the direction is divided by its larger component, and the smaller one
 * indexes within the quadrant. Quadrant 0's viewport is
 * `glViewport(0, …, size / 4, 2)` and its projection maps `(x, y, 0) → (y, 0, -x)`,
 * so a rasterised column sits at `(y/x) * (size/8) + (size/8)` — the very texel
 * `tex_ofs * size` addresses. The two halves therefore share ONE indexing rule,
 * which is why this builder can write bins directly with nothing derived.
 *
 * The consequence that decides the whole design: because the in-quadrant
 * coordinate is a TANGENT, a tap offset of `Δu` moves the sample by
 * `8 · Δu · axisDistance` in world units — the penumbra is exactly LINEAR in the
 * box axis distance (the sec² of a uniform-angle map cancels). MEASURED against
 * Godot 4.6.3 on a PCF5 light at `shadow_filter_smooth = 8`: the five step
 * boundaries land at 304.6 / 314.3 / 324 / 333.7 / 343.4 px at axis distance 276
 * and at 283.5 / 303.75 / 324 / 344.25 / 364.5 px at axis distance 576 — a ramp
 * 2.087× wider for a 2.087× greater distance, matching to within a probe step.
 *
 * SPACE. Callers work in the previewer's 2D world space (Godot pixels with Y
 * negated for three.js). `worldToLocal` un-applies the light node's own
 * transform, still Y-up; the mapping negates Y itself, because Godot states the
 * quadrant rule in its own Y-DOWN convention and a half-ported sign would put
 * the penumbra on the wrong side of a rotated light.
 *
 * WHY CPU. The map is a pure function of settled inputs (light pose, occluder
 * edges, reach), so it is built once per change and the goldens see one exact
 * texture. Rasterising it on the GPU would ride the driver's line/triangle
 * fill-rule variance, which is precisely what a byte-compared baseline cannot
 * absorb.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { edgeCastsShadow, type ShadowCasterEdges } from './shadowVolumes';

/**
 * Texels in one light's map. Godot's atlas row is
 * `rendering/2d/shadow_atlas/size` wide (project default 2048) and holds four
 * 90° quadrants, so this is both the atlas width and the bins per full turn.
 */
export const SHADOW_MAP_BINS = 2048;

/**
 * What a bin holds where nothing occludes. Godot clears the row to `p_far` and
 * normalises stored depths by the same `z_far`, so "nothing here" is 1.0 on the
 * normalised scale a fragment's own `dist` is measured on — and a fragment
 * inside the light's rect can never reach it (its axis distance is at most half
 * the rect's diagonal, against a far plane of 1.1 diagonals).
 */
export const SHADOW_MAP_FAR = 1;

/** `radius_cache / 1000` — `renderer_viewport.cpp:556`'s near plane. */
const NEAR_SCALE = 1 / 1000;

/** `radius_cache * 1.1` — the same line's far plane, and the `z_far` divisor. */
const FAR_SCALE = 1.1;

/** cos/sin of 45°, `canvas.glsl:824`'s quadrant-select rotation. */
const SQRT1_2 = 0.7071067811865476;

export interface ShadowPolarLight {
  /**
   * Previewer world → light-local, as a row-major 2×3 affine
   * `[m00, m01, m02, m10, m11, m12]`. Godot's `xform_cache.affine_inverse()`
   * (`renderer_viewport.cpp:556`), so the light's rotation and scale reach the
   * map and `offset` — which moves the cookie, not the node — does not.
   */
  readonly worldToLocal: ArrayLike<number>;
  /**
   * Godot's `radius_cache`: `local_rect.size.length()`
   * (`renderer_viewport.cpp:485`) — the FULL diagonal of the cookie's rect in
   * light-local units, which is `hypot(width, height)` of the quad's geometry.
   * Not the reach `shadowVolumes.ts` extrudes to; it only sets the near/far
   * clips and the normalisation both sides divide by.
   */
  readonly radius: number;
}

/**
 * `canvas.glsl:821-843`'s `tex_ofs` for a direction given in previewer
 * light-local coordinates (Y up). Runs 0 → 1 once around the circle, wrapping at
 * the previewer direction (1, 1); returns 0 for a zero-length direction.
 *
 * Exported because it is the ONE place the mapping lives: the bin walk below and
 * the fragment shader's quadrant block are the same formula read in the two
 * directions, and a test that computes an expected bin must use this and not a
 * second copy of it.
 */
export function shadowMapCoord(x: number, yUp: number): number {
  const y = 0 - yUp;
  const length = Math.hypot(x, y);
  if (!(length > 0)) return 0;

  const normX = x / length;
  const normY = y / length;
  const box = Math.max(Math.abs(normX), Math.abs(normY));
  const boxX = normX / box;
  const boxY = normY / box;

  const rotX = (normX - normY) * SQRT1_2;
  const rotY = (normX + normY) * SQRT1_2;

  if (rotY > 0) {
    if (rotX > 0) return boxY * 0.125 + 0.125;
    return boxX * -0.125 + 0.375;
  }
  if (rotX < 0) return boxY * -0.125 + 0.625;
  return boxX * 0.125 + 0.875;
}

/**
 * Bin `index`'s ray in Godot light-local space, scaled so the quadrant's axis
 * component is exactly 1 — which makes the ray parameter itself the axis
 * distance the bin stores, with no second projection.
 *
 * The inverse of `shadowMapCoord`, quadrant by quadrant, sampled at the texel
 * CENTRE because that is where Godot's rasteriser decides coverage.
 */
function binRay(index: number, out: { x: number; y: number }): void {
  const u = (index + 0.5) / SHADOW_MAP_BINS;
  const quadrant = index >> 9;
  if (quadrant === 0) {
    out.x = 1;
    out.y = 8 * u - 1;
  } else if (quadrant === 1) {
    out.x = 3 - 8 * u;
    out.y = 1;
  } else if (quadrant === 2) {
    out.x = -1;
    out.y = 5 - 8 * u;
  } else {
    out.x = 8 * u - 7;
    out.y = -1;
  }
}

/**
 * The map for one light: `SHADOW_MAP_BINS` normalised axis distances, filled
 * with `SHADOW_MAP_FAR` where nothing casts.
 *
 * `casters` are the light's occluders in previewer WORLD space, already narrowed
 * by `shadow_item_cull_mask` — the same value `buildShadowVolumes` consumes, so
 * the two mechanisms can never disagree about which occluders exist.
 */
export function buildShadowPolarMap(
  light: ShadowPolarLight,
  casters: readonly ShadowCasterEdges[]
): Float32Array {
  const map = new Float32Array(SHADOW_MAP_BINS).fill(SHADOW_MAP_FAR);

  const near = light.radius * NEAR_SCALE;
  const far = light.radius * FAR_SCALE;
  if (!(far > near)) return map;
  const zFarInv = 1 / far;

  const m = light.worldToLocal;
  const m00 = m[0]!;
  const m01 = m[1]!;
  const m02 = m[2]!;
  const m10 = m[3]!;
  const m11 = m[4]!;
  const m12 = m[5]!;

  const ray = { x: 0, y: 0 };

  for (const { segments, cullMode } of casters) {
    for (let i = 0; i + 3 < segments.length; i += 4) {
      const wax = segments[i]!;
      const way = segments[i + 1]!;
      const wbx = segments[i + 2]!;
      const wby = segments[i + 3]!;

      // Light-local, still Y-up: the cull test's winding convention is stated
      // for that space, and doing it here rather than in world space is what
      // lets a mirrored light flip which edges cast, as Godot's own
      // `glCullFace` on the light-local modelview does.
      const lax = m00 * wax + m01 * way + m02;
      const lay = m10 * wax + m11 * way + m12;
      const lbx = m00 * wbx + m01 * wby + m02;
      const lby = m10 * wbx + m11 * wby + m12;
      if (!edgeCastsShadow(lax, lay, lbx, lby, 0, 0, cullMode)) continue;

      // Godot's Y-down local space, where the quadrant rule is stated.
      const ax = lax;
      const ay = 0 - lay;
      const ex = lbx - lax;
      const ey = lay - lby;

      // The arc between the endpoints, taken the SHORT way round. A straight
      // edge subtends less than half a turn unless it is collinear with the
      // light, which `edgeCastsShadow` has already rejected — and the box
      // mapping satisfies `u(θ + π) = u(θ) + 0.5`, so "less than half a turn"
      // and "less than 0.5 of u" are the same statement.
      const uA = shadowMapCoord(lax, lay);
      const uB = shadowMapCoord(lbx, lby);
      const forward = (uB - uA + 1) % 1;
      const start = forward <= 0.5 ? uA : uB;
      const span = forward <= 0.5 ? forward : 1 - forward;

      // One bin of slack each side: the range is only a bound on the walk, and
      // the `t` test below is what actually decides coverage.
      const first = Math.ceil(start * SHADOW_MAP_BINS - 1.5);
      const last = Math.floor((start + span) * SHADOW_MAP_BINS - 0.5) + 1;

      for (let bin = first; bin <= last; bin += 1) {
        const index = ((bin % SHADOW_MAP_BINS) + SHADOW_MAP_BINS) % SHADOW_MAP_BINS;
        binRay(index, ray);

        // s·ray = A + t·e, solved by crossing with e and with ray in turn.
        const denominator = ray.x * ey - ray.y * ex;
        if (denominator === 0) continue;
        const t = (ax * ray.y - ay * ray.x) / denominator;
        if (!(t >= 0) || !(t <= 1)) continue;
        const distance = (ax * ey - ay * ex) / denominator;
        // Outside the frustum's near/far planes the occluder is CLIPPED AWAY,
        // so the bin keeps whatever else reaches it — it is not occluded at the
        // clip plane's depth.
        if (!(distance >= near) || !(distance <= far)) continue;

        const stored = distance * zFarInv;
        if (stored < map[index]!) map[index] = stored;
      }
    }
  }

  return map;
}
