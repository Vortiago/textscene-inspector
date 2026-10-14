/**
 * Corrects three's reading of a glTF's primitives to Godot's importer: a triangle fan draws its
 * indices as a triangle list, and a surface `ImporterMesh::add_surface` refuses is left out.
 */

import type * as THREE from 'three';
import type { GLTF, GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import { GLTF_MODE_TRIANGLE_FAN, godotSurfacePrimitives, gltfObjects } from '../../../godot/gltf';
import * as logger from '../../../logger';

/**
 * The geometry three built for each primitive of glTF mesh `mesh`, by primitive index. A primitive
 * whose surface `removeRefusedSurfaces` took out has none.
 */
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

/**
 * Gives each triangle fan of the parsed `gltf` the triangles Godot reads from it, where three
 * builds a fan. A fan whose index count is no multiple of three fails Godot's whole import
 * (`gltf_document.cpp:1485`, `:1705`), so it keeps three's triangles and a warning.
 */
export async function readFansAsLists(gltf: GLTF): Promise<void> {
  const meshes = gltfObjects(gltf.parser.json['meshes']);
  for (const [mesh, json] of meshes.entries()) {
    const primitives = gltfObjects(json['primitives']);
    if (!primitives.some((primitive) => primitive['mode'] === GLTF_MODE_TRIANGLE_FAN)) continue;
    const surfaces = await meshSurfaces(gltf, mesh);
    for (const [index, primitive] of primitives.entries()) {
      const geometry = surfaces.get(index);
      if (primitive['mode'] !== GLTF_MODE_TRIANGLE_FAN || !geometry) continue;
      await readFanAsList(gltf, primitive['indices'], geometry, `${mesh}/${index}`);
    }
  }
}

async function readFanAsList(
  gltf: GLTF,
  indices: unknown,
  geometry: THREE.BufferGeometry,
  primitive: string
): Promise<void> {
  const fanIndex =
    typeof indices === 'number'
      ? ((await gltf.parser.getDependency('accessor', indices)) as THREE.BufferAttribute)
      : null;
  const count = fanIndex ? fanIndex.count : geometry.getAttribute('position').count;
  if (count % 3 !== 0) {
    logger.warn(`[GLBProcessor] glTF primitive ${primitive}: a fan of ${count} indices, which Godot refuses`);
    return;
  }
  geometry.setIndex(fanIndex);
}

/** Removes each surface under `root` whose primitive Godot does not keep (`godotSurfacePrimitives`). */
export function removeRefusedSurfaces(root: THREE.Object3D, gltf: GLTF): void {
  const kept = gltfObjects(gltf.parser.json['meshes']).map(
    (mesh) => new Set(godotSurfacePrimitives(gltfObjects(mesh['primitives'])))
  );
  const refused: THREE.Object3D[] = [];
  root.traverse((object) => {
    const { meshes, primitives } = (gltf.parser.associations.get(object) ?? {}) as Partial<GLTFReference>;
    if (meshes !== undefined && primitives !== undefined && !kept[meshes]?.has(primitives))
      refused.push(object);
  });
  for (const surface of refused) {
    logger.info(`[GLBProcessor] '${surface.name}' has another target count than its mesh, so Godot drops it`);
    surface.removeFromParent();
  }
}
