/**
 * Factory for creating GLB mesh processors, the GLB slice's loader-facing
 * adapter (`resources/formats/glb/`, ADR-0031). Stays here because the
 * `ResourceLoader` constructs it alongside its peer factories.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { createGLBMesh, forEachSurfaceMaterial, tagImportMaterial } from '../formats/glb/glbProcessing';
import { isGltfPath } from '../../godot/import/gltf';
import { gltfResourcePath, selfContainedGlb } from '../formats/glb/gltfResources';
import { applyRootScale } from '../formats/glb/rootScale';
import { stampMeshInstanceLayers } from '../formats/glb/meshInstances';
import type { GltfExtensionRules } from '../formats/glb/types';
import { flattenGlbObjects } from '../../r3f/internal/glb-scene-root/glbHierarchy';
import { matchGlbTarget } from '../../r3f/internal/glb-scene-root/matchGlbTarget';
import {
  importExternalMaterials,
  importGltfNaming,
  importLightmapUnwrap,
  importNodeLayers,
  importRootScale,
  parseImportFile,
  type ParsedImportFile,
} from '../../parser/importParser';
import { importSidecarPath, unwrapCachePath } from '../../godot/index.js';
import type { LightmapUvImport } from '../formats/glb/lightmapUv/lightmapUv';
import { fileBaseName } from '../../godot/string/string.js';
import type { DependencyGraph } from '../dependencyGraph';
import * as logger from '../../logger';

/**
 * Dispose of a GLB mesh and all its resources. Unlike a per-consumer clone
 * (whose geometry is shared with this template, see
 * `disposeClonedMaterials`), the template owns its geometry too.
 */
function disposeGLBMesh(mesh: THREE.Object3D): void {
  // Materials through the same slot-gated walker the sidecar writes through, so a
  // surface it can reach is a surface this can free.
  forEachSurfaceMaterial(mesh, (material) => material.dispose());
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) node.geometry?.dispose();
  });
}

/**
 * The glTF at `path` as a GLB that carries its external buffers and images: each is read
 * through the byte layer and recorded, so editing it reloads the glTF.
 */
function glbBytes(
  path: string,
  data: ArrayBuffer,
  fileEventBus: FileEventBus | undefined,
  dependencies: DependencyGraph
): Promise<ArrayBuffer> {
  return selfContainedGlb(data, async (uri) => {
    const resourcePath = gltfResourcePath(path, uri);
    if (resourcePath === null) {
      throw new Error(`glTF ${path} needs ${uri}, which climbs above res://`);
    }
    dependencies.record({ busType: 'glb', key: path }, resourcePath);
    const bytes = await fileEventBus?.tryLoad(resourcePath, 'GltfResource');
    if (!(bytes instanceof ArrayBuffer)) {
      throw new Error(`glTF ${path} needs ${resourcePath}, which did not load as bytes`);
    }
    // The packed GLB holds the bytes now. A file a processor is also loading keeps them.
    if (!fileEventBus!.isLoading(resourcePath)) fileEventBus!.clearCache(resourcePath);
    return bytes;
  });
}

/**
 * The asset's **Import sidecar** (ADR-0028), or null when it has none. A sidecar is found by
 * convention (`scene.gltf.import`), so `tryLoad`: absent means import defaults, not a
 * **Missing resource**.
 */
async function readImportSidecar(
  path: string,
  fileEventBus: FileEventBus | undefined,
  dependencies: DependencyGraph
): Promise<ParsedImportFile | null> {
  if (!fileEventBus) return null;

  const sidecar = importSidecarPath(path);
  // Recorded before the read, so a sidecar created, edited or deleted later reloads the asset.
  dependencies.record({ busType: 'glb', key: path }, sidecar);
  const raw = await fileEventBus.tryLoad(sidecar, 'ImportSidecar');
  return typeof raw === 'string' ? parseImportFile(raw) : null;
}

/**
 * The lightmap UV2 the sidecar asks for, with the asset's **Unwrap cache**, or undefined when it
 * unwraps no mesh. Only then is the cache read: it is found by convention, and absent is ordinary.
 */
async function readLightmapUv(
  path: string,
  sidecar: ParsedImportFile | null,
  fileEventBus: FileEventBus | undefined,
  dependencies: DependencyGraph
): Promise<LightmapUvImport | undefined> {
  const unwrap = importLightmapUnwrap(sidecar);
  if (!unwrap || !fileEventBus) return undefined;

  const cachePath = unwrapCachePath(path);
  dependencies.record({ busType: 'glb', key: path }, cachePath);
  const cache = await fileEventBus.tryLoad(cachePath, 'UnwrapCache');
  // The rebuilt meshes hold what they need, so the bus need not keep the bytes, unless a
  // processor is also loading the file.
  if (cache !== null && !fileEventBus.isLoading(cachePath)) fileEventBus.clearCache(cachePath);
  return {
    unwrap,
    cache: cache instanceof ArrayBuffer ? cache : null,
    rootScale: importRootScale(sidecar),
    path,
  };
}

