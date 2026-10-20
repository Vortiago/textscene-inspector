/** The TouchScreenButton property shape: the Node2D surface plus its idle texture. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface TouchScreenButtonProperties extends Node2DProperties {
  /** `ExtResource("id")` or `SubResource("id")` reference; undefined or `null` → nothing drawn. */
  texture_normal?: string;
}
