import type * as THREE from 'three';

/**
 * The raw lanes `attribute` stores at each of `vertices`: `getComponent` would denormalise them.
 *
 * @canonical The stored values of an attribute at a list of vertices
 */
export function storedLanes(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertices: ArrayLike<number>
): THREE.TypedArray {
  const { itemSize } = attribute;
  const interleaved = attribute as THREE.InterleavedBufferAttribute;
  const [lanes, stride, offset] = interleaved.isInterleavedBufferAttribute
    ? [interleaved.data.array, interleaved.data.stride, interleaved.offset]
    : [(attribute as THREE.BufferAttribute).array, itemSize, 0];
  const values = new (lanes.constructor as new (length: number) => THREE.TypedArray)(
    vertices.length * itemSize
  );
  for (let at = 0; at < vertices.length; at++)
    for (let lane = 0; lane < itemSize; lane++)
      values[at * itemSize + lane] = lanes[vertices[at]! * stride + offset + lane]!;
  return values;
}
