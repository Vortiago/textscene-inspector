import type { Vector2, Vector3 } from '../../../godot/math/vector';
import type { PlaneMeshOrientation } from '../../../godot/scene/planeMesh.js';

export interface PlaneMeshProperties {
  size: Vector2;
  subdivideWidth: number;
  subdivideDepth: number;
  orientation: PlaneMeshOrientation;
  centerOffset?: Vector3;
  flipFaces: boolean;
}
