/**
 * The instances of a MultiMesh as one record each, for a draw that places a mesh instance by
 * instance, as the 2D canvas does. A draw that uploads attributes reads `instanceBuffer.ts`. No THREE.
 */

import { MultiMeshTransformFormat } from '../../../godot/scene/multiMesh.js';
import { instanceLayout, type DrawnInstances, type MultiMeshInstance } from './types.js';

/** The first `drawn.count` instances of `drawn.buffer`, in index order. */
export function multiMeshInstances(drawn: DrawnInstances): MultiMeshInstance[] {
  const { count, usesColors, usesCustomData } = drawn;
  const is3D = drawn.transformFormat === MultiMeshTransformFormat.TRANSFORM_3D;
  const { stride, colourOffset, customOffset } = instanceLayout(is3D, usesColors, usesCustomData);
  const buffer = drawn.buffer ?? new Float32Array(count * stride);
  return Array.from({ length: count }, (_unused, i) => {
    const at = i * stride;
    return {
      transform: buffer.subarray(at, at + colourOffset),
      color: usesColors ? buffer.subarray(at + colourOffset, at + customOffset) : null,
      customData: usesCustomData ? buffer.subarray(at + customOffset, at + stride) : null,
    };
  });
}
