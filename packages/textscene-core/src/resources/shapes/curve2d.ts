/**
 * Re-export shim over the Curve2D slice (`resources/curves/curve2d/`).
 *
 * Kept so import sites outside this slice's ownership keep resolving; new code
 * imports the slice entry point, which also registers its type claim.
 */

export { parseCurve2DPoints, tessellateCurve2D } from '../curves/curve2d/decode';
export type {
  Curve2DControlPoint,
  Curve2DSample,
  Curve2DSampler,
  Vec2,
} from '../curves/curve2d/types';
