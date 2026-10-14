/**
 * Gives a loaded glTF the lightmap UV2 Godot's importer unwrapped for it (ADR-0028). Godot keys
 * each unwrap in the **Unwrap cache** by the MD5 of its input, so each mesh the sidecar unwraps
 * rebuilds its input, looks the hash up and, on a match, takes the cached layout as `uv1`.
 */

import type * as THREE from 'three';
import type { GLTF, GLTFReference } from 'three/addons/loaders/GLTFLoader.js';
import { gltfObjects } from '../../../../godot/gltf';
import { gltfMeshNames, type GltfNamingOptions } from '../../../../godot/gltfNodeNames';
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

/** `TRIANGLES`, the mode a glTF primitive without one has. */
const TRIANGLES = 4;
/** `TRIANGLE_FAN`, which Godot imports as a triangle list (`gltf_document.cpp:1462`). */
const TRIANGLE_FAN = 6;

/** Gives each mesh under `root` that Godot unwraps its cached UV2. `gltf` is the loaded file. */
export async function applyLightmapUv(
  gltf: GLTF,
  root: THREE.Object3D,
  lightmapUv: LightmapUvImport,
  naming: GltfNamingOptions
): Promise<void> {
  const entries = readEntries(lightmapUv);
  const meshIds = gltfMeshNames(gltf.parser.json, naming);
  const rebuiltMeshes = new Map<number, readonly (THREE.BufferGeometry | null)[]>();
  for (const [mesh, node] of firstMeshNodes(root, gltf.parser.associations)) {
    const meshId = meshIds[mesh] ?? '';
    if (!lightmapUv.unwrap.unwraps(meshId)) continue;
    const surfaces = await unwrappableSurfaces(gltf, mesh, meshId, lightmapUv.path);
    if (!surfaces) continue;
    const rebuilt = rebuiltSurfaces(
      surfaces,
      placement(gltf, root, node, lightmapUv.rootScale),
      entries,
      meshId,
      lightmapUv
    );
    if (rebuilt) rebuiltMeshes.set(mesh, rebuilt);
  }
  if (rebuiltMeshes.size > 0) replaceSurfaces(root, gltf.parser.associations, rebuiltMeshes);
}

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
 * The mesh of a `GODOT_single_root` file's root node stays out: Godot 4.6.3 gives it no UV2
 * (measured: no `TEX_UV2` and a zero size hint after an import at Static Lightmaps).
 */
function firstMeshNodes(
  root: THREE.Object3D,
  associations: ReadonlyMap<unknown, GLTFReference>
): Map<number, THREE.Object3D> {
  const firstNodes = new Map<number, THREE.Object3D>();
  root.traverse((object) => {
    const { meshes, nodes } = associations.get(object) ?? {};
    if (meshes !== undefined && nodes !== undefined && !firstNodes.has(meshes))
      firstNodes.set(meshes, object);
  });
  for (const [mesh, node] of firstNodes) if (node === root) firstNodes.delete(mesh);
  return firstNodes;
}

/**
 * The geometry of each primitive of glTF mesh `mesh`, or null when Godot does not unwrap it: a
 * mesh with blend shapes (`importer_mesh.cpp:1041`) or a primitive that is not a triangle list
 * (`:1064`). A triangle fan, which Godot reads as a list, is logged: its layout is not reproduced.
 */
async function unwrappableSurfaces(
  gltf: GLTF,
  mesh: number,
  meshId: string,
  path: string
): Promise<THREE.BufferGeometry[] | null> {
  const primitives = gltfObjects(gltfObjects(gltf.parser.json['meshes'])[mesh]?.['primitives']);
  if (primitives.some((primitive) => primitive['targets'] !== undefined)) return null;
  const modes = primitives.map((primitive) => primitive['mode'] ?? TRIANGLES);
  if (modes.includes(TRIANGLE_FAN)) {
    logger.info(`[GLBProcessor] ${path}: mesh '${meshId}' has a triangle fan, so it keeps the GLB's own UV2`);
    return null;
  }
  if (modes.some((mode) => mode !== TRIANGLES)) return null;

  const object = (await gltf.parser.getDependency('mesh', mesh)) as THREE.Object3D;
  const drawn = (object as THREE.Mesh).isMesh ? [object] : object.children;
  return drawn.map((primitive) => (primitive as THREE.Mesh).geometry);
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
  rebuiltMeshes: ReadonlyMap<number, readonly (THREE.BufferGeometry | null)[]>
): void {
  const replaced = new Set<THREE.BufferGeometry>();
  const dropped: THREE.Object3D[] = [];
  root.traverse((object) => {
    const { meshes, primitives } = associations.get(object) ?? {};
    const rebuilt = meshes === undefined ? undefined : rebuiltMeshes.get(meshes);
    if (!rebuilt || primitives === undefined) return;
    const surface = object as THREE.Mesh;
    replaced.add(surface.geometry);
    const geometry = rebuilt[primitives];
    if (geometry) surface.geometry = geometry;
    else dropped.push(surface);
  });
  for (const surface of dropped) surface.removeFromParent();
  for (const geometry of replaced) geometry.dispose();
}
