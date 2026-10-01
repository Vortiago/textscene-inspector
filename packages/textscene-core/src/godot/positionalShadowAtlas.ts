/**
 * Godot's positional shadow atlas at its project defaults: the slot an omni or spot light's shadow
 * takes, which decides the map's resolution, and the PCF kernel an omni light samples in that slot.
 * A `.tscn` does not record the project settings, so the defaults stand.
 */

/**
 * `rendering/lights_and_shadows/positional_shadow/atlas_size` defaults to 4096
 * (`scene/main/scene_tree.cpp:2130`), which the root viewport takes (`:2138`). The editor's 3D
 * viewport takes the same setting (`editor/scene/3d/node_3d_editor_plugin.cpp:3157`).
 */
export const POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT = 4096;

/**
 * Shadows per quadrant at the default `atlas_quadrant_0_subdiv` to `_3_subdiv`, the enum values 2, 2,
 * 3 and 4 (`scene_tree.cpp:2133-2136`), which `Viewport` maps to these counts
 * (`scene/main/viewport.cpp:1420`).
 */
export const POSITIONAL_SHADOW_QUADRANT_SHADOWS_DEFAULT = [4, 4, 16, 64] as const;

/**
 * `next_power_of_2` (`core/typedefs.h:179-192`): zero stays zero.
 */
function nextPowerOfTwo(value: number): number {
  if (value === 0) return 0;
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

/**
 * A quadrant's slots per axis: the shadow count rounded up to a power of two with an integer square
 * root (`servers/rendering/renderer_rd/storage_rd/light_storage.cpp:2196-2201`).
 */
function slotsPerAxis(shadows: number): number {
  let count = nextPowerOfTwo(shadows);
  // `0xaaaaaaaa` holds the odd bit positions: an odd power of two has no integer square root.
  if (Math.log2(count) % 2 === 1) count *= 2;
  return Math.trunc(Math.sqrt(count));
}

const QUADRANT_SIZE = POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT / 2;

/** Each quadrant's slot size in texels, smallest first. */
const SLOT_SIZES = POSITIONAL_SHADOW_QUADRANT_SHADOWS_DEFAULT.map(
  (shadows) => QUADRANT_SIZE / slotsPerAxis(shadows)
).sort((a, b) => a - b);

const LARGEST_SLOT = SLOT_SIZES[SLOT_SIZES.length - 1]!;

/**
 * The side, in texels, of the square slot a light whose range covers `coverage` of the screen takes
 * (`light_storage.cpp:2390-2418`). The light asks for its coverage of a quadrant, rounded up to a
 * power of two and capped at the largest slot, and takes the smallest slot that holds it. Zero, a
 * negative coverage or NaN asks for nothing and takes the smallest slot. The light's
 * coverage comes from `renderer_scene_cull.cpp:3405-3467`. A full quadrant, which sends a light to a
 * smaller slot, is not modelled.
 */
export function positionalShadowSlotSize(coverage: number): number {
  // Capped before the rounding, not after: the cap is a power of two, so the answer is the same,
  // and an infinite coverage never reaches the loop.
  const asked = coverage > 0 ? Math.min(Math.trunc(QUADRANT_SIZE * coverage), LARGEST_SLOT) : 0;
  const desired = nextPowerOfTwo(asked);
  return SLOT_SIZES.find((size) => size >= desired) ?? LARGEST_SLOT;
}

/**
 * The side, in texels, of each cube face an omni light renders before Godot copies the cube into the
 * slot as two paraboloids (`servers/rendering/renderer_rd/forward_clustered/render_forward_clustered.cpp:2680`,
 * `:2732-2734`). The Dual Paraboloid mode draws each paraboloid straight into the slot, inset by a
 * texel per side (`:2696-2699`), and its texel at the pole spans the same angle as a cube face's at
 * its centre.
 */
export function omniShadowCubeSize(slotSize: number): number {
  return slotSize / 2;
}

/**
 * The radius, in radians, of an omni light's PCF kernel. `sample_omni_pcf_shadow` spreads
 * `soft_shadow_scale / (1 + |z|)` atlas texels over a paraboloid inset by a texel per side
 * (`servers/rendering/renderer_rd/shaders/scene_forward_lights_inc.glsl:354`, `:476-478`, `:597`), and
 * a texel of that paraboloid spans `(1 + |z|) * 2 / (slot - 2)` radians, so the angle is the same in
 * every direction.
 */
export function omniShadowKernelAngle(softShadowScale: number, slotSize: number): number {
  return (2 * softShadowScale) / (slotSize - 2);
}
