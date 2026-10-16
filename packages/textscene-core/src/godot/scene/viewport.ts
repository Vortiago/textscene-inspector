/**
 * Godot 4.6.3's Viewport positional shadow atlas settings: the root's project defaults, a Viewport's
 * own defaults, and what its setters store.
 */

import { enumNamesByValue, relabelEnumNames } from '../classdb/enumNames.js';
import type { PositionalShadowAtlasSettings } from '../rendering/lights/positionalShadowAtlas.js';

/** `Viewport::PositionalShadowAtlasQuadrantSubdiv` (`scene/main/viewport.h:108-117`), without its `_MAX`. */
export enum PositionalShadowAtlasQuadrantSubdiv {
  DISABLED = 0,
  SHADOWS_1 = 1,
  SHADOWS_4 = 2,
  SHADOWS_16 = 3,
  SHADOWS_64 = 4,
  SHADOWS_256 = 5,
  SHADOWS_1024 = 6,
}

/** Godot's names for the subdivisions are the shadow counts: `SHADOW_ATLAS_QUADRANT_SUBDIV_4` is "4". */
export const POSITIONAL_SHADOW_ATLAS_QUADRANT_SUBDIV_NAMES = relabelEnumNames(
  enumNamesByValue(PositionalShadowAtlasQuadrantSubdiv),
  (name) => name.replace('SHADOWS_', '')
);

/** `Viewport::AnisotropicFiltering` (`viewport.h:128-135`), without its `_MAX`. */
export enum AnisotropicFiltering {
  DISABLED = 0,
  '2X' = 1,
  '4X' = 2,
  '8X' = 3,
  '16X' = 4,
}

export const ANISOTROPIC_FILTERING_NAMES = enumNamesByValue(AnisotropicFiltering);

/** `Viewport::Scaling3DMode` (`viewport.h:99-106`), without its `_MAX`. */
export enum Scaling3DMode {
  BILINEAR = 0,
  FSR = 1,
  FSR2 = 2,
  METALFX_SPATIAL = 3,
  METALFX_TEMPORAL = 4,
}

export const SCALING_3D_MODE_NAMES = enumNamesByValue(Scaling3DMode);

/** `Viewport::ScreenSpaceAA` (`viewport.h:137-142`), without its `_MAX`. */
export enum ScreenSpaceAA {
  DISABLED = 0,
  FXAA = 1,
  SMAA = 2,
}

export const SCREEN_SPACE_AA_NAMES = enumNamesByValue(ScreenSpaceAA);

/**
 * `Viewport::DebugDraw` (`viewport.h:158-186`). The enum ends with INTERNAL_BUFFER and has no
 * `_MAX` sentinel.
 */
export enum DebugDraw {
  DISABLED = 0,
  UNSHADED = 1,
  LIGHTING = 2,
  OVERDRAW = 3,
  WIREFRAME = 4,
  NORMAL_BUFFER = 5,
  VOXEL_GI_ALBEDO = 6,
  VOXEL_GI_LIGHTING = 7,
  VOXEL_GI_EMISSION = 8,
  SHADOW_ATLAS = 9,
  DIRECTIONAL_SHADOW_ATLAS = 10,
  SCENE_LUMINANCE = 11,
  SSAO = 12,
  SSIL = 13,
  PSSM_SPLITS = 14,
  DECAL_ATLAS = 15,
  SDFGI = 16,
  SDFGI_PROBES = 17,
  GI_BUFFER = 18,
  DISABLE_LOD = 19,
  CLUSTER_OMNI_LIGHTS = 20,
  CLUSTER_SPOT_LIGHTS = 21,
  CLUSTER_DECALS = 22,
  CLUSTER_REFLECTION_PROBES = 23,
  OCCLUDERS = 24,
  MOTION_VECTORS = 25,
  INTERNAL_BUFFER = 26,
}

export const DEBUG_DRAW_NAMES = enumNamesByValue(DebugDraw);

/** `Viewport::SDFOversize` (`viewport.h:203-209`), without its `_MAX`. */
export enum SdfOversize {
  '100_PERCENT' = 0,
  '120_PERCENT' = 1,
  '150_PERCENT' = 2,
  '200_PERCENT' = 3,
}

export const SDF_OVERSIZE_NAMES = enumNamesByValue(SdfOversize);

/** `Viewport::SDFScale` (`viewport.h:211-216`), without its `_MAX`. */
export enum SdfScale {
  '100_PERCENT' = 0,
  '50_PERCENT' = 1,
  '25_PERCENT' = 2,
}

export const SDF_SCALE_NAMES = enumNamesByValue(SdfScale);

/** `Viewport::VRSMode` (`viewport.h:222-227`), without its `_MAX`. */
export enum VrsMode {
  DISABLED = 0,
  TEXTURE = 1,
  XR = 2,
}

export const VRS_MODE_NAMES = enumNamesByValue(VrsMode);

/** `Viewport::VRSUpdateMode` (`viewport.h:229-234`), without its `_MAX`. */
export enum VrsUpdateMode {
  DISABLED = 0,
  ONCE = 1,
  ALWAYS = 2,
}

export const VRS_UPDATE_MODE_NAMES = enumNamesByValue(VrsUpdateMode);

