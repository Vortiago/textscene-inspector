/** LightmapGI types. Godot's LightmapGI lights the instances its baked data names from the bake's atlas. */

import type { EnumValue } from '../../../godot/classdb/enumNames';
import type { ShadowmaskMode } from '../../../godot/scene/lightmapGi';
import type { Node3DProperties } from '../../base/node3d/types';

export interface LightmapGIProperties extends Node3DProperties {
  /** The `light_data` reference to a LightmapGIData, as written. */
  lightData?: string;
  /** How the bake's shadowmask meets a sun's real-time shadow (`lightmap_gi.h:206`). */
  shadowmaskMode: EnumValue<typeof ShadowmaskMode>;
}
