/**
 * Re-export of the Curve3D slice (`resources/curves/curve3d/`) for import sites
 * outside it, such as the CSGPolygon3D slice's `tessellateCurve3D`,
 * `decodeCurve3D` and point types. New code imports the slice entry point,
 * which also registers its type claim.
 */

export { decodeCurve3D, tessellateCurve3D } from '../curves/curve3d/decode';
export type {
  Curve3DControlPoint,
  Curve3DSample,
  Curve3DSampler,
  Vec3,
} from '../curves/curve3d/types';
