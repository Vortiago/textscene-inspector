import type { TrailMeshBase } from '../primitivemesh/trailDecode';

/** TubeTrailMesh properties, as `decode.ts` reads them. */
export interface TubeTrailMeshProperties extends TrailMeshBase {
  radius: number;
  /** Steps round the tube. */
  radialSteps: number;
  /** Rings in each section. */
  sectionRings: number;
  /** Godot `cap_top` and `cap_bottom`: whether each end cap is built. */
  capTop: boolean;
  capBottom: boolean;
}
