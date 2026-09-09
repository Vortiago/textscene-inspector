/**
 * Godot's Decal fade terms, as pure maths over a baked projection.
 *
 * Godot fades a decal three ways, and the three live in different places in the
 * engine, which is why they are handled differently here:
 *
 *   - `upper_fade` / `lower_fade` — per fragment, on distance along the
 *     projection axis, with a DIFFERENT exponent above and below the origin;
 *   - `normal_fade` — per fragment, on the angle between the receiving surface
 *     and the projector;
 *   - `distance_fade_*` — per DECAL per frame, on camera distance, computed CPU
 *     side in `TextureStorage::update_decal_buffer` and folded into the decal's
 *     modulate alpha.
 *
 * The first two, from `scene_forward_clustered.glsl`:
 *
 *     float fade = pow(1.0 - abs(uv_local.y), uv_local.y > 0.0 ? upper_fade : lower_fade);
 *     if (normal_fade > 0.0)
 *       fade *= smoothstep(normal_fade, 1.0, dot(geo_normal, decal_normal) * 0.5 + 0.5);
 *
 * where `uv_local.y = (receiver_y - decal_y) / (size.y / 2)`, running -1 at the
 * box's bottom face to +1 at its top.
 *
 * WHY PER VERTEX IS EXACT HERE, not an approximation of convenience:
 * `buildDecalProjectionGeometry` hands `DecalGeometry` a proxy whose world
 * matrix is `decalWorld⁻¹ · receiver.matrixWorld`, so the emitted `position` is
 * already in the DECAL'S local frame and `uv_local.y` is just `position.y`
 * over the box half-depth. Normals ride the same transform's normal matrix; for
 * a rigid, uniformly-scaled decal that leaves `dot(n, decal_local_+Y)` equal to
 * Godot's `dot(geo_normal, decal_normal)`, so the term collapses to `normal.y`.
 * (A non-uniformly scaled decal breaks that equality. None exists in the corpus.)
 *
 * What per-vertex costs: the rasteriser interpolates the baked alpha linearly,
 * so `pow()` is approximated by its chord across each triangle. That is EXACT
 * wherever fade is constant per triangle — a planar receiver perpendicular to
 * the projector, which is every blob shadow and every decal fixture — and bands
 * on a tilted or curved one, worst case ~0.31 of alpha at Godot's default
 * exponent 0.3. See the slice's comparison.md for the trade.
 */

import * as THREE from 'three';

/**
 * GLSL `smoothstep`, which clamps — the one the decal term is written in
 * (`scene_forward_clustered.glsl:1593`).
 *
 * Deliberately NOT `godot/math.ts`'s `smoothstep`. That is `Math::smoothstep`,
 * a different function that happens to share a name: it guards coincident edges
 * with `is_equal_approx` and answers 0 AT the lower edge. GLSL has no such
 * guard, so the authority for the degenerate case `normal_fade = 1` reaches is
 * the spec's division by zero, which is undefined. Stepping to 1 at the edge is
 * this previewer's choice for it, made here rather than inherited from a
 * function whose engine call site is not this one.
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The three authored exponents/edges, one field per Godot property. */
export interface DecalGeometricFade {
  /** Exponent applied above the decal origin. */
  upperFade: number;
  /** Exponent applied below it. */
  lowerFade: number;
  /** Lower smoothstep edge for the surface-angle term; 0 disables it entirely. */
  normalFade: number;
}

/**
 * Bake the depth and normal fades into an RGBA `color` attribute of
 * `(1, 1, 1, fade)`.
 *
 * RGB stays 1 so ONLY alpha is scaled: three multiplies the whole vec4 into
 * `diffuseColor`, and the projection material's `opacity` already carries
 * `albedo_mix × modulate.a`, so Godot's blend weight comes out with each factor
 * applied exactly once.
 *
 * The attribute is written unconditionally, even when both fades are inert. The
 * material sets `vertexColors: true` once and shares itself across every
 * receiver, and `vertexColors` against a geometry with no `color` attribute
 * samples whatever `defaultAttributeValues` holds — nothing this module guarantees,
 * so the bake and that flag must not be separable.
 */
export function bakeDecalFadeAttribute(
  geometry: THREE.BufferGeometry,
  fade: DecalGeometricFade,
  sizeY: number
): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal') ?? null;
  const halfDepth = sizeY / 2;
  const colors = new Float32Array(position.count * 4);

  for (let i = 0; i < position.count; i++) {
    // A degenerate box has no interior to fade across; treat it as unfaded
    // rather than dividing by zero.
    const t = halfDepth > 0 ? position.getY(i) / halfDepth : 0;
    const exponent = t > 0 ? fade.upperFade : fade.lowerFade;
    // The clamp guards a vertex a float-epsilon outside the box, where the base
    // would go negative and `pow` would return NaN.
    let f = Math.pow(Math.max(0, 1 - Math.abs(t)), exponent);

    if (fade.normalFade > 0 && normal) {
      // decal_normal is decal-local +Y, so the dot product is just normal.y.
      f *= smoothstep(fade.normalFade, 1, normal.getY(i) * 0.5 + 0.5);
    }

    const o = i * 4;
    colors[o] = 1;
    colors[o + 1] = 1;
    colors[o + 2] = 1;
    colors[o + 3] = f;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
}

/**
 * Godot's camera-distance fade, from `TextureStorage::update_decal_buffer`.
 *
 * The ordering is load-bearing and not cosmetic: Godot drops a decal from the
 * buffer entirely when it is further than `begin + length`, and only the
 * survivors reach the smoothstep. That is what makes `length = 0` a hard cut at
 * `begin` rather than a division by zero.
 *
 * `distance` is camera-to-DECAL-ORIGIN — one scalar per decal per frame, not a
 * per-fragment quantity.
 *
 * This is the curve only. Whether a decal fades at all is the caller's guard,
 * because a decal with the feature off must skip the matrix reads and the
 * distance measurement too, not just arrive here and be handed a 1.
 */
export function decalDistanceFade(begin: number, length: number, distance: number): number {
  if (distance > begin + length) return 0;
  if (distance <= begin) return 1;
  return smoothstep(0, 1, 1 - (distance - begin) / length);
}
