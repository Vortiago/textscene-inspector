/**
 * Gives a loaded glTF the lightmap UV2 Godot's importer unwrapped for it (ADR-0028). Godot keys
 * each unwrap in the **Unwrap cache** by the MD5 of its input, so each mesh the sidecar unwraps
 * rebuilds its input, looks the hash up and, on a match, takes the cached layout as `uv1`.
 */

import type * as THREE from 'three';
import type { GLTF, GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import {
  GLTF_MODE_TRIANGLE_FAN,
  GLTF_MODE_TRIANGLES,
  godotSurfacePrimitives,
  gltfObjects,
  targetCount,
  type GltfJsonObject,
} from '../../../../godot/gltf';
import { meshSurfaces } from '../godotPrimitives';
import {
  IDENTITY_BASIS,
  gltfNodeBasis,
  rowScaledBasis,
  transformChainScale,
  type Basis32,
  type GltfNodeTransform,
} from '../../../../godot/importerBasis';
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
 * Gives each mesh under `root` that Godot unwraps its cached UV2. `gltf` is the loaded file, and
 * `meshIds` holds each glTF mesh's import id.
 */
export async function applyLightmapUv(
  gltf: GLTF,
  root: THREE.Object3D,
  lightmapUv: LightmapUvImport,
  meshIds: readonly string[]
): Promise<void> {
  const entries = readEntries(lightmapUv);
  const rebuiltMeshes = new Map<number, RebuiltPrimitives>();
  for (const [mesh, node] of firstMeshNodes(root, gltf.parser.associations)) {
    const meshId = meshIds[mesh] ?? '';
    if (!lightmapUv.unwrap.unwraps(meshId)) continue;
    const surfaces = await unwrappableSurfaces(gltf, mesh);
    if (!surfaces) continue;
    const rebuilt = rebuiltSurfaces(
      surfaces.geometries,
      placement(gltf, root, node, lightmapUv.rootScale),
      entries,
      meshId,
      lightmapUv
    );
    if (rebuilt)
      rebuiltMeshes.set(mesh, new Map(surfaces.primitives.map((primitive, i) => [primitive, rebuilt[i]!])));
  }
  if (rebuiltMeshes.size > 0) replaceSurfaces(root, gltf.parser.associations, rebuiltMeshes);
}

function isReadAsList(primitive: GltfJsonObject): boolean {
  const mode = primitive['mode'] ?? GLTF_MODE_TRIANGLES;
  return mode === GLTF_MODE_TRIANGLES || mode === GLTF_MODE_TRIANGLE_FAN;
}

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

/** The surfaces Godot's importer keeps of a glTF mesh: each primitive's index and geometry. */
interface KeptSurfaces {
  primitives: number[];
  geometries: THREE.BufferGeometry[];
}

/**
 * The surfaces of glTF mesh `mesh` that Godot unwraps, or null when it unwraps none: a mesh with
 * blend shapes (`importer_mesh.cpp:1041`) or a primitive that is not read as a triangle list
 * (`:1064`). A fan is one, as `readFansAsLists` has read it.
 */
async function unwrappableSurfaces(gltf: GLTF, mesh: number): Promise<KeptSurfaces | null> {
  const primitives = gltfObjects(gltfObjects(gltf.parser.json['meshes'])[mesh]?.['primitives']);
  if (targetCount(primitives[0]) > 0) return null;
  if (!primitives.every(isReadAsList)) return null;

  const geometries = await meshSurfaces(gltf, mesh);
  const kept = godotSurfacePrimitives(primitives);
  return { primitives: kept, geometries: kept.map((primitive) => geometries.get(primitive)!) };
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
): (THREE.BufferGeometry | null)[] | null {
  const input = unwrapInput(surfaces, where, unwrap.texelSize);
  if (!input) {
    logger.info(
      `[GLBProcessor] ${path}: mesh '${meshId}' has a surface without normals, so it keeps the GLB's own UV2`
    );
    return null;
  }
  const entry = entries.get(input.hash);
  if (!entry) {
    // Godot would unwrap it afresh with xatlas, whose layout the previewer cannot reproduce.
    logger.info(
      `[GLBProcessor] ${path}: the unwrap cache has no entry for mesh '${meshId}', so it keeps the GLB's own UV2`
    );
    return null;
  }
  try {
    return rebuildSurfaces(surfaces, input, entry);
  } catch (error) {
    logger.warn(
      `[GLBProcessor] ${path}: ${(error as Error).message}; mesh '${meshId}' keeps the GLB's own UV2`
    );
    return null;
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
