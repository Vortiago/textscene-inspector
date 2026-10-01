/**
 * Refits an omni or spot light's shadow before every render of its scene, until unmount: Godot
 * chooses the light's shadow slot for each camera that renders it.
 */

import { useEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { observeSceneCamera } from '../sceneRenderCamera.js';
import { fitPositionalShadow } from './fitPositionalShadow.js';

/** A ref that holds no light yet fits nothing. */
export function usePositionalShadowFit(
  lightRef: RefObject<THREE.PointLight | THREE.SpotLight | null>,
  softShadowScale: number
): void {
  const scene = useThree((state) => state.scene);
  useEffect(
    () =>
      observeSceneCamera(scene, (camera) => {
        const light = lightRef.current;
        if (light) fitPositionalShadow(light, camera, softShadowScale);
      }),
    [scene, lightRef, softShadowScale]
  );
}
