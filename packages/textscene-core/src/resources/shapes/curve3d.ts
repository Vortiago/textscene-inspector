/**
 * Re-export shim over the Curve3D slice (`resources/curves/curve3d/`).
 *
 * Kept so import sites outside this slice's ownership — the CSGPolygon3D slice
 * reaches `tessellateCurve3D` / `parseCurve3DPoints` / the point types through
 * this path — keep resolving; new code imports the slice entry point, which also
 * registers its type claim.
 */

export { parseCurve3DPoints, tessellateCurve3D } from '../curves/curve3d/decode';
export type {
  Curve3DControlPoint,
  Curve3DSample,
  Curve3DSampler,
  Vec3,
} from '../curves/curve3d/types';
