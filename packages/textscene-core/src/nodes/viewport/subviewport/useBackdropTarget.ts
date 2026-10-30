/**
 * The target a 3D viewport under BG_CANVAS draws its backdrop canvas into, which the world shows as
 * its background. Made on the first draw that wants it, and freed by the first draw that does not.
 */

import { useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { createSceneTarget } from './offscreenViewport';

/** Answers the target when `wanted`, made at the first call and again after a resize, else null. */
export function useBackdropTarget(
  width: number,
  height: number,
  name: string
): (wanted: boolean) => THREE.WebGLRenderTarget | null {
  const held = useRef<THREE.WebGLRenderTarget | null>(null);
  const release = useCallback(() => {
    held.current?.dispose();
    held.current = null;
  }, []);
  useEffect(() => release, [release, width, height, name]);
  return useCallback(
    (wanted: boolean) => {
      if (!wanted) release();
      else held.current ??= createSceneTarget(width, height, `${name}::canvas`);
      return held.current;
    },
    [release, width, height, name]
  );
}
