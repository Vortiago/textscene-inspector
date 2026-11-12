/**
 * The lightmap of one instance: the LightmapGI that names it sets it on the instance
 * (`lightmap_gi.cpp:1544-1552`), not on a surface. Both draw adapters read it here, a node drawn in
 * React through its GeometryInstance3D base and a mesh of a GLB clone through its cull instance.
 */

import type * as THREE from 'three';
import { LIGHTMAP_NODE_ITSELF } from '../../godot/scene/lightmapGi';
import { lightmapsOf, type LightmapAssignment } from './sceneLightmaps';

/** Which lightmap reaches one instance, live as the LightmapGIs of its scene change. */
export interface InstanceLightmap {
  /** Null while no LightmapGI names the instance. One object until the LightmapGIs change. */
  read(): LightmapAssignment | null;
  /** Calls `onChange` at each change of the scene's LightmapGIs, until the returned function runs. */
  subscribe(onChange: () => void): () => void;
}

/**
 * The lightmap of the instance of the node at `path`, or of its baked mesh `subInstance`. A null
 * path is an instance no LightmapGI can name.
 *
 * @canonical The lightmap of one instance
 */
export function instanceLightmap(
  scene: THREE.Scene,
  path: string | null,
  subInstance: number = LIGHTMAP_NODE_ITSELF
): InstanceLightmap {
  const lightmaps = lightmapsOf(scene);
  return {
    read: () => (path === null ? null : lightmaps.assignmentFor(path, subInstance)),
    subscribe: (onChange) => lightmaps.subscribe(onChange),
  };
}
