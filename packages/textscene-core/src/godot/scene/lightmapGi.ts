/** Godot 4.6.3's LightmapGI facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `LightmapGI::BakeQuality` (`scene/3d/lightmap_gi.h:150-155`). */
const BakeQuality = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  ULTRA: 3,
} as const;

/** Each bake quality by its integer, spelled as its constant without `BAKE_QUALITY_`. */
export const LIGHTMAP_GI_BAKE_QUALITY_NAMES = enumNamesByValue(BakeQuality);

/** `LightmapGI::GenerateProbes` (`lightmap_gi.h:157-163`). */
const GenerateProbes = {
  DISABLED: 0,
  SUBDIV_4: 1,
  SUBDIV_8: 2,
  SUBDIV_16: 3,
  SUBDIV_32: 4,
} as const;

/** Each probe generation mode by its integer, spelled as its constant without `GENERATE_PROBES_`. */
export const LIGHTMAP_GI_GENERATE_PROBES_NAMES = enumNamesByValue(GenerateProbes);

/** `LightmapGI::EnvironmentMode` (`lightmap_gi.h:180-185`). */
const EnvironmentMode = {
  DISABLED: 0,
  SCENE: 1,
  CUSTOM_SKY: 2,
  CUSTOM_COLOR: 3,
} as const;

/** Each environment mode by its integer, spelled as its constant without `ENVIRONMENT_MODE_`. */
export const LIGHTMAP_GI_ENVIRONMENT_MODE_NAMES = enumNamesByValue(EnvironmentMode);

/** `LightmapGI::ShadowmaskMode` (`lightmap_gi.h:46-51`). */
export const ShadowmaskMode = {
  NONE: 0,
  REPLACE: 1,
  OVERLAY: 2,
  ONLY: 3,
} as const;

/**
 * Each shadowmask mode the hint offers by its integer, spelled as its constant without
 * `SHADOWMASK_MODE_`. The hint at `lightmap_gi.cpp:1925` is "None,Replace,Overlay", so a scene
 * stores Only (3) only from a script, and the renderer still draws it.
 */
export const LIGHTMAP_GI_SHADOWMASK_MODE_NAMES = enumNamesByValue({
  NONE: ShadowmaskMode.NONE,
  REPLACE: ShadowmaskMode.REPLACE,
  OVERLAY: ShadowmaskMode.OVERLAY,
});

/** Layers of a directional lightmap for each slice: L0 and the three L1 bands (`scene_forward_clustered.glsl:1849-1854`). */
export const LIGHTMAP_SH_LAYERS_PER_SLICE = 4;

/** `rendering/lightmapping/lightmap_gi/use_bicubic_filter` (`rendering_server.cpp:3822`). */
export const LIGHTMAP_BICUBIC_FILTER_DEFAULT = true;

/** `LightmapGIData`'s defaults (`lightmap_gi.h:63,66`). */
export const LIGHTMAP_GI_DATA_DEFAULTS = {
  usesSphericalHarmonics: false,
  usesPackedDirectional: false,
} as const;

/** `LightmapGIData::_set_user_data` reads each user as four elements (`lightmap_gi.cpp:83-89`). */
export const LIGHTMAP_USER_FIELDS = 4;

/** The fields `LightmapGIData::_set_probe_data` requires before it sets anything (`lightmap_gi.cpp:275-281`). */
export const LIGHTMAP_PROBE_DATA_FIELDS = [
  'bounds',
  'points',
  'tetrahedra',
  'bsp',
  'sh',
  'interior',
  'baked_exposure',
] as const;

/**
 * A user's sub-instance when it means the node itself. A sub-instance from 0 names one of the
 * node's baked meshes, which LightmapGI asks the node for (`lightmap_gi.cpp:1544-1555`).
 */
export const LIGHTMAP_NODE_ITSELF = -1;
