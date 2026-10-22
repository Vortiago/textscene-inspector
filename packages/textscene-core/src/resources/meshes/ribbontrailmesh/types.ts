import type { Curve } from '../../curves/curve/types';

/** RibbonTrailMesh properties, as `decode.ts` reads them. */
export interface RibbonTrailMeshProperties {
  /** Godot `shape == SHAPE_CROSS`: a second ribbon across the first. Any other `shape` is flat. */
  isCross: boolean;
  /** The width of the ribbon before the curve scales it. */
  size: number;
  sections: number;
  sectionLength: number;
  /** Segments in each section. */
  sectionSegments: number;
  /** Scales the width along the ribbon. Null for no curve, which the ribbon reads as a scale of 1. */
  curve: Curve | null;
}
