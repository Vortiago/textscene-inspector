/** A LightmapGIData resource as the renderer reads it (`scene/3d/lightmap_gi.h:45-129`). */

import type { Rect2Value } from '../../parser/valueParsers';

/** One baked instance (`LightmapGIData::User`, `lightmap_gi.h:53-58`). */
export interface LightmapUser {
  /** The node's path, relative to the LightmapGI that holds the data. */
  path: string;
  /** Where the instance's UV2 lands in its slice: `uv2 * size + position`. */
  uvScale: Rect2Value;
  /** The atlas layer the instance samples, before the spherical-harmonics stride. */
  sliceIndex: number;
  /** The mesh of a GridMap or a MultiMesh the user means, or -1 for the node's own mesh. */
  subInstance: number;
}

export interface LightmapGIData {
  /** The `res://` path of each TextureLayered whose layers make the atlas, in order. */
  lightmapTextures: readonly string[];
  /** Whether each slice holds four layers of directional light (`lightmap_gi.cpp:1843-1868`). */
  usesSphericalHarmonics: boolean;
  /** The users a LightmapGI assigns the data to. */
  users: readonly LightmapUser[];
}
