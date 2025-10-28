import type { Vector2 } from '../../../parser/vectors';

export interface PlaneMeshProperties {
  size: Vector2;
  subdivideWidth: number;
  subdivideDepth: number;
  orientation: number;
}
