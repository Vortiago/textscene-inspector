/**
 * The scene-level system that fits every declared shadow before each render of a scene. Godot fits
 * a directional shadow to whichever camera renders, and gives an omni or spot light its slot in the
 * atlas of the viewport that renders it. So the fit rides `scene.onBeforeRender`: the main view, a
 * SubViewport pass and a screenshot each get their own fit, whatever order they render in.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { ROOT_POSITIONAL_SHADOW_ATLAS } from '../godot/positionalShadowAtlas.js';
import {
  fitSceneDirectionalShadows,
  releaseSceneLights,
} from './directionalShadow/fitSceneDirectionalShadows.js';
import { sceneLights } from './directionalShadow/lightLists.js';
import { fitScenePositionalShadows } from './positionalShadow/fitScenePositionalShadows.js';
import { installPositionalShadowPass } from './positionalShadow/positionalShadowPass.js';
import { activeShadowAtlas, ViewportShadowAtlas } from './positionalShadow/viewportShadowAtlas.js';
import { observeSceneCamera } from './sceneRenderCamera.js';

/**
 * One render's fits, the directional one first, from one walk of the scene. The directional fit
 * changes no omni or spot light, so the positional fit reads the same walk.
 */
function fitSceneShadows(
  scene: THREE.Scene,
  camera: THREE.Camera,
  positionalAtlas: ViewportShadowAtlas,
  tickMsec: number
): void {
  const lights = sceneLights(scene);
  fitSceneDirectionalShadows(scene, camera, lights);
  fitScenePositionalShadows(lights, camera, positionalAtlas, tickMsec);
}

/**
 * Fits `scene`'s declared lights before every render of it, until unmount. A render outside any
 * SubViewport pass is the main view's, which takes the root viewport's atlas. Unmount hands each
 * declared directional light its own shading and layers back. Null fits nothing.
 */
export function useSceneShadowFit(scene: THREE.Scene | null): void {
  useEffect(() => {
    if (!scene) return undefined;
    const rootAtlas = new ViewportShadowAtlas(ROOT_POSITIONAL_SHADOW_ATLAS);
    const stopObserving = observeSceneCamera(scene, (camera) =>
      fitSceneShadows(scene, camera, activeShadowAtlas() ?? rootAtlas, performance.now())
    );
    return () => {
      stopObserving();
      releaseSceneLights(scene);
      rootAtlas.dispose();
    };
  }, [scene]);
}

/**
 * Mounted once per canvas, for the canvas's own scene. Its renderer's shadow pass copies each omni
 * light's cube into the atlas, for every scene the renderer draws.
 */
export function SceneShadowFitter() {
  const renderer = useThree((state) => state.gl);
  useEffect(() => installPositionalShadowPass(renderer), [renderer]);
  useSceneShadowFit(useThree((state) => state.scene));
  return null;
}
