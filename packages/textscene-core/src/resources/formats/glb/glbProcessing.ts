/**
 * The GLB slice's glTF/GLB parser (ADR-0031) and the per-consumer clone. GLTFLoader is a
 * large addon, so it loads lazily on the first GLB request, in a chunk outside the webview's
 * initial-paint closure. SkeletonUtils is about 3 KB gzipped, so it loads statically and
 * `cloneWithMaterials` works on any mesh, built or not.
 */

import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { applyShadowCasting, shadowCastingEffects } from '../../../r3f/shadowCasting';
import { ShadowCastingSetting } from '../../../godot/rendering/rendering';
import { withExtensionRules } from './extensionRules';
import { tagMeshInstances } from './meshInstances';
import { tagGodotNodeNames } from './nodeNames';
import { gltfImportNames, type GltfNamingOptions } from '../../../godot/import/gltfImportNames';
import { DRAWN_OPAQUE_PREPASS, opaquePrepassUserData } from '../../../r3f/materials/opaquePrepass';
import { withImportedNormalMapRead } from '../../../r3f/materials/godotNormalMap';
import type { GltfExtensionRules } from './types';
import type { GLTF, GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { usesGodotSingleRoot } from '../../../godot/import/gltf';
import { applyLightmapUv, type LightmapUvImport } from './lightmapUv/lightmapUv';
import { godotPrimitives } from './godotPrimitives';
import { importingImages, restoreImportedSampling, type GltfImageImport } from './imageImport';
import { forEachSurfaceMaterial } from './surfaceMaterials';

type GLTFLoaderClass = (typeof import('three/addons/loaders/GLTFLoader.js'))['GLTFLoader'];

/** Written only by `loadGLTFLoader`. Cleared when the chunk load fails, so the next request retries. */
let loaderPromise: Promise<GLTFLoaderClass> | null = null;

/** Loads GLTFLoader once, caching the promise. */
function loadGLTFLoader(): Promise<GLTFLoaderClass> {
  loaderPromise ??= import('three/addons/loaders/GLTFLoader.js')
    .then((loaderModule) => loaderModule.GLTFLoader)
    .catch((error: unknown) => {
      // A failed chunk load must not poison the cache: the next GLB request retries
      // the import, and this caller still gets the rejection as a missing resource.
      loaderPromise = null;
      throw error;
    });
  return loaderPromise;
}

// Synchronous helpers, with no addons, safe in the initial bundle.

/**
 * The `.tres` an **Import sidecar** remaps a surface's material to. The GLB processor writes
 * it into the material's `userData`, which `Material.clone` copies to every consumer's clone,
 * and the scene root draws that `.tres` through the one material path.
 */
const IMPORT_MATERIAL_PATH_KEY = 'textsceneImportMaterialPath';

export function tagImportMaterial(material: THREE.Material, path: string): void {
  material.userData[IMPORT_MATERIAL_PATH_KEY] = path;
}

/** The `.tres` the sidecar remaps `material` to, or undefined for none. */
export function importMaterialPath(material: THREE.Material): string | undefined {
  const path: unknown = material.userData[IMPORT_MATERIAL_PATH_KEY];
  return typeof path === 'string' ? path : undefined;
}

/**
 * Dispose the per-consumer materials `cloneWithMaterials` created, and not the geometry,
 * which the clone shares with the cached template and every sibling consumer. It is
 * slot-gated like the clone, or a clone leaks its copy or frees the template's.
 */
export function disposeClonedMaterials(object: THREE.Object3D): void {
  forEachSurfaceMaterial(object, (material) => material.dispose());
}

/**
 * Images decode through an `<img>` element, as every other texture here does. GLTFLoader's
 * default `ImageBitmapLoader` fetches its `blob:` URL, which the VS Code webview's CSP
 * refuses, so every glTF image failed there. Plugins run after the parser exists.
 */
function decodeImagesInImageElements(parser: GLTFParser): GLTFLoaderPlugin {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: 'textscene_image_element_textures' };
}

/** The URLs the glTF loader makes from bytes it already holds: an image's `blob:` and a `data:` URI. */
const IN_MEMORY_URL = /^(?:blob|data):/i;

/**
 * A loading manager that refuses every URL but an in-memory one, so a URI the processor
 * did not pack into the GLB throws before a request. The throw rejects the load.
 */
