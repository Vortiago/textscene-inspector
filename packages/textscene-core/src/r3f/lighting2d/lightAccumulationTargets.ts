/**
 * The offscreen targets the 2D light pass accumulates `S` into, and their lifetime: one per item
 * light list, whose attachments hold its buffers (`ListAttachments`), and one layered target for the
 * lights of a list kept apart. `lightPassContext.ts` says what each holds.
 */

import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import * as THREE from 'three';

/** The shape of one target: its attachments, and the layers of an array target, null for a plain one. */
interface TargetShape {
  readonly attachments: number;
  readonly layers: number | null;
}

/** A plain target for a null `layers`, else an array target of that many layers. */
function createAccumulationTarget(
  type: THREE.TextureDataType,
  { attachments, layers }: TargetShape
): THREE.WebGLRenderTarget {
  // NoColorSpace writes the raw sRGB-space value.
  // The pass draws with `depthTest` off and samples its shadows, so it needs no depth or stencil.
  const options = { type, depthBuffer: false, stencilBuffer: false, count: attachments };
  const rt =
    layers === null
      ? new THREE.WebGLRenderTarget(1, 1, options)
      : new THREE.WebGLArrayRenderTarget(1, 1, layers, options);
  for (const texture of rt.textures) {
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
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
 * The targets a signature names, one per line: an id, the attachment count and, for an array
 * target, the layer count, tab-separated. No id holds a newline or a tab. They are disposed together
 * when the signature changes: a list set changes only when a light or a placement does, so
 * rebuilding them all then costs less than tracking each.
 */
function useTargets(signature: string): ReadonlyMap<string, THREE.WebGLRenderTarget> {
  const type = useThree((state) => accumulatorType(state.gl));
  const accumulation = useMemo(() => {
    const targets = new Map(
      signature
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [id, attachments, layers] = line.split('\t') as [string, string, string | undefined];
          const shape = {
            attachments: Number(attachments),
            layers: layers === undefined ? null : Number(layers),
          };
          return [id, createAccumulationTarget(type, shape)];
        })
    );
    return { targets, dispose: () => targets.forEach((target) => target.dispose()) };
  }, [signature, type]);
  useDisposeOnRelease(accumulation);
  return accumulation.targets;
}

/** One target per id, with its count of attachments. Keyed on the joined shapes, since a caller rebuilds the map every render. */
export function useAccumulationTargets(
  attachments: ReadonlyMap<string, number>
): ReadonlyMap<string, THREE.WebGLRenderTarget> {
  return useTargets([...attachments].map(([id, count]) => `${id}\t${count}`).join('\n'));
}

/** One array target per id, with its count of layers and attachments. */
export function useLayeredAccumulationTargets(
  shapes: ReadonlyMap<string, { layers: number; attachments: number }>
): ReadonlyMap<string, THREE.WebGLArrayRenderTarget> {
  const signature = [...shapes]
    .map(([id, { attachments, layers }]) => `${id}\t${attachments}\t${layers}`)
    .join('\n');
  return useTargets(signature) as ReadonlyMap<string, THREE.WebGLArrayRenderTarget>;
}
