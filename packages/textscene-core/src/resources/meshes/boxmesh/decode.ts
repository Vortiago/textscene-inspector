/** BoxMesh decode: property bag in, box size and subdivisions out. */

import type { BoxMeshProperties } from './types';
import { vec3Or } from '../../../parser/valueParsers';
import { flooredCount } from '../meshCounts';
import { storedVector3 } from '../../../godot/math/real';

export function decodeBoxMesh(properties: Record<string, string>): BoxMeshProperties {
  return {
    // `size` is a `Vector3` of `real_t`, so it holds single precision.
    size: storedVector3(vec3Or(properties.size, { x: 1, y: 1, z: 1 }, 'BoxMesh size')),
    subdivideWidth: flooredCount(properties.subdivide_width, 0, 0, 'BoxMesh subdivideWidth'),
    subdivideHeight: flooredCount(properties.subdivide_height, 0, 0, 'BoxMesh subdivideHeight'),
    subdivideDepth: flooredCount(properties.subdivide_depth, 0, 0, 'BoxMesh subdivideDepth'),
  };
}
