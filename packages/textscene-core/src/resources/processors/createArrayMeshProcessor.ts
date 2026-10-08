/**
 * The ArrayMesh processor: the section a path addresses in a cached `.tres` parse
 * (format=4) into geometry and material paths on the 'arraymesh' slot. Unlike a GLB Object3D, a
 * BufferGeometry is shared by identity: each consumer wraps it in its own <mesh>
 * and resolves the material paths through the StandardMaterial3D pipeline.
 */

import * as THREE from 'three';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { ARRAY_MESH_TYPES, decodeArrayMesh } from '../meshes/arraymesh/decode';
import { buildArrayMeshGeometry } from '../meshes/arraymesh/build';
import type { SectionLoaderFn } from '../resourceSection';
import { arrayMeshAabb } from '../meshes/arraymesh/meshAabb';
import type { Aabb } from '../../godot/aabb';

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
  /** The mesh's box as the rendering server holds it, which a multimesh box reads. */
  aabb: Aabb;
}

export function createArrayMeshProcessor(
  eventBus: ResourceEventBus,
  loadSection: SectionLoaderFn
): ResourceProcessor<ArrayMeshResource> {
  return createResourceProcessor({
    eventBus,
    resourceType: 'arraymesh',
    addressesSubResources: true,
    loadDirectly: async (path) => {
      const section = await loadSection(path, ARRAY_MESH_TYPES);
      const mesh = decodeArrayMesh(section, path);
      return {
        geometry: buildArrayMeshGeometry(mesh),
        materialPaths: mesh.surfaces.map((s) => s.materialPath ?? null),
        surfaceIndices: mesh.surfaces.map((s) => s.surfaceIndex),
        aabb: arrayMeshAabb(section.properties),
      };
    },
    dispose: (resource) => resource.geometry.dispose(),
  });
}
