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
import { isGltfPath } from '../../godot/gltf';
import { gltfResourcePath, isGlbContainer, packGltfAsGlb, type GltfJson } from '../formats/glb/gltfResources';
import { applyRootScale } from '../formats/glb/rootScale';
import type { GltfExtensionRules } from '../formats/glb/types';
import { stampVisualLayers } from '../../r3f/visualLayers';
import { flattenGlbObjects } from '../../r3f/internal/glb-scene-root/glbHierarchy';
import { matchGlbTarget } from '../../r3f/internal/glb-scene-root/matchGlbTarget';
import {
  importExternalMaterials,
  importNodeLayers,
  importRootScale,
  parseImportFile,
  type ParsedImportFile,
} from '../../parser/importParser';
import { importSidecarPath } from '../../godot/index.js';
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
 * A `.glb` as it is, or a text `.gltf` packed with its external buffers and images into
 * one GLB. Each is read through the byte layer and recorded, so editing it reloads the glTF.
 */
async function glbBytes(
  path: string,
  data: ArrayBuffer,
  fileEventBus: FileEventBus | undefined,
  dependencies: DependencyGraph
): Promise<ArrayBuffer> {
  if (isGlbContainer(data)) return data;
  const json = JSON.parse(new TextDecoder().decode(data)) as GltfJson;
  return packGltfAsGlb(json, async (uri) => {
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
 * Correct a loaded asset by its **Import sidecar** (ADR-0028), once per path on the
 * cached template, so render, bounds, selection and the tree see one object. Godot's
 * importer too writes both corrections into the asset. A sidecar is found by convention
 * (`scene.gltf.import`), so `tryLoad`: absent means import defaults, not a **Missing resource**.
 */
async function applyImportSidecar(
  object: THREE.Object3D,
  path: string,
  fileEventBus: FileEventBus | undefined,
  dependencies: DependencyGraph
): Promise<void> {
  if (!fileEventBus) return;

  const sidecar = importSidecarPath(path);
  // Recorded before the read, so a sidecar created, edited or deleted later reloads the asset.
  dependencies.record({ busType: 'glb', key: path }, sidecar);
  const raw = await fileEventBus.tryLoad(sidecar, 'ImportSidecar');
  if (typeof raw !== 'string') return;

  const parsed = parseImportFile(raw);
  applySidecarRootScale(object, path, parsed);
  applySidecarNodeLayers(object, path, parsed);
  tagSidecarMaterials(object, path, parsed);
}

/** `nodes/root_scale`, applied to the asset the way `nodes/apply_root_scale` asks. */
function applySidecarRootScale(object: THREE.Object3D, path: string, parsed: ParsedImportFile | null): void {
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
 * (`resource_importer_scene.cpp:1836`) through `matchGlbTarget`, each raw glTF segment
 * sanitized into three's spelling first. No nearest-ancestor fallback: a mask belongs
 * to one mesh instance, and an ancestor would stamp every sibling under it.
 */
function applySidecarNodeLayers(object: THREE.Object3D, path: string, parsed: ParsedImportFile | null): void {
  const masks = importNodeLayers(parsed);
  if (masks.size === 0) return;

  const entries = flattenGlbObjects(object);
  for (const [nodePath, mask] of masks) {
    const segments = nodePath.split('/').map((s) => THREE.PropertyBinding.sanitizeNodeName(s));
    const target = matchGlbTarget(entries, segments.join('/'), { allowAncestor: false });
    if (!target) {
      logger.warn(`[GLBProcessor] ${path}: import sidecar layers path '${nodePath}' names no mesh`);
      continue;
    }
    logger.info(`[GLBProcessor] ${path}: import sidecar layers ${mask} on '${nodePath}'`);
    stampVisualLayers(target.object, mask);
  }
}

/**
 * `_subresources`' external materials, matched to surfaces by glTF material name:
 * Godot's `mat->get_meta("import_id", mat->get_name())` key
 * (`editor/import/3d/resource_importer_scene.cpp:1583`). Each matched surface is tagged
 * with its `.tres` address and keeps the glTF's own material, which an unresolvable
 * `.tres` leaves in place, as Godot's null `external_mat` branch does (`:1622-1636`).
 */
function tagSidecarMaterials(object: THREE.Object3D, path: string, parsed: ParsedImportFile | null): void {
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
    shouldProcess: (path, data) => isGltfPath(path) && data instanceof ArrayBuffer,
    process: async (path, data) => {
      const object = await createGLBMesh(
        await glbBytes(path, data as ArrayBuffer, fileEventBus, dependencies),
        {
          manager: eventBus.getThreeManager(),
          extensionRules,
        }
      );
      await applyImportSidecar(object, path, fileEventBus, dependencies);
      return object;
    },
    dispose: disposeGLBMesh,
  });
}
