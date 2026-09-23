/**
 * Reports the camera each render of a scene uses. A sub-viewport's pass camera
 * never enters the R3F store, so only the render sees it, and
 * `scene.onBeforeRender` runs before the render list, so content moves that frame.
 */

import type * as THREE from 'three';

type SceneCameraObserver = (camera: THREE.Camera) => void;

/**
 * Typed as `Object3D`'s hook, where the field lives. The arguments pass through
 * untouched, so their shape never matters here.
 */
type BeforeRender = THREE.Object3D['onBeforeRender'];

interface SceneHook {
  observers: Set<SceneCameraObserver>;
  /** Whatever `onBeforeRender` was before we chained onto it. */
  previous: BeforeRender;
}

const hooks = new WeakMap<THREE.Scene, SceneHook>();

/**
 * Call `observer` with the camera each render of `scene` uses, until the
 * returned disposer runs. Removing the last observer restores the scene's
 * original `onBeforeRender` so nothing is left installed on a shared object.
 */
export function observeSceneCamera(
  scene: THREE.Scene,
  observer: SceneCameraObserver
): () => void {
  let hook = hooks.get(scene);
  if (!hook) {
    hook = { observers: new Set(), previous: scene.onBeforeRender };
    hooks.set(scene, hook);
    const installed = hook;
    const chained: BeforeRender = function chainedOnBeforeRender(this: THREE.Object3D, ...args) {
      installed.previous.apply(this, args);
      const camera = args[2];
      for (const fn of installed.observers) fn(camera);
    };
    // Chained, not replaced: several ParallaxBackgrounds can share one scene.
    scene.onBeforeRender = chained;
  }

  hook.observers.add(observer);
  return () => {
    const current = hooks.get(scene);
    if (!current) return;
    current.observers.delete(observer);
    if (current.observers.size > 0) return;
    scene.onBeforeRender = current.previous;
    hooks.delete(scene);
  };
}
