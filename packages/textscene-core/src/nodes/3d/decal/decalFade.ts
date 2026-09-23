/**
 * Godot's Decal fade terms as pure maths over a baked projection. `upper_fade`, `lower_fade` and
 * `normal_fade` are per fragment in the engine and bake per vertex here. `distance_fade_*` is per
 * decal per frame on camera distance, computed CPU side in `TextureStorage::update_decal_buffer`
 * and folded into modulate alpha.
 */

import * as THREE from 'three';

/**
 * GLSL `smoothstep`, which clamps, as the decal term uses it (`scene_forward_clustered.glsl:1593`).
 * Not `godot/math.ts`'s `Math::smoothstep`, which guards coincident edges with `is_equal_approx`
 * and answers 0 at the lower edge. GLSL leaves the `normal_fade = 1` case undefined (a division by
 * zero), so stepping to 1 at the edge is this previewer's choice.
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
 * Bake the depth and normal fades into an RGBA `color` attribute of `(1, 1, 1, fade)`. RGB stays 1
 * so only alpha scales: three multiplies the vec4 into `diffuseColor`, and the material's `opacity`
 * already carries `albedo_mix × modulate.a`, so each factor of Godot's blend weight applies once.
 */
export function bakeDecalFadeAttribute(
  geometry: THREE.BufferGeometry,
  fade: DecalGeometricFade,
  sizeY: number
): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal') ?? null;
  // Per vertex is exact: the emitted `position` is already decal-local
  // (`buildDecalProjectionGeometry`), so `uv_local.y` is `position.y` over the half-depth. Normals
  // ride the same transform, so for a rigid, uniformly scaled decal the angle term reduces to
  // `normal.y`. A non-uniformly scaled decal breaks that equality.
  const halfDepth = sizeY / 2;
  const colors = new Float32Array(position.count * 4);

  // scene_forward_clustered.glsl: `fade = pow(1.0 - abs(uv_local.y), uv_local.y > 0.0 ?
  // upper_fade : lower_fade)`, times `smoothstep(normal_fade, 1.0, dot(geo_normal, decal_normal)
  // * 0.5 + 0.5)` when `normal_fade > 0.0`. `uv_local.y = (receiver_y - decal_y) / (size.y / 2)`
  // runs from -1 at the box's bottom face to +1 at its top.
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
    // The rasteriser interpolates baked alpha linearly, a chord of `pow()` across each triangle.
    // That is exact where fade is constant per triangle (a planar receiver perpendicular to the
    // projector, as in every blob shadow) and bands on a tilted or curved one, worst case ~0.31
    // of alpha at Godot's default exponent 0.3. The slice's comparison.md holds the trade.
    colors[o + 3] = f;
  }

  // Written even when both fades are inert: the shared material sets `vertexColors: true`, and
  // against a geometry with no `color` it samples `defaultAttributeValues`, which nothing here
  // guarantees. The bake and that flag must not be separable.
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
}

/**
 * Godot's camera-distance fade (`TextureStorage::update_decal_buffer`) over camera-to-decal-origin
 * `distance`, one scalar per decal per frame. The curve only: the caller guards whether a decal
 * fades, so one with the feature off skips the matrix reads and the distance measurement too.
 */
export function decalDistanceFade(begin: number, length: number, distance: number): number {
  // Order matters: Godot drops a decal past `begin + length` before the smoothstep, which makes
  // `length = 0` a hard cut at `begin`, not a division by zero.
  if (distance > begin + length) return 0;
  if (distance <= begin) return 1;
  return smoothstep(0, 1, 1 - (distance - begin) / length);
}
