/**
 * Factory for the ArrayMesh resource processor — fetches a Godot ArrayMesh
 * `.tres` (format=4) through the FileEventBus and decodes it into geometry +
 * per-surface material paths on the 'arraymesh' bus slot. Unlike GLB meshes
 * (THREE.Object3D, single-parent → cloned per consumer), a BufferGeometry is
 * shared by identity; consumers wrap it in their own <mesh> and resolve the
 * material paths through the StandardMaterial3D pipeline.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { decodeArrayMesh } from '../meshes/arrayMeshDecode';
import { buildArrayMeshGeometry } from '../meshes/arrayMeshGeometry';

/** Decoded ArrayMesh: merged geometry plus one material path per surface (group). */
export interface ArrayMeshResource {
  geometry: THREE.BufferGeometry;
  /** `materialPaths[i]` is the res:// material for draw group `i` (null = none). */
  materialPaths: (string | null)[];
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
      };
    },
    dispose: (resource) => resource.geometry.dispose(),
  });
}
