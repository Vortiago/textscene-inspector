/**
 * Reports the camera and the target each render of a scene uses. A sub-viewport's pass camera
 * never enters the R3F store, so only the render sees it, and
 * `scene.onBeforeRender` runs before the render list, so content moves that frame. A cull runs
 * after every other observer, so it reads the content and the shadow fit that render places.
 */

import * as THREE from 'three';

/** `target` is the render target the render draws into, null for the canvas. */
type SceneCameraObserver = (camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) => void;

/**
 * Typed as `Object3D`'s hook, where the field lives. The arguments pass through
 * untouched, so their shape never matters here.
 */
type BeforeRender = THREE.Object3D['onBeforeRender'];

interface SceneHook {
  observers: Set<SceneCameraObserver>;
  /** Run after every observer. */
  cullers: Set<SceneCameraObserver>;
  /** Whatever `onBeforeRender` was before we chained onto it. */
  previous: BeforeRender;
}

const hooks = new WeakMap<THREE.Scene, SceneHook>();

/** Written only by `createViewportCanvasCamera`. A camera leaves it once it is collected. */
const viewportCanvasCameras = new WeakSet<THREE.Camera>();

/** The camera a 2D sub-viewport draws its canvas through, through its Godot canvas transform. */
export function createViewportCanvasCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera();
  viewportCanvasCameras.add(camera);
  return camera;
}

/**
 * Whether a render through `camera` is a 2D sub-viewport's pass, the only surface with a Godot
 * canvas transform. The 2D stage draws through the store's free camera, with none, as Godot's
 * editor does (`camera_2d.cpp:41-44`), and a 3D sub-viewport's orthographic Camera3D frames no
 * canvas.
 */
export function isViewportPass(camera: THREE.Camera): camera is THREE.OrthographicCamera {
  return viewportCanvasCameras.has(camera);
}

/**
 * Call `observer` with the camera and target each render of `scene` uses, until the
 * returned disposer runs. Removing the last observer restores the scene's
 * original `onBeforeRender` so nothing is left installed on a shared object.
 */
export function observeSceneCamera(scene: THREE.Scene, observer: SceneCameraObserver): () => void {
  return observeIn(scene, observer, (hook) => hook.observers);
}

/** {@link observeSceneCamera}, for an observer that runs after every other one. */
export function observeSceneCull(scene: THREE.Scene, culler: SceneCameraObserver): () => void {
  return observeIn(scene, culler, (hook) => hook.cullers);
}

function observeIn(
  scene: THREE.Scene,
  observer: SceneCameraObserver,
  listOf: (hook: SceneHook) => Set<SceneCameraObserver>
): () => void {
  const hook = hooks.get(scene) ?? installHook(scene);
  listOf(hook).add(observer);
  return () => {
    const current = hooks.get(scene);
    if (!current) return;
    listOf(current).delete(observer);
    if (current.observers.size > 0 || current.cullers.size > 0) return;
    scene.onBeforeRender = current.previous;
    hooks.delete(scene);
  };
}

function installHook(scene: THREE.Scene): SceneHook {
  const hook: SceneHook = { observers: new Set(), cullers: new Set(), previous: scene.onBeforeRender };
  hooks.set(scene, hook);
  const chained: BeforeRender = function chainedOnBeforeRender(this: THREE.Object3D, ...args) {
    hook.previous.apply(this, args);
    // `WebGLRenderer.render` passes the target where `Object3D`'s signature names a geometry.
    const camera = args[2];
    const target = (args[3] as unknown as THREE.WebGLRenderTarget | null) ?? null;
    for (const fn of hook.observers) fn(camera, target);
    for (const fn of hook.cullers) fn(camera, target);
  };
  // Chained, not replaced: several ParallaxBackgrounds and the shadow fitter share one scene.
  scene.onBeforeRender = chained;
  return hook;
}
