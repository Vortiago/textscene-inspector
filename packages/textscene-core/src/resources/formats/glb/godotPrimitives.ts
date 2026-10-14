/**
 * Reads a glTF's primitives as Godot's importer does, before three builds them: a triangle fan
 * draws its indices as a triangle list, a list Godot refuses fails the load, and a surface
 * `ImporterMesh::add_surface` refuses is left out. Each primitive index three records is then
 * Godot's surface index.
 */

import type * as THREE from 'three';
import type { GLTF, GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import {
  GLTF_MODE_TRIANGLE_FAN,
  GLTF_MODE_TRIANGLES,
  godotSurfacePrimitives,
  gltfObjects,
  type GltfJsonObject,
} from '../../../godot/gltf';
import * as logger from '../../../logger';

/** A GLTFLoader plugin that rewrites each mesh's primitives in `parser.json` before the parse. */
export function godotPrimitives(parser: GLTFParser): GLTFLoaderPlugin {
  return {
    name: 'textscene_godot_primitives',
    beforeRoot: async () => {
      const accessors = gltfObjects(parser.json['accessors']);
      for (const [mesh, json] of gltfObjects(parser.json['meshes']).entries()) {
        // Godot reads every primitive before `add_surface` refuses one, so a refused one fails too.
        const primitives = gltfObjects(json['primitives']).map((primitive, index) =>
          readAsGodot(primitive, accessors, `${mesh} surface ${index}`)
        );
        const kept = godotSurfacePrimitives(primitives);
        if (kept.length < primitives.length) logRefused(json, mesh);
        json['primitives'] = kept.map((index) => primitives[index]!);
      }
    },
  };
}

function logRefused(mesh: GltfJsonObject, index: number): void {
  const name = typeof mesh['name'] === 'string' ? mesh['name'] : `mesh ${index}`;
  logger.info(
    `[GLBProcessor] '${name}' has a surface with another target count than its first, so Godot drops it`
  );
}

/**
 * The primitive as Godot reads it: a fan's indices, or its vertices in order, as a triangle list
 * (`gltf_document.cpp:1462`, `:1700-1714`). A list whose count is no multiple of three fails
 * Godot's whole import (`:1487`, `:1705`), so it fails the load too.
 */
function readAsGodot(
  primitive: GltfJsonObject,
  accessors: readonly GltfJsonObject[],
  label: string
): GltfJsonObject {
  const mode = primitive['mode'] ?? GLTF_MODE_TRIANGLES;
  if (mode !== GLTF_MODE_TRIANGLES && mode !== GLTF_MODE_TRIANGLE_FAN) return primitive;
  const count = listedCount(primitive, accessors);
  if (count % 3 !== 0)
    throw new Error(
      `glTF: mesh ${label} lists ${count} triangle indices, not a multiple of 3, so Godot refuses it`
    );
  return mode === GLTF_MODE_TRIANGLE_FAN ? { ...primitive, mode: GLTF_MODE_TRIANGLES } : primitive;
}

/** How many indices the primitive lists: its index accessor's count, else its vertex count. */
function listedCount(primitive: GltfJsonObject, accessors: readonly GltfJsonObject[]): number {
  const attributes = primitive['attributes'] as GltfJsonObject | undefined;
  const accessor = typeof primitive['indices'] === 'number' ? primitive['indices'] : attributes?.['POSITION'];
  const count = typeof accessor === 'number' ? accessors[accessor]?.['count'] : undefined;
  return typeof count === 'number' ? count : 0;
}

/** The geometry three built for each primitive of glTF mesh `mesh`, by primitive index. */
export async function meshSurfaces(gltf: GLTF, mesh: number): Promise<Map<number, THREE.BufferGeometry>> {
  const object = (await gltf.parser.getDependency('mesh', mesh)) as THREE.Object3D;
  const drawn = (object as THREE.Mesh).isMesh ? [object] : object.children;
  const surfaces = new Map<number, THREE.BufferGeometry>();
  for (const surface of drawn) {
    const primitive = gltf.parser.associations.get(surface)?.primitives;
    if (primitive !== undefined) surfaces.set(primitive, (surface as THREE.Mesh).geometry);
  }
  return surfaces;
}
