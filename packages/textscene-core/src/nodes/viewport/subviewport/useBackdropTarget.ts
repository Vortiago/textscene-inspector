/**
 * The target a 3D viewport under BG_CANVAS draws its backdrop canvas into, which the world shows as
 * its background. Made on the first draw that wants it, so no other mode holds one.
 */

import { useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { createSceneTarget } from './offscreenViewport';

/** Answers the target, made at the first call and made again after a resize. */
export function useBackdropTarget(
  width: number,
  height: number,
  name: string
): () => THREE.WebGLRenderTarget {
  const held = useRef<THREE.WebGLRenderTarget | null>(null);
  useEffect(
    () => () => {
      held.current?.dispose();
      held.current = null;
    },
    [width, height, name]
  );
  return useCallback(
    () => (held.current ??= createSceneTarget(width, height, `${name}::canvas`)),
    [width, height, name]
  );
}
