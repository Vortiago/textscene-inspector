import type { Vector2, Vector3 } from '../../../parser/vectors';

export interface PlaneMeshProperties {
  size: Vector2;
  subdivideWidth: number;
  subdivideDepth: number;
  orientation: number;
  centerOffset?: Vector3;
  flipFaces: boolean;
}