function inMemoryOnlyManager(): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (IN_MEMORY_URL.test(url)) return url;
    throw new Error(`[glbProcessing] The glTF loader refuses ${url}: a glTF loads only the bytes it carries`);
  });
  return manager;
}

// Functions that require the lazy-loaded addons.

export interface GlbLoadOptions {
  /** Defaults to `godot-importer`. */
  extensionRules?: GltfExtensionRules;
  /** The **Import sidecar**'s naming options. */
  naming: GltfNamingOptions;
  /** The lightmap UV2 to give the meshes Godot unwraps, absent when the sidecar unwraps none. */
  lightmapUv?: LightmapUvImport;
  /** How Godot imports each image. */
  imageImport: GltfImageImport;
}

/**
 * Create a THREE.Object3D from a GLB that carries its buffers and images, as `glbBytes` in
 * the processor packs every glTF. The loader fetches nothing, and refuses a URI left in it.
 */
export async function createGLBMesh(
  data: ArrayBuffer,
  { extensionRules = 'godot-importer', naming, lightmapUv, imageImport }: GlbLoadOptions
): Promise<THREE.Object3D> {
  const GLTFLoader = await loadGLTFLoader();
  const loader = withExtensionRules(new GLTFLoader(inMemoryOnlyManager()), extensionRules)
    .register(decodeImagesInImageElements)
    .register(importingImages(imageImport))
    .register(godotPrimitives);
  const gltf = await loader.parseAsync(data, '');
  const root = await godotSceneRoot(gltf);
  restoreImportedSampling(root);
  const names = gltfImportNames(gltf.parser.json, naming);
  if (lightmapUv) await applyLightmapUv(gltf, root, lightmapUv, names.meshes);
  // GLTFLoader returns embedded clips on `gltf.animations`. The root's `.animations`
  // is where GLBSceneRoot plays them from and where `cloneWithMaterials` copies them.
  root.animations = gltf.animations;
  tagMeshInstances(root, gltf.parser.associations);
  tagGodotNodeNames(root, gltf.parser.associations, names.nodes);
  importBlendAsDepthPrepass(root);
  return root;
}

/**
 * The object Godot's importer makes the scene root: glTF node 0 for a `GODOT_single_root` file, else
 * a root over the scene's nodes. A file with no node 0 fails, as Godot's import does.
 */
async function godotSceneRoot(gltf: GLTF): Promise<THREE.Object3D> {
  if (!usesGodotSingleRoot(gltf.parser.json)) return gltf.scene;
  if (!gltf.parser.json.nodes?.length)
    throw new Error('glTF: Single root file has no nodes. This glTF file is invalid.');
  let root: THREE.Object3D | undefined;
  gltf.scene.traverse((object) => {
    if (gltf.parser.associations.get(object)?.nodes === 0) root ??= object;
  });
  root ??= (await gltf.parser.getDependency('node', 0)) as THREE.Object3D;
  root.removeFromParent();
  return root;
}

/**
 * Godot imports glTF `alphaMode` BLEND as ALPHA_DEPTH_PRE_PASS (`gltf_document.cpp:3117-3118`),
 * so the depth prepass draws it. GLTFLoader marks only BLEND `transparent`.
 */
function importBlendAsDepthPrepass(object: THREE.Object3D): void {
  forEachSurfaceMaterial(object, (material) => {
    if (material.transparent) Object.assign(material.userData, opaquePrepassUserData(DRAWN_OPAQUE_PREPASS));
  });
}

/** Clone an Object3D and its materials, since an Object3D has one parent. */
export function cloneWithMaterials(mesh: THREE.Object3D): THREE.Object3D {
  // SkeletonUtils, not `clone(true)`: a plain clone leaves a SkinnedMesh bound to the
  // source bones, so animating one instance deforms the template and every other one.
  const cloned = skeletonClone(mesh);

  // SkeletonUtils shares material references, so clone every slot the sidecar writer
  // can reach, and a per-instance material change stays in its instance.
  forEachSurfaceMaterial(cloned, (material, assign) => assign(withImportedNormalMapRead(material.clone())));

  cloned.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      // Godot's glTF import mounts every surface as a MeshInstance3D that casts
      // (SHADOW_CASTING_SETTING_ON) and always receives shadows. three defaults both to
      // false. The hooks let a surface override's own billboard and shadow pass apply.
      applyShadowCasting(node, shadowCastingEffects(ShadowCastingSetting.ON));
      node.receiveShadow = true;
    }
  });

  return cloned;
}
