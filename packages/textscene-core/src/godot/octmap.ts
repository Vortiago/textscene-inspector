/**
 * Godot's octahedral map, which holds a sky's radiance and its roughness layers
 * (`servers/rendering/renderer_rd/shaders/oct_inc.glsl`). A map pads each side with mirrored
 * texels, so a filter that reads past an edge reads the directions beyond it.
 */

/**
 * Bound once, not read from `Math` per call: a global lookup inside a VM context, where the
 * vitest pool runs this, costs about 100 times a local one, in a loop that runs a million times.
 */
const { abs, hypot, max, min, sign } = Math;

export type OctDirection = [number, number, number];

/**
 * `oct_to_vec3_with_border` (`oct_inc.glsl:10-19`): the unit direction at `u`, `v` in 0..1.
 * `borderSize` is 1 minus twice the padding in UV.
 */
export function octToVec3WithBorder(u: number, v: number, borderSize: number): OctDirection {
  const x = (u - 0.5) * (2 / borderSize);
  const y = (v - 0.5) * (2 / borderSize);
  const mirroredX = 2 * min(max(x, -1), 1) - x;
  const mirroredY = 2 * min(max(y, -1), 1) - y;
  return octToVec3(abs(y) >= 1 ? -mirroredX : mirroredX, abs(x) >= 1 ? -mirroredY : mirroredY);
}

/**
 * `vec3_to_oct_with_border` (`oct_inc.glsl:38-41`), with `vec3_to_oct` (`:28-34`) and `oct_wrap`
 * (`:21-26`) for the lower half: writes the UV in 0..1 of the direction `x`, `y`,
 * `z`, which need not be unit length, to `out`. `padding` is the padding in UV. It allocates
 * nothing, as a sky's layers run it for every sample of every texel.
 */
export function vec3ToOctWithBorder(
  x: number,
  y: number,
  z: number,
  padding: number,
  out: Float64Array
): void {
  const sum = abs(x) + abs(y) + abs(z);
  let octX = x / sum;
  let octY = y / sum;
  if (z < 0) {
    const wrappedX = (1 - abs(octY)) * (octX >= 0 ? 1 : -1);
    octY = (1 - abs(octX)) * (octY >= 0 ? 1 : -1);
    octX = wrappedX;
  }
  const borderSize = 1 - padding * 2;
  out[0] = (octX * 0.5 + 0.5) * borderSize + padding;
  out[1] = (octY * 0.5 + 0.5) * borderSize + padding;
}

/** `oct_to_vec3` (`oct_inc.glsl:2-7`), at `x`, `y` in -1..1. */
function octToVec3(x: number, y: number): OctDirection {
  const z = 1 - abs(x) - abs(y);
  const fold = max(-z, 0);
  const foldedX = x - fold * sign(x);
  const foldedY = y - fold * sign(y);
  const length = hypot(foldedX, foldedY, z);
  return [foldedX / length, foldedY / length, z / length];
}
