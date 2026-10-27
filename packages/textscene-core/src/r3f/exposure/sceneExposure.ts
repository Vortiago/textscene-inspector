/**
 * The exposure each scene renders with. A scene writes its world's factor into the shared emission
 * buffer for each render it takes and puts 1 back when the render ends, so each world, a
 * sub-viewport included, draws with its own.
 */

import { useLayoutEffect } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { EMISSION_EXPOSURE } from './emissionExposure.js';

/** Written only by `useSceneExposure`, and cleared when that scene's world unmounts. */
const exposures = new WeakMap<THREE.Scene, number>();

/** The factor `scene` renders with: 1 without a world that holds an exposure. */
export function exposureOfScene(scene: THREE.Scene): number {
  return exposures.get(scene) ?? 1;
}

/** Renders `scene` with `factor` until the returned function runs. */
function holdSceneExposure(scene: THREE.Scene, factor: number): () => void {
  exposures.set(scene, factor);
  const stopWriting = observeSceneCamera(scene, () => {
    EMISSION_EXPOSURE[0] = factor;
  });
  const stopClearing = observeSceneRenderEnd(scene, () => {
    EMISSION_EXPOSURE[0] = 1;
  });
  return () => {
    stopWriting();
    stopClearing();
    exposures.delete(scene);
  };
}

/**
 * Renders the scene of the enclosing world with `factor` until the world unmounts. A null factor
 * holds nothing: the emission buffer already reads 1 outside a render of a world that holds one.
 */
export function useSceneExposure(factor: number | null): void {
  const scene = useThree((state) => state.scene);
  // A layout effect, so the buffer changes in the commit that changes every light's intensity.
  useLayoutEffect(() => (factor === null ? undefined : holdSceneExposure(scene, factor)), [scene, factor]);
}
