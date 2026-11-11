/**
 * Godot's per-light 2D shadow map, a 1D polar depth buffer, built on the CPU. Every shadowed
 * PointLight2D samples it per fragment with Godot's taps (`shadowTaps.ts`).
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { edgeCastsShadow, lightRectTest, type LightRect, type ShadowCasterEdges } from './shadowCasterEdges';

/**
 * What a bin holds where nothing occludes: Godot clears the row to `p_far`,
 * which is 1.0 once normalised by `z_far`. A fragment inside the light's rect
 * never reaches it: its axis distance is at most half the diagonal, against a
 * far plane of 1.1 diagonals.
 */
export const SHADOW_MAP_FAR = 1;

/** `radius_cache / 1000`, the near plane of `renderer_viewport.cpp:556`. */
const NEAR_SCALE = 1 / 1000;

/** `radius_cache * 1.1`, the same line's far plane and the `z_far` divisor. */
const FAR_SCALE = 1.1;

/**
 * The reciprocal of the far plane every stored bin is normalised by. The
 * fragment shader divides by this same value: a mismatch slides the penumbra
 * and fails no check.
 */
export function shadowMapZFarInv(radius: number): number {
  return 1 / (radius * FAR_SCALE);
}

/** cos/sin of 45°, `canvas.glsl:824`'s quadrant-select rotation. */
const SQRT1_2 = 0.7071067811865476;

export interface ShadowPolarLight {
  /**
   * Previewer world (Godot pixels, Y negated) to light-local, as a row-major 2×3
   * affine. Godot's `xform_cache.affine_inverse()` (`renderer_viewport.cpp:556`):
   * the light's rotation and scale reach the map, and `offset` does not.
   */
  readonly worldToLocal: ArrayLike<number>;
  /** The light's `rect_cache` in previewer world space, which culls the occluders. */
  rect: LightRect;
  /**
   * Godot's `radius_cache`: `local_rect.size.length()` (`renderer_viewport.cpp:485`),
   * the full diagonal of the cookie's rect in light-local units. It sets only the
   * near and far clips and the normalisation.
   */
  readonly radius: number;
}

/**
 * `canvas.glsl:821-843`'s `tex_ofs`, a box mapping and not an angle, for a
 * light-local direction (Y up). Runs 0 → 1 once round, wrapping at (1, 1), and
 * is 0 for a zero-length direction. The bin walk reads this one formula.
 */
function shadowMapCoord(x: number, yUp: number): number {
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
 * Bin `index`'s ray in Godot light-local space, its axis component 1 so the ray
 * parameter is the stored axis distance. The inverse of `shadowMapCoord`, taken
 * at the texel centre, where the rasteriser decides coverage. Each frustum fills
 * `floor(bins / 4)` columns (`renderer_canvas_render_rd.cpp:1095`), so a size four does
 * not divide leaves its last columns unwritten: false for them, and they keep the far value.
 */
function binRay(index: number, bins: number, out: { x: number; y: number }): boolean {
  const columns = Math.floor(bins / 4);
  const quadrant = Math.floor(index / columns);
  if (quadrant > 3) return false;
  const u = (quadrant + ((index % columns) + 0.5) / columns) / 4;
  // Quadrant 0 rasterises `(x, y, 0) → (y, 0, -x)` into `glViewport(0, …, size / 4, 2)`,
  // so a column lands at `(y/x) * (size/8) + (size/8)`: the texel `tex_ofs` addresses.
  if (quadrant === 0) {
    out.x = 1;
    // A tangent coordinate moves a tap `Δu` by `8 · Δu · axisDistance`, so the
    // penumbra is linear in it. Godot 4.6.3, PCF5, smooth 8, steps in px:
    // 304.6/314.3/324/333.7/343.4 at axis distance 276, 283.5/303.75/324/344.25/364.5
    // at 576, a ramp 2.087× wider for 2.087× the distance.
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
  return true;
}

/**
 * The map for one light: `bins` normalised axis distances, and `SHADOW_MAP_FAR` where nothing
 * casts. `bins` is the `rendering/2d/shadow_atlas/size` row, which `light_update_shadow`
 * (`drivers/gles3/rasterizer_canvas_gles3.cpp:1639`) fills through four 90° frusta of `bins / 4`
 * columns each, so it is also the bins per full turn. `casters` are world-space occluders
 * narrowed by `shadow_item_cull_mask`, and `lightRectTest` drops those outside the light's rect.
 */
export function buildShadowPolarMap(
  light: ShadowPolarLight,
  casters: readonly ShadowCasterEdges[],
  bins: number
): Float32Array {
  // Built on the CPU from settled inputs, so the goldens see one exact texture.
  // A GPU raster carries the driver's fill-rule variance into the baseline.
  const map = new Float32Array(bins).fill(SHADOW_MAP_FAR);

  const near = light.radius * NEAR_SCALE;
  const far = light.radius * FAR_SCALE;
  if (!(far > near)) return map;
  const zFarInv = shadowMapZFarInv(light.radius);

  const m = light.worldToLocal;
  const m00 = m[0]!;
  const m01 = m[1]!;
  const m02 = m[2]!;
  const m10 = m[3]!;
  const m11 = m[4]!;
  const m12 = m[5]!;

  const ray = { x: 0, y: 0 };
  const inLightRect = lightRectTest(light.rect);

  for (const { segments, cullMode, bounds } of casters) {
    if (!inLightRect(bounds)) continue;
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
      if (!edgeCastsShadow(lax, lay, lbx, lby, cullMode)) continue;

      // Godot's Y-down local space, where the quadrant rule is stated. A
      // half-ported sign puts the penumbra on the wrong side of a rotated light.
      const ax = lax;
      const ay = 0 - lay;
      const ex = lbx - lax;
      const ey = lay - lby;

      // The arc between the endpoints, the short way round. A non-collinear edge
      // subtends less than half a turn, and `u(θ + π) = u(θ) + 0.5`, so that is
      // less than 0.5 of u.
      const uA = shadowMapCoord(lax, lay);
      const uB = shadowMapCoord(lbx, lby);
      const forward = (uB - uA + 1) % 1;
      const start = forward <= 0.5 ? uA : uB;
      const span = forward <= 0.5 ? forward : 1 - forward;

      // One bin of slack each side: the range is only a bound on the walk, and
      // the `t` test below is what actually decides coverage.
      const first = Math.ceil(start * bins - 1.5);
      const last = Math.floor((start + span) * bins - 0.5) + 1;

      for (let bin = first; bin <= last; bin += 1) {
        const index = ((bin % bins) + bins) % bins;
        if (!binRay(index, bins, ray)) continue;

        // s·ray = A + t·e, solved by crossing with e and with ray in turn.
        const denominator = ray.x * ey - ray.y * ex;
        if (denominator === 0) continue;
        const t = (ax * ray.y - ay * ray.x) / denominator;
        if (!(t >= 0) || !(t <= 1)) continue;
        const distance = (ax * ey - ay * ex) / denominator;
        // Outside the near and far planes the occluder is clipped away, so the
        // bin keeps whatever else reaches it.
        if (!(distance >= near) || !(distance <= far)) continue;

        // A bin holds the quadrant-axis distance over `z_far`, not the Euclidean
        // one (`drivers/gles3/shaders/canvas_occlusion.glsl:28,56`). The item side
        // compares the same component (`canvas.glsl:830-845`), so `z_far` cancels.
        // `GL_LESS` over the four passes is a `min`.
        const stored = distance * zFarInv;
        if (stored < map[index]!) map[index] = stored;
      }
    }
  }

  return map;
}
