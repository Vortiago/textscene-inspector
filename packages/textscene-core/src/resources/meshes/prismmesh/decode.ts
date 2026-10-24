import type { PrismMeshProperties } from './types';
import { floatOr, realVec3Or } from '../../../parser/valueParsers';
import { flooredCount } from '../meshCounts';

export function decodePrismMesh(properties: Record<string, string>): PrismMeshProperties {
  return {
    leftToRight: floatOr(properties.left_to_right, 0.5, 'PrismMesh leftToRight'),
    // `size` is a `Vector3` of `real_t`, so it holds single precision.
    size: realVec3Or(properties.size, { x: 1, y: 1, z: 1 }, 'PrismMesh size'),
    subdivideWidth: flooredCount(properties.subdivide_width, 0, 0, 'PrismMesh subdivideWidth'),
    subdivideHeight: flooredCount(properties.subdivide_height, 0, 0, 'PrismMesh subdivideHeight'),
    subdivideDepth: flooredCount(properties.subdivide_depth, 0, 0, 'PrismMesh subdivideDepth'),
  };
}
