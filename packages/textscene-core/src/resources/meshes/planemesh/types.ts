import type { Vector2, Vector3 } from '../../../godot/math/vector';
import type { PlaneMeshOrientation } from '../../../godot/scene/planeMesh.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export interface PlaneMeshProperties {
  size: Vector2;
  subdivideWidth: number;
  subdivideDepth: number;
  orientation: EnumValue<typeof PlaneMeshOrientation>;
  centerOffset: Vector3;
}
