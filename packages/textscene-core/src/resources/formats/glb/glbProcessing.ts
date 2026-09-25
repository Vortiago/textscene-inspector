/**
 * The GLB slice's glTF/GLB parser (ADR-0031) and the per-consumer clone. GLTFLoader
 * and SkeletonUtils are large addons, so they load lazily on the first GLB request, in
 * a chunk outside the webview's initial-paint closure.
 */

import * as THREE from 'three';

interface GlbModules {
  GLTFLoader: typeof import('three/addons/loaders/GLTFLoader.js')['GLTFLoader'];
  skeletonClone: typeof import('three/addons/utils/SkeletonUtils.js')['clone'];
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

export function isGLBPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'glb' || ext === 'gltf';
}

/**
 * The directory a glTF's relative dependencies (external .bin buffers, image files)
 * resolve against: `res://stage/model.gltf` → `res://stage/`.
 */
export function gltfResourceDir(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash + 1);
}

/** A material slot visitor: the material, and the setter that replaces it in place. */
type SurfaceVisitor = (
  material: THREE.Material,
  assign: (replacement: THREE.Material) => void
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
      visit(material, (replacement) => {
        slot[index] = replacement;
      });
    });
  } else {
    visit(slot, (replacement) => {
      holder.material = replacement;
    });
  }
}

/** Visit every surface material under `object`, with the setter for its own slot. */
export function forEachSurfaceMaterial(object: THREE.Object3D, visit: SurfaceVisitor): void {
  object.traverse((node) => visitNodeMaterials(node, visit));
}

/**
 * Dispose the per-consumer materials `cloneWithMaterials` created, and not the geometry,
 * which the clone shares with the cached template and every sibling consumer. It is
 * slot-gated like the clone, or a clone leaks its copy or frees the template's.
 */
export function disposeClonedMaterials(object: THREE.Object3D): void {
  forEachSurfaceMaterial(object, (material) => material.dispose());
}

// Functions that require the lazy-loaded addons.

/**
 * Create a THREE.Object3D from GLB/GLTF data. A text .gltf references buffers and images
 * relative to `resourcePath`, its res:// directory, and `manager` (the bus's
 * LoadingManager) lets the host map those URLs onto fetchable ones. A host with no
 * mapping fails the load, which shows the missing-resource placeholder.
 */
export async function createGLBMesh(
  data: ArrayBuffer,
  resourcePath = '',
  manager?: THREE.LoadingManager
): Promise<THREE.Object3D> {
  const { GLTFLoader } = await initGlbModules();
  const loader = new GLTFLoader(manager);
  const gltf = await loader.parseAsync(data, resourcePath);
  // GLTFLoader returns embedded clips on `gltf.animations`. The scene's `.animations`
  // is where GLBSceneRoot plays them from and where `cloneWithMaterials` copies them.
  gltf.scene.animations = gltf.animations;
  return gltf.scene;
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
      // (SHADOW_CASTING_SETTING_ON) and always receives shadows. three defaults both
      // to false, which leaves a GLB instance outside the shadow pass.
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return cloned;
}
