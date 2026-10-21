/** CylinderMesh properties, as `decode.ts` reads them. */

export interface CylinderMeshProperties {
  topRadius: number;
  bottomRadius: number;
  height: number;
  radialSegments: number;
  rings: number;
  /** Godot `cap_top` and `cap_bottom`: whether each end cap is built. */
  capTop: boolean;
  capBottom: boolean;
}
