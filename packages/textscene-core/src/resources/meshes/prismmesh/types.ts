import type { Vector3 } from '../../../godot/vector';

export interface PrismMeshProperties {
  leftToRight: number;
  size: Vector3;
  subdivideWidth: number;
  subdivideHeight: number;
  subdivideDepth: number;
}
