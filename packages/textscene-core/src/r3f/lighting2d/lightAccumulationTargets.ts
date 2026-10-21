/**
 * The offscreen buffers the 2D light pass accumulates `S` into, and their lifetime: one per item
 * light list, plus the Light Only and `shadow_color` variants. `lightPassContext.ts` says what each
 * holds.
 */

import { useMemo } from 'react';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
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

/**
 * One accumulator per id, disposed together when the set of ids changes. A list set changes only
 * when a light or a placement does, so rebuilding them all then costs less than tracking each.
 */
export function useAccumulationTargets(ids: readonly string[]): ReadonlyMap<string, THREE.WebGLRenderTarget> {
  // Keyed on the joined ids, since a caller rebuilds the array every render. No id holds a newline.
  const signature = ids.join('\n');
  const accumulation = useMemo(() => {
    const targets = new Map(
      signature
        .split('\n')
        .filter(Boolean)
        .map((id) => [id, createAccumulationTarget()])
    );
    return { targets, dispose: () => targets.forEach((target) => target.dispose()) };
  }, [signature]);
  useDisposeOnRelease(accumulation);
  return accumulation.targets;
}
