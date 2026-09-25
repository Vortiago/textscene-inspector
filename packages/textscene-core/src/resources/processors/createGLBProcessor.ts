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
  forEachSurfaceMaterial,
  gltfResourceDir,
  isGLBPath,
} from '../formats/glb/glbProcessing';
import { applyRootScale } from '../formats/glb/rootScale';
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
import * as logger from '../../logger';
import { isMaterialOwnedTexture, pinNoColorSpace } from '../textures/applyTextureState';
import { releaseOwnedTextures } from '../materials/standardmaterial3d/textureBinding';

/** Loads a material by its `res://` path; null when it cannot be had. */
export type MaterialLoaderFn = (path: string) => Promise<THREE.Material | null>;

/**
 * Dispose of a GLB mesh and all its resources. Unlike a per-consumer clone
 * (whose geometry is shared with this template — see
 * `disposeClonedMaterials`), the TEMPLATE owns its geometry too.
 */
function disposeGLBMesh(mesh: THREE.Object3D): void {
  // Materials through the same slot-gated walker the sidecar writes through, so a
  // surface it can reach is a surface this can free. The owned textures are the
  // ones `adoptOwnedTextures` gave the template, and a glTF's own carry no tag.
  forEachSurfaceMaterial(mesh, (material) => {
    releaseOwnedTextures(material);
    material.dispose();
  });
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) node.geometry?.dispose();
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
  loadMaterial: MaterialLoaderFn
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
 * (`resource_importer_scene.cpp:1836`).
 *
 * Resolved through `matchGlbTarget` — its header carries why the two importers' node
 * lists differ. Godot's key holds the raw glTF names, so each segment is sanitized into
 * three's spelling first; the nearest-ancestor fallback is OFF, because a mask belongs to
 * one mesh instance and an ancestor would stamp every sibling under it.
 */
function applySidecarNodeLayers(
  object: THREE.Object3D,
  path: string,
  parsed: ParsedImportFile | null
): void {
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
 * Gives a cloned material its own copy of each texture the source material owns.
 * `Material.clone()` shares texture references, and the material processor frees
 * its owned textures when it evicts the `.tres`, which would pull them from under
 * the template. A shared cache entry stays shared: the loader owns it.
 */
function adoptOwnedTextures(material: THREE.Material): THREE.Material {
  const slots = material as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(slots)) {
    if (!(value instanceof THREE.Texture) || !isMaterialOwnedTexture(value)) continue;
    const copy = value.clone();
    // `copy` reads the pinned getter but not the pin, so it is pinned again.
    if (value.colorSpace === THREE.NoColorSpace) pinNoColorSpace(copy);
    slots[key] = copy;
  }
  return material;
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
  loadMaterial: MaterialLoaderFn
): Promise<void> {
  const remaps = importExternalMaterials(parsed);
  if (remaps.size === 0) return;

  // One traversal: the visitor already hands over each slot's setter, so keeping them is
  // what makes a second walk after the awaits unnecessary.
  const slots: { material: THREE.Material; assign: (m: THREE.Material) => void }[] = [];
  const wanted = new Map<string, string>();
  forEachSurfaceMaterial(object, (material, assign) => {
    const external = remaps.get(material.name);
    if (external === undefined) return;
    wanted.set(material.name, external);
    slots.push({ material, assign });
  });
  if (slots.length === 0) return;

  const built = new Map<string, THREE.Material>();
  await Promise.all(
    [...wanted].map(async ([name, external]) => {
      const material = await loadMaterial(external);
      if (material) built.set(name, adoptOwnedTextures(material.clone()));
      else logger.warn(`[GLBProcessor] ${path}: external material ${external} did not load`);
    })
  );
  if (built.size === 0) return;

  const replaced = new Set<THREE.Material>();
  for (const slot of slots) {
    const external = built.get(slot.material.name);
    if (!external) continue;
    replaced.add(slot.material);
    slot.assign(external);
  }
  // Nothing else can reference these: every surface carrying the name was just reassigned.
  for (const material of replaced) material.dispose();

  logger.info(
    `[GLBProcessor] ${path}: import sidecar external materials ` +
      [...built.keys()].map((name) => `${name} -> ${wanted.get(name)}`).join(', ')
  );
}

/**
 * Create a GLB mesh processor that handles loading and caching GLB/GLTF meshes.
 */
export function createGLBProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  loadMaterial: MaterialLoaderFn
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
