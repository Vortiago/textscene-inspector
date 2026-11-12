/** OccluderPolygon2D slice types. */

import type { OccluderCullMode } from '../../../r3f/lighting2d/shadowVolumes';

export interface OccluderPolygon2DData {
  /** Flat `[x0, y0, x1, y1, …]` in raw Godot 2D space (+Y down). */
  polygon: Float32Array;
  isClosed: boolean;
  cullMode: OccluderCullMode;
}
