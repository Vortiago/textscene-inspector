import type { Vector3 } from '../../../parser/vectors';

export interface PrismMeshProperties {
  leftToRight: number;
  size: Vector3;
  subdivideWidth: number;
  subdivideHeight: number;
  subdivideDepth: number;
}
