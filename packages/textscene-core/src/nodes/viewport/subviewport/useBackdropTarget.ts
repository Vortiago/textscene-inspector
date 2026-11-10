/**
 * The target a 3D viewport under BG_CANVAS draws its backdrop canvas into, which the world shows as
 * its background. Made on the first draw that wants it, and freed by the first draw that does not.
 */

import { useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import type { CanvasColorSpace } from '../../../r3f/canvasColorSpace';
import { createSceneTarget } from './offscreenViewport';

/** A held target with the inputs it was made from, so a draw after a change never reads a stale one. */
interface HeldTarget {
  target: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  name: string;
  space: CanvasColorSpace;
}

/** Answers the target when `wanted`, made at the first call and again after a resize, else null. */
export function useBackdropTarget(
  width: number,
  height: number,
  name: string,
  space: CanvasColorSpace
): (wanted: boolean) => THREE.WebGLRenderTarget | null {
  const held = useRef<HeldTarget | null>(null);
  const release = useCallback(() => {
    held.current?.target.dispose();
    held.current = null;
  }, []);
  useEffect(() => release, [release]);
  return useCallback(
    (wanted: boolean) => {
      if (!wanted) {
        release();
        return null;
      }
      const current = held.current;
      if (
        current &&
        (current.width !== width ||
          current.height !== height ||
          current.name !== name ||
          current.space !== space)
      )
        release();
      held.current ??= {
        target: createSceneTarget(width, height, `${name}::canvas`, space),
        width,
        height,
        name,
        space,
      };
      return held.current.target;
    },
    [release, width, height, name, space]
  );
}