/**
 * Correct a loaded asset by its sidecar, once per path on the cached template, so render, bounds,
 * selection and the tree see one object. Godot's importer too writes each correction into the asset.
 */
function applyImportSidecar(object: THREE.Object3D, path: string, parsed: ParsedImportFile | null): void {
  if (!parsed) return;
  applySidecarRootScale(object, path, parsed);
  applySidecarNodeLayers(object, path, parsed);
  tagSidecarMaterials(object, path, parsed);
}

/** `nodes/root_scale`, applied to the asset the way `nodes/apply_root_scale` asks. */
function applySidecarRootScale(object: THREE.Object3D, path: string, parsed: ParsedImportFile): void {
  const rootScale = importRootScale(parsed);
  if (!rootScale) return;

  logger.info(
    `[GLBProcessor] ${path}: import sidecar root_scale ${rootScale.scale} ` +
      `(${rootScale.bake ? 'baked into the asset' : 'on the root node'})`
  );
  applyRootScale(object, rootScale);
}

/**
 * `_subresources`' per-node `mesh_instance/layers`, matched by node path
 * (`resource_importer_scene.cpp:1836`) through `matchGlbTarget`. No nearest-ancestor fallback:
 * a mask belongs to one mesh instance, and an ancestor would stamp every sibling under it.
 */
function applySidecarNodeLayers(object: THREE.Object3D, path: string, parsed: ParsedImportFile): void {
  const masks = importNodeLayers(parsed);
  if (masks.size === 0) return;

  const entries = flattenGlbObjects(object);
  for (const [nodePath, mask] of masks) {
    const target = matchGlbTarget(entries, nodePath, { allowAncestor: false });
    if (!target) {
      logger.warn(`[GLBProcessor] ${path}: import sidecar layers path '${nodePath}' names no mesh`);
      continue;
    }
    logger.info(`[GLBProcessor] ${path}: import sidecar layers ${mask} on '${nodePath}'`);
    stampMeshInstanceLayers(target.object, mask);
  }
}

/**
 * `_subresources`' external materials, matched to surfaces by glTF material name:
 * Godot's `mat->get_meta("import_id", mat->get_name())` key
 * (`editor/import/3d/resource_importer_scene.cpp:1583`). Each matched surface is tagged
 * with its `.tres` address and keeps the glTF's own material, which an unresolvable
 * `.tres` leaves in place, as Godot's null `external_mat` branch does (`:1622-1636`).
 */
function tagSidecarMaterials(object: THREE.Object3D, path: string, parsed: ParsedImportFile): void {
  const remaps = importExternalMaterials(parsed);
  if (remaps.size === 0) return;

  const tagged = new Map<string, string>();
  forEachSurfaceMaterial(object, (material) => {
    const external = remaps.get(material.name);
    if (external === undefined) return;
    tagImportMaterial(material, external);
    tagged.set(material.name, external);
  });
  if (tagged.size === 0) return;
  logger.info(
    `[GLBProcessor] ${path}: import sidecar external materials ` +
      [...tagged].map(([name, external]) => `${name} -> ${external}`).join(', ')
  );
}

/**
 * Create a GLB mesh processor that handles loading and caching GLB/GLTF meshes.
 */
export function createGLBProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  /** Records the asset's read of its sidecar, so a sidecar edit reloads the asset. */
  dependencies: DependencyGraph,
  extensionRules?: GltfExtensionRules
): ResourceProcessor<THREE.Object3D> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'glb',
    readsFile: isGltfPath,
    shouldProcess: (_path, data) => data instanceof ArrayBuffer,
    process: async (path, data) => {
      const bytes = await glbBytes(path, data as ArrayBuffer, fileEventBus, dependencies);
      const sidecar = await readImportSidecar(path, fileEventBus, dependencies);
      const object = await createGLBMesh(bytes, {
        extensionRules,
        naming: { ...importGltfNaming(sidecar), fileName: fileBaseName(path) },
        lightmapUv: await readLightmapUv(path, sidecar, fileEventBus, dependencies),
      });
      applyImportSidecar(object, path, sidecar);
      return object;
    },
    dispose: disposeGLBMesh,
  });
}
