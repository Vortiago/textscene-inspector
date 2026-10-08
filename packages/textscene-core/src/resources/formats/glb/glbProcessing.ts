/**
 * The GLB slice's glTF/GLB parser (ADR-0031) and the per-consumer clone. GLTFLoader
 * and SkeletonUtils are large addons, so they load lazily on the first GLB request, in
 * a chunk outside the webview's initial-paint closure.
 */

import * as THREE from 'three';
import { applyShadowCasting, shadowCastingEffects } from '../../../r3f/shadowCasting';
import { ShadowCastingSetting } from '../../../godot/rendering';
import { withExtensionRules } from './extensionRules';
import { tagMeshInstances } from './meshInstances';
import { tagGodotNodeNames } from './nodeNames';
import {
  DEFAULT_GLTF_NAMING_VERSION,
  gltfNodeNames,
  type GltfNamingOptions,
} from '../../../godot/gltfNodeNames';
import { DRAWN_OPAQUE_PREPASS, opaquePrepassUserData } from '../../../r3f/materials/opaquePrepass';
import type { GltfExtensionRules } from './types';
import type { GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';

interface GlbModules {
  GLTFLoader: (typeof import('three/addons/loaders/GLTFLoader.js'))['GLTFLoader'];
  skeletonClone: (typeof import('three/addons/utils/SkeletonUtils.js'))['clone'];
}

/** Null until the first GLB load. Written only when `initPromise` resolves. */
let glbModules: GlbModules | null = null;
let initPromise: Promise<GlbModules> | null = null;

/**
 * Load GLTFLoader and SkeletonUtils once, caching the promise. A test that calls
 * `cloneWithMaterials` directly awaits this first.
 */
export function initGlbModules(): Promise<GlbModules> {
  initPromise ??= Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/utils/SkeletonUtils.js'),
  ])
    .then(([loaderMod, skeletonMod]) => {
      glbModules = { GLTFLoader: loaderMod.GLTFLoader, skeletonClone: skeletonMod.clone };
      return glbModules;
    })
    .catch((error: unknown) => {
      // A failed chunk load must not poison the cache: the next GLB request retries
      // the import, and this caller still gets the rejection as a missing resource.
      initPromise = null;
      throw error;
    });
  return initPromise;
}

// Synchronous helpers, with no addons, safe in the initial bundle.

/**
 * A material slot visitor: the material, the setter that replaces it in place, and a reader
 * for what the slot holds later, after other writers may have replaced it.
 */
type SurfaceVisitor = (
  material: THREE.Material,
  assign: (replacement: THREE.Material) => void,
  read: () => THREE.Material | undefined
) => void;

/**
 * One node's material slot or slots, the one place that owns the array-or-single branch.
 * Gated on the slot, not on `isMesh`, because a glTF's non-triangle primitives arrive as
 * `Points`/`Line` with a material the importer's per-surface rules reach too.
 */
function visitNodeMaterials(node: THREE.Object3D, visit: SurfaceVisitor): void {
  const holder = node as THREE.Mesh;
  const slot = holder.material as THREE.Material | THREE.Material[] | undefined;
  if (!slot) return;
  if (Array.isArray(slot)) {
    slot.forEach((material, index) => {
      visit(
        material,
        (replacement) => {
          slot[index] = replacement;
        },
        () => slot[index]
      );
    });
  } else {
    visit(
      slot,
      (replacement) => {
        holder.material = replacement;
      },
      () => holder.material as THREE.Material
    );
  }
}

/** Visit every surface material under `object`, with the setter for its own slot. */
export function forEachSurfaceMaterial(object: THREE.Object3D, visit: SurfaceVisitor): void {
  object.traverse((node) => visitNodeMaterials(node, visit));
}

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
  /** The **Import sidecar**'s naming options. Defaults to Godot's import defaults. */
  naming?: GltfNamingOptions;
}

/** Godot's import defaults, for a file whose name names nothing: only version 0 reads it. */
const DEFAULT_NAMING: GltfNamingOptions = {
  namingVersion: DEFAULT_GLTF_NAMING_VERSION,
  importAsSkeletonBones: false,
  fileName: '',
};

/**
 * Create a THREE.Object3D from a GLB that carries its buffers and images, as `glbBytes` in
 * the processor packs every glTF. The loader fetches nothing, and refuses a URI left in it.
 */
export async function createGLBMesh(
  data: ArrayBuffer,
  { extensionRules = 'godot-importer', naming = DEFAULT_NAMING }: GlbLoadOptions = {}
): Promise<THREE.Object3D> {
  const { GLTFLoader } = await initGlbModules();
  const loader = withExtensionRules(new GLTFLoader(inMemoryOnlyManager()), extensionRules).register(
    decodeImagesInImageElements
  );
  const gltf = await loader.parseAsync(data, '');
  // GLTFLoader returns embedded clips on `gltf.animations`. The scene's `.animations`
  // is where GLBSceneRoot plays them from and where `cloneWithMaterials` copies them.
  gltf.scene.animations = gltf.animations;
  tagMeshInstances(gltf.scene, gltf.parser.associations);
  tagGodotNodeNames(gltf.scene, gltf.parser.associations, gltfNodeNames(gltf.parser.json, naming));
  importBlendAsDepthPrepass(gltf.scene);
  return gltf.scene;
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

/**
 * Clone an Object3D and its materials, since an Object3D has one parent. Requires an
 * awaited `initGlbModules()`, which a successful `createGLBMesh` always did before a
 * consumer holds a clone.
 */
export function cloneWithMaterials(mesh: THREE.Object3D): THREE.Object3D {
  if (!glbModules) {
    throw new Error(
      '[glbProcessing] cloneWithMaterials called before initGlbModules(). ' +
        'Await initGlbModules() in a beforeAll/beforeEach in tests, or ensure ' +
        'createGLBMesh has been called at least once before cloning.'
    );
  }
  // SkeletonUtils, not `clone(true)`: a plain clone leaves a SkinnedMesh bound to the
  // source bones, so animating one instance deforms the template and every other one.
  const cloned = glbModules.skeletonClone(mesh);

  // SkeletonUtils shares material references, so clone every slot the sidecar writer
  // can reach, and a per-instance material change stays in its instance.
  forEachSurfaceMaterial(cloned, (material, assign) => assign(material.clone()));

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
