/** LightmapGI types. Godot's LightmapGI lights the instances its baked data names from the bake's atlas. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface LightmapGIProperties extends Node3DProperties {
  /** The `light_data` reference to a LightmapGIData, as written. */
  lightData?: string;
}
