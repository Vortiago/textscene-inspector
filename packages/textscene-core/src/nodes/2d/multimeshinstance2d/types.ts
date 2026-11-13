/** The MultiMeshInstance2D property shape: a MultiMesh drawn on the 2D canvas, on Node2D. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface MultiMeshInstance2DProperties extends Node2DProperties {
  /** `SubResource("id")` or `ExtResource("id")` MultiMesh reference; undefined draws nothing. */
  multimesh?: string;
  /** `ExtResource("id")` or `SubResource("id")` texture reference; undefined draws white. */
  texture?: string;
}
