/**
 * The offscreen buffers the 2D light pass accumulates `S` into, and their lifetime: one per item
 * light list, plus the Light Only and `shadow_color` variants. `lightPassContext.ts` says what each
 * holds.
 */

import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import * as THREE from 'three';

function createAccumulationTarget(type: THREE.TextureDataType): THREE.WebGLRenderTarget {
  // NoColorSpace writes the raw sRGB-space value.
  // The stencil carries the shadows, and three's default of off renders silently as no shadows.
  // WebGL2 allocates one DEPTH24_STENCIL8 attachment beside the colour, so the depth buffer comes
  // along unused: the pass draws with `depthTest` off.
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type,
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
 * 32-bit float, as the canvas shader sums its lights (canvas.glsl:727-760): unclamped, and no
 * half-float conversion, which lavapipe truncates. WebGL2 blends into a float attachment only with
 * `EXT_float_blend`, absent on some mobile GPUs, so those keep a half float.
 */
function accumulatorType(gl: THREE.WebGLRenderer): THREE.TextureDataType {
  return gl.extensions.has('EXT_float_blend') ? THREE.FloatType : THREE.HalfFloatType;
}

/**
 * One accumulator per id, disposed together when the set of ids changes. A list set changes only
 * when a light or a placement does, so rebuilding them all then costs less than tracking each.
 */
export function useAccumulationTargets(ids: readonly string[]): ReadonlyMap<string, THREE.WebGLRenderTarget> {
  // Keyed on the joined ids, since a caller rebuilds the array every render. No id holds a newline.
  const signature = ids.join('\n');
  const type = useThree((state) => accumulatorType(state.gl));
  const accumulation = useMemo(() => {
    const targets = new Map(
      signature
        .split('\n')
        .filter(Boolean)
        .map((id) => [id, createAccumulationTarget(type)])
    );
    return { targets, dispose: () => targets.forEach((target) => target.dispose()) };
  }, [signature, type]);
  useDisposeOnRelease(accumulation);
  return accumulation.targets;
}
