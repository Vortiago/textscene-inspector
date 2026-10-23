import type { TrailMeshBase } from '../primitivemesh/trailDecode';

/** RibbonTrailMesh properties, as `decode.ts` reads them. */
export interface RibbonTrailMeshProperties extends TrailMeshBase {
  /** Godot `shape == SHAPE_CROSS`: a second ribbon across the first. Any other `shape` is flat. */
  isCross: boolean;
  /** The width of the ribbon before the curve scales it. */
  size: number;
  /** Segments in each section. */
  sectionSegments: number;
}
