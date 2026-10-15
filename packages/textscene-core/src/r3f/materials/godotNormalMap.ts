/**
 * Godot's normal map read: red and green only, with blue rebuilt as `sqrt(max(0, 1 - dot(xy, xy)))`
 * (`scene_forward_clustered.glsl:1437-1438`), since an RGTC import stores no blue. three rebuilds
 * blue the same way under `USE_PACKED_NORMALMAP`, which it defines itself only for an RG format.
 */

import type * as THREE from 'three';
import { defining, injectProgram, type ProgramInjection } from '../materialProgramInputs';

export const GODOT_NORMAL_MAP_READ: ProgramInjection = defining('USE_PACKED_NORMALMAP');

/**
 * The read a glTF material needs, which Godot imports as a StandardMaterial3D
 * (`gltf_document.cpp:2939-2940`): Godot's when it has a normal map, else none.
 */
export function importedNormalMapRead(material: THREE.Material): ProgramInjection | undefined {
  return (material as THREE.MeshStandardMaterial).normalMap ? GODOT_NORMAL_MAP_READ : undefined;
}

/**
 * Gives a copy of a glTF material its normal map read, and returns it. A copy carries no
 * `onBeforeCompile`, so each copy takes the read again.
 */
export function withImportedNormalMapRead(material: THREE.Material): THREE.Material {
  const read = importedNormalMapRead(material);
  if (read) injectProgram(material, read);
  return material;
}
