/**
 * The offscreen buffers the 2D light pass accumulates `S` into, and their lifetime: one per item
 * light list, plus the Light Only and `shadow_color` variants and the layers of lights kept apart.
 * `lightPassContext.ts` says what each holds.
 */

import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import * as THREE from 'three';

/** A plain target for a null `layers`, else an array target of that many layers. */
function createAccumulationTarget(
  type: THREE.TextureDataType,
  layers: number | null
): THREE.WebGLRenderTarget {
  // NoColorSpace writes the raw sRGB-space value.
  // The stencil carries the shadows, and three's default of off renders silently as no shadows.
  // WebGL2 allocates one DEPTH24_STENCIL8 attachment beside the colour, so the depth buffer comes
  // along unused: the pass draws with `depthTest` off.
  const options = { type, depthBuffer: true, stencilBuffer: true };
  const rt =
    layers === null
      ? new THREE.WebGLRenderTarget(1, 1, options)
      : new THREE.WebGLArrayRenderTarget(1, 1, layers, options);
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
 * `EXT_float_blend` and filters one only with `OES_texture_float_linear`, both absent on some
 * mobile GPUs, so those keep a half float.
 */
function accumulatorType(gl: THREE.WebGLRenderer): THREE.TextureDataType {
  const canBlendAndFilter =
    gl.extensions.has('EXT_float_blend') && gl.extensions.has('OES_texture_float_linear');
  return canBlendAndFilter ? THREE.FloatType : THREE.HalfFloatType;
}

/**
 * The targets a signature names, one per line: an id, and after a tab the layer count of an array
 * target. No id holds a newline or a tab. They are disposed together when the signature changes:
 * a list set changes only when a light or a placement does, so rebuilding them all then costs less
 * than tracking each.
 */
function useTargets(signature: string): ReadonlyMap<string, THREE.WebGLRenderTarget> {
  const type = useThree((state) => accumulatorType(state.gl));
  const accumulation = useMemo(() => {
    const targets = new Map(
      signature
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [id, layers] = line.split('\t') as [string, string | undefined];
          return [id, createAccumulationTarget(type, layers === undefined ? null : Number(layers))];
        })
    );
    return { targets, dispose: () => targets.forEach((target) => target.dispose()) };
  }, [signature, type]);
  useDisposeOnRelease(accumulation);
  return accumulation.targets;
}

/** One accumulator per id. Keyed on the joined ids, since a caller rebuilds the array every render. */
export function useAccumulationTargets(ids: readonly string[]): ReadonlyMap<string, THREE.WebGLRenderTarget> {
  return useTargets(ids.join('\n'));
}

/** One array accumulator per id, with its count of layers. */
export function useLayeredAccumulationTargets(
  layers: ReadonlyMap<string, number>
): ReadonlyMap<string, THREE.WebGLArrayRenderTarget> {
  const signature = [...layers].map(([id, count]) => `${id}\t${count}`).join('\n');
  return useTargets(signature) as ReadonlyMap<string, THREE.WebGLArrayRenderTarget>;
}
