/**
 * The scene-level system that fits every declared directional shadow to the camera of each
 * render of a scene. Godot fits a directional shadow to whichever camera renders, so the fit
 * rides `scene.onBeforeRender`: the main view, a SubViewport pass and a screenshot each get
 * their own fit, whatever order they render in.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { observeSceneCamera } from '../sceneRenderCamera.js';
import { fitSceneDirectionalShadows } from './fitSceneDirectionalShadows.js';

/** Fits `scene`'s declared lights before every render of it, until unmount. */
export function useDirectionalShadowFit(scene: THREE.Scene): void {
  useEffect(
    () => observeSceneCamera(scene, (camera) => fitSceneDirectionalShadows(scene, camera)),
    [scene]
  );
}

/** Mounted once per canvas, for the canvas's own scene. */
export function DirectionalShadowFitter() {
  useDirectionalShadowFit(useThree((state) => state.scene));
  return null;
}
