import type { Curve } from '../../curves/curve/types';

/** TubeTrailMesh properties, as `decode.ts` reads them. */
export interface TubeTrailMeshProperties {
  radius: number;
  /** Steps round the tube. */
  radialSteps: number;
  sections: number;
  sectionLength: number;
  /** Rings in each section. */
  sectionRings: number;
  /** Godot `cap_top` and `cap_bottom`: whether each end cap is built. */
  capTop: boolean;
  capBottom: boolean;
  /** Scales the radius along the tube. Null for no curve, which the tube reads as a scale of 1. */
  curve: Curve | null;
}
