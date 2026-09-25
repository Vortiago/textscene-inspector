/**
 * The offscreen buffers the 2D light pass accumulates `S` into, and their lifetime: one per class,
 * plus the Light Only and `shadow_color` variants. `lightPassContext.ts` says what each holds.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

function createAccumulationTarget(): THREE.WebGLRenderTarget {
  // Half-float keeps the sum unclamped. NoColorSpace makes three write the raw sRGB-space value.
  // The stencil carries the shadows, and three's default of off renders silently as no shadows.
  // WebGL2 allocates one DEPTH24_STENCIL8 attachment beside the half-float colour, so the depth
  // buffer comes along unused: the pass draws with `depthTest` off.
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: true,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;
  rt.texture.wrapS = THREE.ClampToEdgeWrapping;
  rt.texture.wrapT = THREE.ClampToEdgeWrapping;
  return rt;
}

/** `count` accumulators, disposed together when the count changes. */
export function useAccumulationTargets(count: number): THREE.WebGLRenderTarget[] {
  const targets = useMemo(
    () => Array.from({ length: count }, createAccumulationTarget),
    [count]
  );
  // A cleanup belongs to an effect: React never calls a useMemo factory's return value.
  useEffect(() => () => targets.forEach((target) => target.dispose()), [targets]);
  return targets;
}

/**
 * One accumulator per class `wanted` selects, aligned with the class indices, `null` for the rest.
 * A `shadow_color` belongs to one light and so to one class, and a target for another class costs
 * a screen-sized buffer and a scene render per frame to come out black.
 */
export function useSelectedAccumulationTargets(
  wanted: readonly boolean[]
): readonly (THREE.WebGLRenderTarget | null)[] {
  const signature = wanted.map((on) => (on ? '1' : '0')).join('');
  const targets = useMemo(
    () => [...signature].map((on) => (on === '1' ? createAccumulationTarget() : null)),
    [signature]
  );
  useEffect(() => () => targets.forEach((target) => target?.dispose()), [targets]);
  return targets;
}
