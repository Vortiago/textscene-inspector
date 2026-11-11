/**
 * Reports the camera and the target each render of a scene uses, and the end of each render. A
 * sub-viewport's pass camera never enters the R3F store, so only the render sees it, and
 * `scene.onBeforeRender` runs before the render list, so content moves that frame. A poser writes
 * before every observer, so an observer reads the transforms it wrote. The exposure runs after
 * every observer, so it scales each light energy an observer wrote for the render. A cull runs
 * last, so it reads the content and the shadow fit that render places.
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

/** Writes the transforms a render draws, and takes them back once the render has drawn. */
export interface ScenePoser {
  /** Runs with the world matrices of the scene current. */
  write(): void;
  restore(): void;
}

interface SceneHook {
  /** Write before every observer, and restore before every finisher, the last written first. */
  posers: Set<ScenePoser>;
  /** Written only by `withScenePose`: true while its draw holds the pose over the renders inside it. */
  isPoseHeld: boolean;
  observers: Set<SceneCameraObserver>;
  /** Run after every observer. */
  exposers: Set<SceneCameraObserver>;
  /** Run after every exposer. */
  cullers: Set<SceneCameraObserver>;
  /** Run once the render has drawn the scene. */
  finishers: Set<() => void>;
  /** Whatever `onBeforeRender` was before we chained onto it. */
  previous: BeforeRender;
  /** Whatever `onAfterRender` was before we chained onto it. */
  previousAfter: AfterRender;
}

// eslint-disable-next-line no-restricted-syntax -- the last observer's release deletes the scene's hook
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

/**
 * Pose each render of `scene` with `poser`, such as the bones of a Skeleton2D, until the returned
 * disposer runs.
 */
export function observeScenePose(scene: THREE.Scene, poser: ScenePoser): () => void {
  return observeIn(scene, poser, (hook) => hook.posers);
}

/**
 * Runs `draw` with the pose of `scene` written, and held over each render of the scene inside it.
 * For a draw that reads the scene before its render starts, or that renders a subtree, which fires
 * no hook of the scene. The world matrices of `scene` are current when it runs.
 */
export function withScenePose(scene: THREE.Object3D, draw: () => void): void {
  const hook = hooks.get(scene as THREE.Scene);
  if (!hook || hook.isPoseHeld || hook.posers.size === 0) return draw();
  hook.isPoseHeld = true;
  try {
    for (const poser of hook.posers) poser.write();
    draw();
  } finally {
    restorePosers(hook.posers);
    hook.isPoseHeld = false;
  }
}

/**
 * Last written, first restored: where two posers write one object, the later one holds what the
 * earlier one wrote, and a restore in the write order would leave that on the object.
 */
function restorePosers(posers: ReadonlySet<ScenePoser>): void {
  for (const poser of [...posers].reverse()) poser.restore();
}

/** {@link observeSceneCamera}, for the exposure, which runs after every observer and before the cull. */
export function observeSceneExposure(scene: THREE.Scene, exposer: SceneCameraObserver): () => void {
  return observeIn(scene, exposer, (hook) => hook.exposers);
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
    const lists = [current.posers, current.observers, current.exposers, current.cullers, current.finishers];
    if (lists.some((list) => list.size > 0)) return;
    scene.onBeforeRender = current.previous;
    scene.onAfterRender = current.previousAfter;
    hooks.delete(scene);
  };
}

function installHook(scene: THREE.Scene): SceneHook {
  const hook: SceneHook = {
    posers: new Set(),
    isPoseHeld: false,
    observers: new Set(),
    exposers: new Set(),
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
    if (!hook.isPoseHeld) for (const poser of hook.posers) poser.write();
    for (const fn of hook.observers) fn(camera, target);
    for (const fn of hook.exposers) fn(camera, target);
    for (const fn of hook.cullers) fn(camera, target);
  };
  const chainedAfter: AfterRender = function chainedOnAfterRender(this: THREE.Object3D, ...args) {
    hook.previousAfter.apply(this, args);
    if (!hook.isPoseHeld) restorePosers(hook.posers);
    for (const fn of hook.finishers) fn();
  };
  // Chained, not replaced: several ParallaxBackgrounds and the shadow fitter share one scene.
  scene.onBeforeRender = chained;
  scene.onAfterRender = chainedAfter;
  return hook;
}
