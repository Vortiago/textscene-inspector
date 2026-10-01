/**
 * A DirectionalLight3D's shadow, as the renderer sets it up: the camera slice it covers, the
 * splits of that slice, and the defaults that shape them.
 * `RendererSceneCull::_light_instance_setup_directional_shadow` reads the viewing camera and never
 * the light's position.
 */

import { directionalLightLightsSurfaces } from './directionalLightSkyMode.js';

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
 * (`servers/rendering/rendering_server.cpp:3704`). Every shadowed directional light takes a share
 * of the one atlas.
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
 * `light_storage.cpp:704` and `:711`: the four split ends, the depths the shader compares a
 * fragment's depth with (Godot's `shadow_split_offsets`). `MIN(limit, j)` clamps the split index, so
 * a light with fewer splits repeats its last far end.
 */
export function directionalShadowSplitEnds(distances: readonly number[], splitCount: number): number[] {
  const ends: number[] = [];
  for (let j = 0; j < DIRECTIONAL_SHADOW_MAX_SPLITS; j++) {
    ends.push(distances[Math.min(splitCount - 1, j) + 1]!);
  }
  return ends;
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
 * split's shadow over the last tenth of its own depth, which ends at `splitEnd`.
 */
export function directionalShadowBlendStart(splitEnd: number): number {
  return splitEnd - splitEnd * 0.1;
}

/**
 * `renderer_scene_cull.cpp:3271`: a directional light takes a share of the shadow atlas when its
 * shadow is on and it lights surfaces. The shadow mode does not count, so a light with an unknown
 * mode takes a share and draws nothing into it.
 */
export function sharesDirectionalShadowAtlas(shadowEnabled: boolean, skyMode: number): boolean {
  return shadowEnabled && directionalLightLightsSurfaces(skyMode);
}

/**
 * `renderer_scene_cull.cpp:3262`: the lights the renderer draws. `lights` are the visible
 * directional lights on a visible layer, in scenario order. The renderer stops at the
 * `MAX_DIRECTIONAL_LIGHTS`th, shadowed or not, so a light past it neither lights nor casts.
 */
export function directionalLightsDrawn<Light>(lights: readonly Light[]): Light[] {
  return lights.slice(0, MAX_DIRECTIONAL_LIGHTS);
}

/**
 * `renderer_scene_cull.cpp:3257-3277`: the lights that share the atlas, in the order they take
 * their shares. `lights` are as `directionalLightsDrawn` takes them.
 */
export function directionalLightsWithShadow<Light>(
  lights: readonly Light[],
  sharesAtlas: (light: Light) => boolean
): Light[] {
  return directionalLightsDrawn(lights).filter(sharesAtlas);
}

/** A rectangle of the directional shadow atlas, in texels. */
export interface DirectionalShadowAtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `light_storage.cpp:2577-2597`: the share of an `atlasSize` atlas that light `lightIndex` of
 * `lightCount` takes. The atlas splits into a grid that doubles its columns, then its rows, until
 * it holds every light, so two lights take the halves of its width at full height. The sizes are
 * integers, as in `Rect2i`.
 */
export function directionalShadowLightRect(
  atlasSize: number,
  lightCount: number,
  lightIndex: number
): DirectionalShadowAtlasRect {
  let columns = 1;
  let rows = 1;
  while (columns * rows < lightCount) {
    if (columns === rows) columns *= 2;
    else rows *= 2;
  }
  const width = Math.trunc(atlasSize / columns);
  const height = Math.trunc(atlasSize / rows);
  return {
    x: width * (lightIndex % columns),
    y: height * Math.trunc(lightIndex / columns),
    width,
    height,
  };
}

/**
 * `light_storage.cpp:2603-2623`, called at `renderer_scene_cull.cpp:2177`: the texture size a split's
 * fit counts texels against. Two splits halve the light's height and four halve both, and the
 * larger side counts. A count with no split keeps the light's whole rectangle.
 */
export function directionalShadowSplitTextureSize(
  splitCount: number,
  lightRect: Pick<DirectionalShadowAtlasRect, 'width' | 'height'>
): number {
  const split = directionalShadowSplitAtlasRect(splitCount, 0, { x: 0, y: 0, ...lightRect });
  return Math.max(split.width, split.height);
}

/**
 * `render_forward_clustered.cpp:2610-2630`: where split `index` draws, inside the light's own
 * rectangle of the atlas. Four splits take its quadrants in reading order, and two splits take the
 * first and second halves of its height.
 */
export function directionalShadowSplitAtlasRect(
  splitCount: number,
  index: number,
  lightRect: DirectionalShadowAtlasRect
): DirectionalShadowAtlasRect {
  const halfWidth = Math.trunc(lightRect.width / 2);
  const halfHeight = Math.trunc(lightRect.height / 2);
  if (splitCount === 4) {
    return {
      x: lightRect.x + (index % 2) * halfWidth,
      y: lightRect.y + Math.trunc(index / 2) * halfHeight,
      width: halfWidth,
      height: halfHeight,
    };
  }
  if (splitCount === 2) {
    return {
      x: lightRect.x,
      y: lightRect.y + index * halfHeight,
      width: lightRect.width,
      height: halfHeight,
    };
  }
  return { ...lightRect };
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
