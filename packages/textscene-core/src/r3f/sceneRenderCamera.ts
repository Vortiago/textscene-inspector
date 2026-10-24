/**
 * Reports the camera and the target each render of a scene uses, and the end of each render. A
 * sub-viewport's pass camera never enters the R3F store, so only the render sees it, and
 * `scene.onBeforeRender` runs before the render list, so content moves that frame. A cull runs
 * after every other observer, so it reads the content and the shadow fit that render places.
 */

import * as THREE from 'three';
import { World2DCamera } from './components/Canvas2DStage/world2DCamera';

/** `target` is the render target the render draws into, null for the canvas. */
type SceneCameraObserver = (camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) => void;

/**
 * Typed as `Object3D`'s hook, where the field lives. The arguments pass through
 * untouched, so their shape never matters here.
 */
type BeforeRender = THREE.Object3D['onBeforeRender'];
type AfterRender = THREE.Object3D['onAfterRender'];

interface SceneHook {
  observers: Set<SceneCameraObserver>;
  /** Run after every observer. */
  cullers: Set<SceneCameraObserver>;
  /** Run once the render has drawn the scene. */
  finishers: Set<() => void>;
  /** Whatever `onBeforeRender` was before we chained onto it. */
  previous: BeforeRender;
  /** Whatever `onAfterRender` was before we chained onto it. */
  previousAfter: AfterRender;
}

const hooks = new WeakMap<THREE.Scene, SceneHook>();

/** Written only by `createViewportCanvasCamera`. A camera leaves it once it is collected. */
const viewportCanvasCameras = new WeakSet<THREE.Camera>();

/**
 * The camera a 2D sub-viewport draws its canvas through, through its Godot canvas transform. Like the
 * root's, it holds the canvas top at GL row 0, so its pass draws into a `CanvasFrame`.
 */
export function createViewportCanvasCamera(): THREE.OrthographicCamera {
  const camera = new World2DCamera();
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

/** Scratch for one measurement, overwritten by each: the render hooks never interleave. */
const objectOrigin = new THREE.Vector3();
const cameraOrigin = new THREE.Vector3();

/** The distance from `camera` to `object`'s origin, off the world matrices a render has just updated. */
export function cameraDistance(object: THREE.Object3D, camera: THREE.Camera): number {
  objectOrigin.setFromMatrixPosition(object.matrixWorld);
  return cameraOrigin.setFromMatrixPosition(camera.matrixWorld).distanceTo(objectOrigin);
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

/** Call `finisher` once each render of `scene` has drawn it, until the returned disposer runs. */
export function observeSceneRenderEnd(scene: THREE.Scene, finisher: () => void): () => void {
  return observeIn(scene, finisher, (hook) => hook.finishers);
}

function observeIn<Observer>(
  scene: THREE.Scene,
  observer: Observer,
  listOf: (hook: SceneHook) => Set<Observer>
): () => void {
  const hook = hooks.get(scene) ?? installHook(scene);
  listOf(hook).add(observer);
  return () => {
    const current = hooks.get(scene);
    if (!current) return;
    listOf(current).delete(observer);
    if (current.observers.size > 0 || current.cullers.size > 0 || current.finishers.size > 0) return;
    scene.onBeforeRender = current.previous;
    scene.onAfterRender = current.previousAfter;
    hooks.delete(scene);
  };
}

function installHook(scene: THREE.Scene): SceneHook {
  const hook: SceneHook = {
    observers: new Set(),
    cullers: new Set(),
    finishers: new Set(),
    previous: scene.onBeforeRender,
    previousAfter: scene.onAfterRender,
  };
  hooks.set(scene, hook);
  const chained: BeforeRender = function chainedOnBeforeRender(this: THREE.Object3D, ...args) {
    hook.previous.apply(this, args);
    // `WebGLRenderer.render` passes the target where `Object3D`'s signature names a geometry.
    const camera = args[2];
    const target = (args[3] as unknown as THREE.WebGLRenderTarget | null) ?? null;
    for (const fn of hook.observers) fn(camera, target);
    for (const fn of hook.cullers) fn(camera, target);
  };
  const chainedAfter: AfterRender = function chainedOnAfterRender(this: THREE.Object3D, ...args) {
    hook.previousAfter.apply(this, args);
    for (const fn of hook.finishers) fn();
  };
  // Chained, not replaced: several ParallaxBackgrounds and the shadow fitter share one scene.
  scene.onBeforeRender = chained;
  scene.onAfterRender = chainedAfter;
  return hook;
}
