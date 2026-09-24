/**
 * Re-export of the Curve3D slice (`resources/curves/curve3d/`) for import sites
 * outside it, such as the CSGPolygon3D slice's `tessellateCurve3D`,
 * `parseCurve3DPoints` and point types. New code imports the slice entry point,
 * which also registers its type claim.
 */

export { parseCurve3DPoints, tessellateCurve3D } from '../curves/curve3d/decode';
export type {
  Curve3DControlPoint,
  Curve3DSample,
  Curve3DSampler,
  Vec3,
} from '../curves/curve3d/types';
