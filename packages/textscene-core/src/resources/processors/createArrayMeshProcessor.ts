/**
 * The ArrayMesh processor: a `.tres` (format=4) through the FileEventBus into
 * geometry and material paths on the 'arraymesh' slot. Unlike a GLB Object3D, a
 * BufferGeometry is shared by identity: each consumer wraps it in its own <mesh>
 * and resolves the material paths through the StandardMaterial3D pipeline.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { decodeArrayMesh } from '../meshes/arraymesh/decode';
import { buildArrayMeshGeometry } from '../meshes/arraymesh/build';

/** Decoded ArrayMesh: merged geometry plus one material path per surface (group). */
export interface ArrayMeshResource {
  geometry: THREE.BufferGeometry;
  /** `materialPaths[i]` is the res:// material for draw group `i` (null = none). */
  materialPaths: (string | null)[];
  /**
   * `surfaceIndices[i]` is draw group `i`'s index in the mesh's `_surfaces`.
   * Equal to `i` unless an undecodable surface was dropped, and it is the index
   * `surface_material_override/N` addresses.
   */
  surfaceIndices: number[];
}

export function createArrayMeshProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
): ResourceProcessor<ArrayMeshResource> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'arraymesh',
    shouldProcess: (path, data) => path.endsWith('.tres') && typeof data === 'string',
    addressesSubResources: true,
    process: async (path, data) => {
      const mesh = decodeArrayMesh(data as string, path);
      return {
        geometry: buildArrayMeshGeometry(mesh),
        materialPaths: mesh.surfaces.map((s) => s.materialPath ?? null),
        surfaceIndices: mesh.surfaces.map((s) => s.surfaceIndex),
      };
    },
    dispose: (resource) => resource.geometry.dispose(),
  });
}
