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

/**
 * `LightmapGI::ShadowmaskMode` (`lightmap_gi.h:46-51`) also declares `ONLY = 3`, but the hint at
 * `lightmap_gi.cpp:1925` offers "None,Replace,Overlay", so the table stops at 2.
 */
const ShadowmaskMode = {
  NONE: 0,
  REPLACE: 1,
  OVERLAY: 2,
} as const;

/** Each shadowmask mode the hint offers by its integer, spelled as its constant without `SHADOWMASK_MODE_`. */
export const LIGHTMAP_GI_SHADOWMASK_MODE_NAMES = enumNamesByValue(ShadowmaskMode);
