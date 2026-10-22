/**
 * Gives a loaded glTF the lightmap UV2 Godot's importer unwrapped for it (ADR-0028). Godot keys
 * each unwrap in the **Unwrap cache** by the MD5 of its input, so each mesh the sidecar unwraps
 * rebuilds its input, looks the hash up and, on a match, takes the cached layout as its UV2.
 */

import type * as THREE from 'three';
import type { GLTF, GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import { GLTF_MODE_TRIANGLES, gltfObjects, targetCount } from '../../../../godot/import/gltf';
import { meshSurfaces } from '../godotPrimitives';
import { markReadsNoLightmap } from '../meshInstances';
import {
  IDENTITY_BASIS,
  gltfNodeBasis,
  rowScaledBasis,
  transformChainScale,
  type Basis32,
  type GltfNodeTransform,
} from '../../../../godot/import/importerBasis';
import type { LightmapUnwrap } from '../../../../parser/importParser';
import type { RootScale } from '../types';
import { parseUnwrapCache, type UnwrapCacheEntry } from './unwrapCache';
import { unwrapInput, type UnwrapPlacement } from './unwrapInput';
import { rebuildSurfaces } from './rebuild';
import * as logger from '../../../../logger';

/** What the asset's import says about its lightmap UV2. */
export interface LightmapUvImport {
  unwrap: LightmapUnwrap;
  /** The **Unwrap cache**'s bytes, or null when the asset has none. */
  cache: ArrayBuffer | null;
  rootScale: RootScale | null;
  /** The asset's path, which log lines name. */
  path: string;
}

/**
 * Gives each mesh under `root` that Godot unwraps its cached UV2, and marks a mesh whose unwrap
 * the cache cannot rebuild as reading no lightmap. `gltf` is the loaded file, and `meshIds` holds
 * each glTF mesh's import id.
 */
export async function applyLightmapUv(
  gltf: GLTF,
  root: THREE.Object3D,
  lightmapUv: LightmapUvImport,
  meshIds: readonly string[]
): Promise<void> {
  const entries = readEntries(lightmapUv);
  const rebuiltMeshes = new Map<number, RebuiltPrimitives>();
  const unrebuiltMeshes = new Set<number>();
  for (const [mesh, node] of firstMeshNodes(root, gltf.parser.associations)) {
    const meshId = meshIds[mesh] ?? '';
    if (!lightmapUv.unwrap.unwraps(meshId)) continue;
    const surfaces = await unwrappableSurfaces(gltf, mesh);
    if (!surfaces) continue;
    const rebuild = rebuiltSurfaces(
      [...surfaces.values()],
      placement(gltf, root, node, lightmapUv.rootScale),
      entries,
      meshId,
      lightmapUv
    );
    if (rebuild === UNREBUILT) unrebuiltMeshes.add(mesh);
    else if (rebuild)
      rebuiltMeshes.set(mesh, new Map([...surfaces.keys()].map((primitive, i) => [primitive, rebuild[i]!])));
  }
  if (rebuiltMeshes.size > 0) replaceSurfaces(root, gltf.parser.associations, rebuiltMeshes);
  if (unrebuiltMeshes.size > 0) markUnrebuiltMeshes(root, gltf.parser.associations, unrebuiltMeshes);
}

/**
 * What `rebuiltSurfaces` returns for a mesh Godot unwraps and the cache cannot rebuild. Godot
 * would unwrap it afresh with xatlas (`xatlas_unwrap/register_types.cpp:138`), which the previewer
 * does not run: a fresh unwrap of `zdm2.glb` gives 91265 vertices against the cache's 91276
 * (ADR-0028). A mesh with no unwrap input is `null`: Godot does not unwrap it.
 */
const UNREBUILT = Symbol('unrebuilt');

/** Each kept primitive's rebuilt geometry, or null for one the unwrapped mesh drops. */
type RebuiltPrimitives = ReadonlyMap<number, THREE.BufferGeometry | null>;

/** The cache's entries by hash: none for a missing or unreadable cache. */
function readEntries({ cache, path }: LightmapUvImport): ReadonlyMap<string, UnwrapCacheEntry> {
  if (!cache) return new Map();
  try {
    return new Map(parseUnwrapCache(cache).map((entry) => [entry.hash, entry]));
  } catch (error) {
    logger.warn(`[GLBProcessor] ${path}: ${(error as Error).message}; no mesh takes a lightmap UV2 from it`);
    return new Map();
  }
}

/**
 * Each glTF mesh with the first node that holds it, in the importer's depth-first order: a mesh
 * several nodes share is unwrapped once, in the first node's place (`resource_importer_scene.cpp:2616`).
 * The mesh of a `GODOT_single_root` file's root node stays out: `generate_scene` converts that
 * root to a `MeshInstance3D` before the importer unwraps (`gltf_document.cpp:7074-7077`).
 */
function firstMeshNodes(
  root: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>
): Map<number, THREE.Object3D> {
  const firstNodes = new Map<number, THREE.Object3D>();
  root.traverse((object) => {
    const { meshes } = associations.get(object) ?? {};
    if (meshes === undefined || firstNodes.has(meshes)) return;
    const node = meshNode(object, associations);
    if (node) firstNodes.set(meshes, node);
  });
  for (const [mesh, node] of firstNodes) if (node === root) firstNodes.delete(mesh);
  return firstNodes;
}

/**
 * The node that holds a mesh object: the object itself, or its parent when the glTF node also
 * holds a camera or a light, which GLTFLoader groups with the mesh.
 */
function meshNode(
  object: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>
): THREE.Object3D | null {
  if (associations.get(object)?.nodes !== undefined) return object;
  const parent = object.parent;
  return parent && associations.get(parent)?.nodes !== undefined ? parent : null;
}

/**
 * The surfaces of glTF mesh `mesh` that Godot unwraps, by primitive index, or null when it unwraps
 * none: a mesh with blend shapes (`importer_mesh.cpp:1041`) or a primitive that is not a triangle
 * list (`:1064`). `godotPrimitives` has already read each fan as a list.
 */
async function unwrappableSurfaces(
  gltf: GLTF,
  mesh: number
): Promise<ReadonlyMap<number, THREE.BufferGeometry> | null> {
  const primitives = gltfObjects(gltfObjects(gltf.parser.json['meshes'])[mesh]?.['primitives']);
  if (targetCount(primitives[0]) > 0) return null;
  if (!primitives.every((primitive) => (primitive['mode'] ?? GLTF_MODE_TRIANGLES) === GLTF_MODE_TRIANGLES))
    return null;
  return meshSurfaces(gltf, mesh);
}

/**
 * The scale of the node's transform chain up to the scene root, and the root scale the importer
 * bakes into the vertices instead (`resource_importer_scene.cpp:3154-3170`).
 */
function placement(
  gltf: GLTF,
  root: THREE.Object3D,
  node: THREE.Object3D,
  rootScale: RootScale | null
): UnwrapPlacement {
  const nodes = gltfObjects(gltf.parser.json['nodes']) as GltfNodeTransform[];
  const chain: Basis32[] = [];
  for (let object: THREE.Object3D | null = node; object; object = object === root ? null : object.parent) {
    const index = gltf.parser.associations.get(object)?.nodes;
    if (index !== undefined) chain.push(gltfNodeBasis(nodes[index] ?? {}));
  }
  if (rootScale && !rootScale.bake) {
    // `Node3D::scale` on the scene root: a `GODOT_single_root` file's root is its node 0, which
    // ends the chain, and any other file's root is a node of its own.
    const rootIsNode = gltf.parser.associations.get(root)?.nodes !== undefined;
    const { scale } = rootScale;
    chain.push(rowScaledBasis(rootIsNode ? chain.pop()! : IDENTITY_BASIS, [scale, scale, scale]));
  }
  return { scale: transformChainScale(chain), vertexScale: rootScale?.bake ? rootScale.scale : 1 };
}

function rebuiltSurfaces(
  surfaces: THREE.BufferGeometry[],
  where: UnwrapPlacement,
  entries: ReadonlyMap<string, UnwrapCacheEntry>,
  meshId: string,
  { unwrap, path }: LightmapUvImport
): (THREE.BufferGeometry | null)[] | typeof UNREBUILT | null {
  const input = unwrapInput(surfaces, where, unwrap.texelSize);
  if (!input) {
    logger.info(
      `[GLBProcessor] ${path}: mesh '${meshId}' has a surface without normals, so it keeps the GLB's own UV2`
    );
    return null;
  }
  const entry = entries.get(input.hash);
  if (!entry) {
    logger.info(
      `[GLBProcessor] ${path}: the unwrap cache has no entry for mesh '${meshId}', so it reads no lightmap`
    );
    return UNREBUILT;
  }
  try {
    return rebuildSurfaces(surfaces, input, entry);
  } catch (error) {
    logger.warn(`[GLBProcessor] ${path}: ${(error as Error).message}; mesh '${meshId}' reads no lightmap`);
    return UNREBUILT;
  }
}

/**
 * Puts each rebuilt surface on every object that draws that primitive, the node clones included,
 * and removes the objects of a surface the rebuild dropped. `rebuiltMeshes` maps a glTF mesh to
 * its rebuilt surfaces.
 */
function replaceSurfaces(
  root: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>,
  rebuiltMeshes: ReadonlyMap<number, RebuiltPrimitives>
): void {
  const replaced = new Set<THREE.BufferGeometry>();
  const dropped: THREE.Object3D[] = [];
  root.traverse((object) => {
    const { meshes, primitives } = associations.get(object) ?? {};
    const rebuilt = meshes === undefined ? undefined : rebuiltMeshes.get(meshes);
    if (!rebuilt || primitives === undefined || !rebuilt.has(primitives)) return;
    const surface = object as THREE.Mesh;
    replaced.add(surface.geometry);
    const geometry = rebuilt.get(primitives);
    if (geometry) surface.geometry = geometry;
    else dropped.push(surface);
  });
  for (const surface of dropped) surface.removeFromParent();
  // GLTFLoader shares one geometry between meshes with the same accessors, so keep one still drawn.
  root.traverse((object) => replaced.delete((object as THREE.Mesh).geometry));
  for (const geometry of replaced) geometry.dispose();
}

/** Marks every object that draws a glTF mesh of `meshes` as reading no lightmap. */
function markUnrebuiltMeshes(
  root: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>,
  meshes: ReadonlySet<number>
): void {
  root.traverse((object) => {
    const mesh = associations.get(object)?.meshes;
    if (mesh !== undefined && meshes.has(mesh)) markReadsNoLightmap(object);
  });
}
