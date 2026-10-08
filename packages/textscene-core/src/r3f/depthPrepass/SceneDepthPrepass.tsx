/** Mounts the depth prepass sentinel in a scene for as long as the scene renders. */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { createDepthPrepassSentinel } from './depthPrepass';

/** Draws `scene`'s depth prepass before each of its opaque passes, until unmount. Null draws none. */
export function useSceneDepthPrepass(scene: THREE.Scene | null): void {
  useEffect(() => {
    if (!scene) return undefined;
    const sentinel = createDepthPrepassSentinel();
    scene.add(sentinel);
    return () => {
      scene.remove(sentinel);
      sentinel.geometry.dispose();
      (sentinel.material as THREE.Material).dispose();
    };
  }, [scene]);
}

/** Mounted once per canvas, for the canvas's own scene. */
export function SceneDepthPrepass() {
  useSceneDepthPrepass(useThree((state) => state.scene));
  return null;
}
