/**
 * The target a 3D viewport under BG_CANVAS draws its backdrop canvas into, which the world shows as
 * its background. Made on the first draw that wants it, and freed by the first draw that does not.
 */

import { useCallback, useMemo } from 'react';
import type * as THREE from 'three';
import type { CanvasColorSpace } from '../../../r3f/canvasColorSpace';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { createSceneTarget } from './offscreenViewport';

/** Holds the target of one set of inputs: a change of inputs makes a new, empty holder and frees this one. */
class TargetHolder {
  private target: THREE.WebGLRenderTarget | null = null;

  constructor(private readonly create: () => THREE.WebGLRenderTarget) {}

  get(): THREE.WebGLRenderTarget {
    return (this.target ??= this.create());
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
  }
}

/** Answers the target when `wanted`, made at the first call and again after a resize, else null. */
export function useBackdropTarget(
  width: number,
  height: number,
  name: string,
  space: CanvasColorSpace
): (wanted: boolean) => THREE.WebGLRenderTarget | null {
  const holder = useMemo(
    () => new TargetHolder(() => createSceneTarget(width, height, `${name}::canvas`, space)),
    [width, height, name, space]
  );
  useDisposeOnRelease(holder);
  return useCallback(
    (wanted: boolean) => {
      if (wanted) return holder.get();
      holder.dispose();
      return null;
    },
    [holder]
  );
}