/**
 * The root viewport's atlas side: `rendering/lights_and_shadows/positional_shadow/atlas_size`
 * defaults to 4096 (`scene/main/scene_tree.cpp:2130`, applied at `:2138`). A `.tscn` does not record
 * the project settings, so the default stands. The editor's 3D viewport takes the same setting
 * (`editor/scene/3d/node_3d_editor_plugin.cpp:3157`).
 */
const POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT = 4096;

/** A `Viewport`'s own atlas side, which a SubViewport keeps (`scene/main/viewport.h:305`). */
const VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT = 2048;

/**
 * The shadow count of each `PositionalShadowAtlasQuadrantSubdiv` value, from Disabled to 1024
 * Shadows (`scene/main/viewport.cpp:1420`).
 */
const POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS = [0, 1, 4, 16, 64, 256, 1024] as const;

/**
 * The quadrant subdivisions, as `PositionalShadowAtlasQuadrantSubdiv` values: 4, 4, 16 and 64
 * shadows. The root takes them from the project settings (`scene_tree.cpp:2133-2136`), and a
 * `Viewport` sets the same values itself (`viewport.cpp:5363-5366`).
 */
const POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT = [
  PositionalShadowAtlasQuadrantSubdiv.SHADOWS_4,
  PositionalShadowAtlasQuadrantSubdiv.SHADOWS_4,
  PositionalShadowAtlasQuadrantSubdiv.SHADOWS_16,
  PositionalShadowAtlasQuadrantSubdiv.SHADOWS_64,
] as const;

/** The root viewport's atlas at the project defaults. */
export const ROOT_POSITIONAL_SHADOW_ATLAS: PositionalShadowAtlasSettings = {
  size: POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  quadrantShadows: POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT.map(
    (subdiv) => POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[subdiv]
  ),
};

/**
 * A viewport's atlas from its `positional_shadow_atlas_size` and `positional_shadow_atlas_quad_0` to
 * `_3`, each absent where the `.tscn` leaves the default. The server refuses a negative size
 * (`light_storage.cpp:2158`), and the setter a subdivision outside the enum
 * (`viewport.cpp:1412-1413`), so either keeps the default.
 */
export function viewportPositionalShadowAtlas(
  size: number | undefined,
  quadrantSubdivs: readonly (number | undefined)[]
): PositionalShadowAtlasSettings {
  const quadrantShadows = POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT.map((fallback, quadrant) => {
    const subdiv = quadrantSubdivs[quadrant];
    const shadows =
      subdiv !== undefined && Number.isInteger(subdiv)
        ? POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[subdiv]
        : undefined;
    return shadows ?? POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS[fallback];
  });
  const isServerSize = size !== undefined && Number.isFinite(size) && size >= 0;
  return { size: isServerSize ? size : VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT, quadrantShadows };
}

/**
 * `Viewport::DefaultCanvasItemTextureFilter` (`scene/main/viewport.h:188-193`), without its `_MAX`, as the
 * integers a `.tscn` stores for `canvas_item_default_texture_filter`. LINEAR_WITH_MIPMAPS is 2 and
 * NEAREST_WITH_MIPMAPS is 3, the opposite of the order the two names suggest. 4.7.2 adds PARENT_NODE
 * (`viewport.h:197`), which 4.6.3 refuses.
 */
export enum DefaultCanvasItemTextureFilter {
  NEAREST = 0,
  LINEAR = 1,
  LINEAR_WITH_MIPMAPS = 2,
  NEAREST_WITH_MIPMAPS = 3,
  PARENT_NODE = 4,
}

/**
 * `Viewport::DefaultCanvasItemTextureRepeat` (`scene/main/viewport.h:196-200`), as the integers a `.tscn`
 * stores for `canvas_item_default_texture_repeat`. 4.7.2 adds PARENT_NODE (`viewport.h:205`), which
 * 4.6.3 refuses.
 */
export enum DefaultCanvasItemTextureRepeat {
  DISABLED = 0,
  ENABLED = 1,
  MIRROR = 2,
  PARENT_NODE = 3,
}

export const DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_NAMES = enumNamesByValue(DefaultCanvasItemTextureRepeat);

export const DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NAMES = enumNamesByValue(DefaultCanvasItemTextureFilter);

/** A Viewport's default filter for a CanvasItem that defers to its ancestors (`viewport.h:419`). */
export const VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER = DefaultCanvasItemTextureFilter.LINEAR;

/** `SubViewport::UpdateMode` (`viewport.h:877-883`): when the target is re-rendered. */
export enum SubViewportUpdateMode {
  DISABLED = 0,
  ONCE = 1,
  WHEN_VISIBLE = 2,
  WHEN_PARENT_VISIBLE = 3,
  ALWAYS = 4,
}

export const SUB_VIEWPORT_UPDATE_MODE_NAMES = enumNamesByValue(SubViewportUpdateMode);

/** `SubViewport::ClearMode` (`viewport.h:871-875`): how the target is cleared before a render. */
export enum SubViewportClearMode {
  ALWAYS = 0,
  NEVER = 1,
  ONCE = 2,
}

export const SUB_VIEWPORT_CLEAR_MODE_NAMES = enumNamesByValue(SubViewportClearMode);
