/**
 * Factory for creating GLB mesh processors — the GLB slice's loader-facing
 * adapter (`resources/formats/glb/`, ADR-0031). Stays here because the
 * `ResourceLoader` constructs it alongside its peer factories.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import {
  createGLBMesh,
  disposeMeshMaterials,
  gltfResourceDir,
  isGLBPath,
} from '../formats/glb/glbProcessing';
import { applyRootScale } from '../formats/glb/rootScale';
import { stampVisualLayers } from '../../r3f/visualLayers';
import {
  importExternalMaterials,
  importNodeLayers,
  importRootScale,
  parseImportFile,
  type ParsedImportFile,
} from '../../parser/importParser';
import * as logger from '../../logger';

/** Loads a material by its `res://` path; null when it cannot be had. */
export type MaterialLoaderFn = (path: string) => Promise<THREE.Material | null>;

/**
 * Dispose of a GLB mesh and all its resources. Unlike a per-consumer clone
 * (whose geometry is shared with this template — see
 * `disposeClonedMaterials`), the TEMPLATE owns its geometry too.
 */
function disposeGLBMesh(mesh: THREE.Object3D): void {
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose();
      disposeMeshMaterials(node);
    }
  });
}

/**
 * Correct a freshly loaded asset by its **Import sidecar** (ADR-0028).
 *
 * Done HERE, once per path, rather than in a consumer: the processor owns the cached
 * template, so every downstream reader — render, bounds, selection, the scene tree —
 * sees one already-correct object, and none of them can disagree about it. It is also
 * where Godot does it: the importer writes both corrections into the ImporterMesh before
 * the scene is serialised, so they belong to the ASSET, not to a scene instancing it.
 *
 * A sidecar is found by convention (`scene.gltf` → `scene.gltf.import`), never declared
 * by a scene, so it is read with `tryLoad`: absent is the common case and means "Godot's
 * import defaults", not a **Missing resource**.
 */
async function applyImportSidecar(
  object: THREE.Object3D,
  path: string,
  fileEventBus: FileEventBus | undefined,
  loadMaterial: MaterialLoaderFn | undefined
): Promise<void> {
  if (!fileEventBus) return;

  const raw = await fileEventBus.tryLoad(`${path}.import`, 'ImportSidecar');
  if (typeof raw !== 'string') return;

  const parsed = parseImportFile(raw);
  applySidecarRootScale(object, path, parsed);
  applySidecarNodeLayers(object, path, parsed);
  await applySidecarMaterials(object, path, parsed, loadMaterial);
}

/** `nodes/root_scale`, applied to the asset the way `nodes/apply_root_scale` asks. */
function applySidecarRootScale(
  object: THREE.Object3D,
  path: string,
  parsed: ParsedImportFile | null
): void {
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
 * (`resource_importer_scene.cpp:1836`). Godot's path holds the raw glTF names, which
 * three's loader has already sanitized on the object graph, so the lookup sanitizes each
 * segment the same way rather than comparing raw to cooked.
 */
function applySidecarNodeLayers(
  object: THREE.Object3D,
  path: string,
  parsed: ParsedImportFile | null
): void {
  const masks = importNodeLayers(parsed);
  if (masks.size === 0) return;

  for (const [nodePath, mask] of masks) {
    const target = resolveSanitizedPath(object, nodePath);
    if (!target) {
      logger.warn(`[GLBProcessor] ${path}: import sidecar layers path '${nodePath}' matched no node`);
      continue;
    }
    logger.info(`[GLBProcessor] ${path}: import sidecar layers ${mask} on '${nodePath}'`);
    stampVisualLayers(target, mask);
  }
}

/** Walk `a/b/c` from the asset root, comparing three's sanitized names. */
function resolveSanitizedPath(root: THREE.Object3D, nodePath: string): THREE.Object3D | null {
  let current: THREE.Object3D | null = null;
  for (const segment of nodePath.split('/')) {
    const wanted = THREE.PropertyBinding.sanitizeNodeName(segment);
    const pool: THREE.Object3D[] = current ? current.children : [root, ...root.children];
    current = pool.find((child) => child.name === wanted) ?? null;
    if (!current) return null;
  }
  return current;
}

/**
 * `_subresources`' external materials, matched to surfaces by glTF material name —
 * Godot's `mat->get_meta("import_id", mat->get_name())` key
 * (`editor/import/3d/resource_importer_scene.cpp:1583`), which for glTF is the name.
 *
 * The replaced material is CLONED: the material processor owns and caches the original,
 * while `disposeGLBMesh` frees whatever sits on the template's surfaces. An unresolvable
 * `.tres` leaves the glTF's own material, which is what Godot's null `external_mat`
 * branch does (`:1622-1636`).
 */
async function applySidecarMaterials(
  object: THREE.Object3D,
  path: string,
  parsed: ParsedImportFile | null,
  loadMaterial: MaterialLoaderFn | undefined
): Promise<void> {
  if (!loadMaterial) return;
  const remaps = importExternalMaterials(parsed);
  if (remaps.size === 0) return;

  const wanted = new Map<string, string>();
  forEachSurfaceMaterial(object, (material) => {
    const external = remaps.get(material.name);
    if (external !== undefined) wanted.set(material.name, external);
  });
  if (wanted.size === 0) return;

  const built = new Map<string, THREE.Material>();
  await Promise.all(
    [...wanted].map(async ([name, external]) => {
      const material = await loadMaterial(external);
      if (material) built.set(name, material.clone());
      else logger.warn(`[GLBProcessor] ${path}: external material ${external} did not load`);
    })
  );
  if (built.size === 0) return;

  const replaced = new Set<THREE.Material>();
  forEachSurfaceMaterial(object, (material, assign) => {
    const external = built.get(material.name);
    if (!external) return;
    replaced.add(material);
    assign(external);
  });
  // Nothing else can reference these: every surface carrying the name was just reassigned.
  for (const material of replaced) material.dispose();

  logger.info(
    `[GLBProcessor] ${path}: import sidecar external materials ` +
      [...built.keys()].map((name) => `${name} -> ${wanted.get(name)}`).join(', ')
  );
}

/** Visit every surface material under `object`, with the setter for its own slot. */
function forEachSurfaceMaterial(
  object: THREE.Object3D,
  visit: (material: THREE.Material, assign: (replacement: THREE.Material) => void) => void
): void {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) {
      const slots = mesh.material;
      slots.forEach((material, index) => {
        visit(material, (replacement) => {
          slots[index] = replacement;
        });
      });
    } else if (mesh.material) {
      visit(mesh.material, (replacement) => {
        mesh.material = replacement;
      });
    }
  });
}

/**
 * Create a GLB mesh processor that handles loading and caching GLB/GLTF meshes.
 */
export function createGLBProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  loadMaterial?: MaterialLoaderFn
): ResourceProcessor<THREE.Object3D> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'glb',
    shouldProcess: (path, data) => isGLBPath(path) && data instanceof ArrayBuffer,
    process: async (path, data) => {
      // Text .gltf resolves external buffers/images against its own res://
      // directory through the bus's LoadingManager (host-mapped URLs).
      const object = await createGLBMesh(
        data as ArrayBuffer,
        gltfResourceDir(path),
        eventBus.getThreeManager()
      );
      await applyImportSidecar(object, path, fileEventBus, loadMaterial);
      return object;
    },
    dispose: disposeGLBMesh,
  });
}
