import type { Vector2, Vector3 } from '../../../godot/vector';

export interface PlaneMeshProperties {
  size: Vector2;
  subdivideWidth: number;
  subdivideDepth: number;
  orientation: number;
  centerOffset?: Vector3;
  flipFaces: boolean;
}
