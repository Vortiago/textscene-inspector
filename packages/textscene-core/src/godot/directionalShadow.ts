/**
 * A DirectionalLight3D's shadow, as the renderer sets it up: the camera slice it covers, the
 * splits of that slice, and the defaults that shape them.
 * `RendererSceneCull::_light_instance_setup_directional_shadow` reads the viewing camera and never
 * the light's position.
 */

/** `DirectionalLight3D()` sets `PARAM_SHADOW_MAX_DISTANCE` to 100 (`scene/3d/light_3d.cpp:600`). */
export const DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT = 100;

/** `DirectionalLight3D()` sets `PARAM_SHADOW_FADE_START` to 0.8 (`scene/3d/light_3d.cpp:601`). */
export const DIRECTIONAL_SHADOW_FADE_START_DEFAULT = 0.8;

/**
 * `servers/rendering/renderer_scene_render.h:48`: the forward renderers draw at most this many
 * directional lights (`scene_forward_clustered.glsl:2282` loops `i < 8`).
 */
export const MAX_DIRECTIONAL_LIGHTS = 8;

/** `Light3D()` sets `PARAM_SHADOW_PANCAKE_SIZE` to 20 (`scene/3d/light_3d.cpp:487`). */
export const DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT = 20;

/**
 * `DirectionalLight3D()` sets `PARAM_SHADOW_NORMAL_BIAS` to 2 (`scene/3d/light_3d.cpp:603`), in texels
 * of the shadow map.
 */
export const DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT = 2;

/**
 * `rendering/lights_and_shadows/directional_shadow/size` defaults to 4096
 * (`servers/rendering/rendering_server.cpp:3704`). One orthogonal light takes the whole atlas.
 */
export const DIRECTIONAL_SHADOW_SIZE_DEFAULT = 4096;

/** The camera depths, from the eye, that one orthogonal shadow map covers. */
export interface DirectionalShadowSlice {
  near: number;
  far: number;
}

/**
 * `renderer_scene_cull.cpp:2143-2149`: the camera's own `[z_near, z_far]`, the far end pulled in
 * to a positive `shadow_max` for a perspective camera only, and kept 0.001 past the near end.
 * An orthogonal camera ignores `shadow_max`: the engine calls it impractical there.
 */
export function directionalShadowSlice(
  zNear: number,
  zFar: number,
  shadowMaxDistance: number,
  isOrthogonal: boolean
): DirectionalShadowSlice {
  let far = zFar;
  if (shadowMaxDistance > 0 && !isOrthogonal) far = shadowMaxDistance < far ? shadowMaxDistance : far;
  const nearFloor = zNear + 0.001;
  far = far > nearFloor ? far : nearFloor;
  const near = zNear < far ? zNear : far;
  return { near, far };
}

/**
 * `renderer_scene_cull.cpp:2282`: the fitted sphere grows by one texel on each side, so the
 * snapped box never clips the slice's outermost point.
 */
export function texelPaddedRadius(radius: number, shadowMapSize: number): number {
  return radius * (shadowMapSize / (shadowMapSize - 2));
}

/**
 * `renderer_scene_cull.cpp:2303`: the step the box edges snap to. A camera that moves less than
 * one step leaves the edges in place, so the shadow's jagged edges hold still.
 */
export function directionalShadowSnapStep(radius: number, shadowMapSize: number): number {
  return (radius * 4) / shadowMapSize;
}

/**
 * `renderer_scene_cull.cpp:2347`: one shadow-map texel in world units. The normal bias is counted
 * in these (`light_storage.cpp:724`), so it grows with the map's footprint.
 */
export function directionalShadowTexelSize(radius: number, shadowMapSize: number): number {
  return (radius * 2) / shadowMapSize;
}

/**
 * `render_forward_clustered.cpp:2606` switches pancaking on for any positive pancake size. The
 * depth pass then flattens a vertex past the near plane onto it
 * (`scene_forward_clustered.glsl:679-682`), so a caster nearer the light still casts.
 */
export function pancakesCasters(pancakeSize: number): boolean {
  return pancakeSize > 0;
}

/** `DirectionalLight3D::ShadowMode` (`scene/3d/light_3d.h:166-170`). */
export const DirectionalShadowMode = {
  ORTHOGONAL: 0,
  PARALLEL_2_SPLITS: 1,
  PARALLEL_4_SPLITS: 2,
} as const;

/**
 * `DirectionalLight3D()` sets four splits (`scene/3d/light_3d.cpp:606`), and so does the editor's
 * preview sun (`editor/scene/3d/node_3d_editor_plugin.cpp:10383`).
 */
export const DIRECTIONAL_SHADOW_MODE_DEFAULT = DirectionalShadowMode.PARALLEL_4_SPLITS;

/**
 * `Light3D()` sets `PARAM_SHADOW_SPLIT_1_OFFSET` to `PARAM_SHADOW_SPLIT_3_OFFSET` to these fractions
 * of the shadowed range (`scene/3d/light_3d.cpp:483-485`).
 */
export const DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT: readonly [number, number, number] = [0.1, 0.2, 0.5];

/** `DirectionalLight3D()` leaves split blending off (`scene/3d/light_3d.cpp:607`). */
export const DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT = false;

/**
 * The most splits one light draws. The shader holds one far end per split in a vec4
 * (`light_storage.h:207`, `light_storage.cpp:706`).
 */
