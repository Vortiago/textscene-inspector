/**
 * The offscreen buffers the 2D light pass accumulates `S` into, and their
 * lifetime. One per class, plus the two conditional variants (Light Only,
 * `shadow_color`); `CanvasLighting2D.tsx` says what each holds.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

function createAccumulationTarget(): THREE.WebGLRenderTarget {
  // Half-float so the accumulation stays unclamped, and NoColorSpace so three
  // writes the shader's raw sRGB-space value instead of re-encoding it.
  //
  // The stencil is what carries the shadows, and three defaults it OFF — the
  // masks would then stamp nothing and every quad's test would pass, which
  // renders as no shadows at all rather than as an error. WebGL2 allocates the
  // pair as one DEPTH24_STENCIL8 attachment, which coexists with a half-float
  // colour attachment, so the depth buffer comes along and is simply unused:
  // everything in the pass draws with `depthTest` off.
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
  // A cleanup belongs to an effect: a useMemo factory's return value is the
  // memoised VALUE, and React never calls it.
  useEffect(() => () => targets.forEach((target) => target.dispose()), [targets]);
  return targets;
}

/**
 * One accumulator per class `wanted` selects, aligned with the class indices and
 * `null` for the rest.
 *
 * Per class rather than canvas-wide because a `shadow_color` belongs to ONE
 * light and therefore to one class. Allocating for the others would spend a
 * screen-sized half-float target and a full-scene render per frame on a buffer
 * that can only ever come out black.
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
