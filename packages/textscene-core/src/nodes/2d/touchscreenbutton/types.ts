/** The TouchScreenButton property shape: the Node2D surface plus its idle texture and collision shape. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface TouchScreenButtonProperties extends Node2DProperties {
  /** `ExtResource("id")` or `SubResource("id")` reference; undefined or `null` → nothing drawn. */
  texture_normal?: string;
  /** Reference to a 2D collision-shape resource; undefined or `null` → no overlay. */
  shape?: string;
  /** The shape sits on the texture's centre (default true), else on the node origin. */
  shape_centered: boolean;
  /** The editor draws the shape over the button while this holds (default true). */
  shape_visible: boolean;
}