export const DIRECTIONAL_SHADOW_MAX_SPLITS = 4;

/**
 * `renderer_scene_cull.cpp:2155-2166`: 1, 2 or 4 splits. The switch has no default, so an unknown
 * mode sets up no split and renders no shadow map for the light.
 */
export function directionalShadowSplitCount(mode: number): 0 | 1 | 2 | 4 {
  switch (mode) {
    case DirectionalShadowMode.ORTHOGONAL:
      return 1;
    case DirectionalShadowMode.PARALLEL_2_SPLITS:
      return 2;
    case DirectionalShadowMode.PARALLEL_4_SPLITS:
      return 4;
    default:
      return 0;
  }
}

/**
 * `renderer_scene_cull.cpp:2170-2175`: the camera depths where the splits meet, `splitCount + 1` of
 * them. Depth `i + 1` sits `split_<i + 1>` of the way through the slice, and the last is always the
 * slice's far end, so a light with two splits never reads `split_2`.
 */
export function directionalShadowSplitDistances(
  slice: DirectionalShadowSlice,
  splitCount: number,
  splitOffsets: readonly number[]
): number[] {
  const range = slice.far - slice.near;
  const distances = [slice.near];
  for (let i = 0; i < splitCount; i++) distances.push(slice.near + (splitOffsets[i] ?? 0) * range);
  distances[splitCount] = slice.far;
  return distances;
}

/**
 * `renderer_scene_cull.cpp:2197` and `:2200`: the depths split `index` covers. With blending on,
 * every split after the first starts where the previous one starts, so both cover the blend band.
 */
export function directionalShadowSplitRange(
  distances: readonly number[],
  index: number,
  blendSplits: boolean
): DirectionalShadowSlice {
  const nearIndex = index === 0 || !blendSplits ? index : index - 1;
  return { near: distances[nearIndex]!, far: distances[index + 1]! };
}

/**
 * `light_storage.cpp:704` and `:711`: the four depths the shader compares a fragment's depth with.
 * `MIN(limit, j)` clamps the split index, so a light with fewer splits repeats its last far end.
 */
export function directionalShadowSplitOffsets(distances: readonly number[], splitCount: number): number[] {
  const offsets: number[] = [];
  for (let j = 0; j < DIRECTIONAL_SHADOW_MAX_SPLITS; j++) {
    offsets.push(distances[Math.min(splitCount - 1, j) + 1]!);
  }
  return offsets;
}

/**
 * `light_storage.cpp:705`: an orthogonal light never blends, whatever
 * `directional_shadow_blend_splits` says.
 */
export function blendsSplits(splitCount: number, blendSplits: boolean): boolean {
  return splitCount > 1 && blendSplits;
}

/**
 * `scene_forward_clustered.glsl:2453`, `:2460` and `:2467`: a blending split mixes in the next
 * split's shadow over the last tenth of its own depth.
 */
export function directionalShadowBlendStart(splitOffset: number): number {
  return splitOffset - splitOffset * 0.1;
}

/**
 * `light_storage.cpp:2603-2623`: the texture size a split's fit counts texels against, for a scene's
 * only shadowed directional light, which owns the whole atlas. Two splits halve the height and keep
 * the width, so the larger side stays the whole atlas. Four splits halve both.
 */
export function directionalShadowSplitTextureSize(splitCount: number, atlasSize: number): number {
  return splitCount === 4 ? atlasSize / 2 : atlasSize;
}

/** A rectangle of the directional shadow atlas, in texels. */
export interface DirectionalShadowAtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `render_forward_clustered.cpp:2612-2629`: where split `index` draws in the atlas. Four splits take
 * the quadrants in reading order, and two splits take the first and second halves of its height.
 */
export function directionalShadowSplitAtlasRect(
  splitCount: number,
  index: number,
  atlasSize: number
): DirectionalShadowAtlasRect {
  const half = atlasSize / 2;
  if (splitCount === 4) {
    return { x: (index % 2) * half, y: Math.floor(index / 2) * half, width: half, height: half };
  }
  if (splitCount === 2) return { x: 0, y: index * half, width: atlasSize, height: half };
  return { x: 0, y: 0, width: atlasSize, height: atlasSize };
}

/**
 * `light_storage.cpp:753` caps the fade start below 1, since GLSL leaves `smoothstep` undefined
 * when its two edges meet.
 */
const FADE_START_CEILING = 0.999;

/** The camera depths across which a directional shadow fades out. */
export interface DirectionalShadowFade {
  from: number;
  to: number;
}

/**
 * `light_storage.cpp:752-754`: the fade runs from `fade_start` of `shadow_split_offsets[3]` to that
 * depth. Slot 3 holds the slice's far end in every mode (`:711`, `renderer_scene_cull.cpp:2175`).
 * The receiver mixes whichever split it sampled towards unshadowed by `smoothstep(from, to, depth)`
 * (`scene_forward_clustered.glsl:2491`), so nothing past the last split is shadowed.
 */
export function directionalShadowFade(lastSplitFar: number, fadeStart: number): DirectionalShadowFade {
  // Godot's `MIN` is a ternary, so a `nan` fade start takes the ceiling.
  const start = fadeStart < FADE_START_CEILING ? fadeStart : FADE_START_CEILING;
  return { from: lastSplitFar * start, to: lastSplitFar };
}
