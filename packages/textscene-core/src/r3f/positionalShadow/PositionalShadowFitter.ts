/**
 * The scene-level system that fits every declared omni and spot shadow before each render of a
 * scene. Godot gives a light its slot in the atlas of the viewport that renders it, so the fit
 * rides `scene.onBeforeRender` and reads the atlas of the SubViewport pass rendering, if any.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { ROOT_POSITIONAL_SHADOW_ATLAS } from '../../godot/positionalShadowAtlas.js';
import { observeSceneCamera } from '../sceneRenderCamera.js';
import { fitScenePositionalShadows } from './fitScenePositionalShadows.js';
import { installPositionalShadowPass } from './positionalShadowPass.js';
import { activeShadowAtlas, ViewportShadowAtlas } from './viewportShadowAtlas.js';

/**
 * Fits `scene`'s declared lights before every render of it, until unmount. A render outside any
 * SubViewport pass is the main view's, which takes the root viewport's atlas. Null fits nothing.
 */
export function usePositionalShadowFit(scene: THREE.Scene | null): void {
  useEffect(() => {
    if (!scene) return undefined;
    const rootAtlas = new ViewportShadowAtlas(ROOT_POSITIONAL_SHADOW_ATLAS);
    const stopObserving = observeSceneCamera(scene, (camera) =>
      fitScenePositionalShadows(scene, camera, activeShadowAtlas() ?? rootAtlas, performance.now())
    );
    return () => {
      stopObserving();
      rootAtlas.dispose();
    };
  }, [scene]);
}

/**
 * Mounted once per canvas, for the canvas's own scene. Its renderer's shadow pass copies each omni
 * light's cube into the atlas, for every scene the renderer draws.
 */
export function PositionalShadowFitter() {
  const renderer = useThree((state) => state.gl);
  useEffect(() => installPositionalShadowPass(renderer), [renderer]);
  usePositionalShadowFit(useThree((state) => state.scene));
  return null;
}
