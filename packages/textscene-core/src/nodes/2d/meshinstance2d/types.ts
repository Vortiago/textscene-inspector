/** The MeshInstance2D property shape: a mesh drawn on the canvas, on Node2D. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface MeshInstance2DProperties extends Node2DProperties {
  /** `SubResource("id")` or `ExtResource("id")` mesh reference; undefined or `null` draws nothing. */
  mesh?: string;
  /** `ExtResource("id")` or `SubResource("id")` texture reference; undefined or `null` draws white. */
  texture?: string;
}
