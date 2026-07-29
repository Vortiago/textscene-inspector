/**
 * "Which camera is this scene being rendered through, right now?" — the one
 * question a CanvasLayer has to answer and no React state can.
 *
 * A CanvasLayer is attached to a VIEWPORT, not to its parent node, so its
 * contents are laid out in that viewport's screen space. The previewer draws two
 * kinds of 2D surface and they answer differently:
 *
 * - the **2D stage** (`World2DCanvas`) draws the whole CanvasItem world through
 *   a free pan/zoom camera, exactly as Godot's editor does — no canvas
 *   transform, so screen space IS world space. `scripts/godot-ref/run.mjs`
 *   states the same rule from the other side, disabling a scene's Camera2Ds
 *   before capturing ("the previewer ignores a scene's camera … so the
 *   reference has to as well").
 * - a **sub-viewport's 2D pass** narrows to its current Camera2D's view each
 *   frame (`orthoFrameForCamera2D`), so screen space is that view rect.
 *
 * The pass's camera is created inside `<SubViewport>` and never enters the R3F
 * store, so the only place it is observable is the render itself:
 * `WebGLRenderer.render` calls `scene.onBeforeRender(renderer, scene, camera,
 * target)` BEFORE it builds the render list or projects any object, so a
 * subscriber can both read the camera and move content for the very same frame.
 *
 * Subscribers chain rather than replace: several ParallaxBackgrounds can share
 * one scene, and three's own code (`WebGLBackground`) installs hooks on objects
 * the same way.
 */

import type * as THREE from 'three';

type SceneCameraObserver = (camera: THREE.Camera) => void;

/**
 * Declared as `Object3D`'s hook because that is where the field lives, even
 * though `WebGLRenderer` passes a scene a render target where an object gets a
 * geometry — the arguments are forwarded untouched, so the shape never matters
 * here.
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
