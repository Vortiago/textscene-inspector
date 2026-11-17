/** The TouchScreenButton property shape: the Node2D surface plus its idle texture and collision shape. */

import type { Node2DProperties } from '../../base/node2d/types';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import type { TouchScreenButtonVisibilityMode } from '../../../godot/scene/canvasNodes';

export interface TouchScreenButtonProperties extends Node2DProperties {
  /** `ExtResource("id")` or `SubResource("id")` reference; undefined or `null` → nothing drawn. */
  texture_normal?: string;
  /** Reference to a 2D collision-shape resource; undefined or `null` → no overlay. */
  shape?: string;
  /** The shape sits on the texture's centre (default true), else on the node origin. */
  shape_centered: boolean;
  /** The editor draws the shape over the button while this holds (default true). */
  shape_visible: boolean;
  /** Whether the game draws the button always, or only where the platform has a touch screen. */
  visibility_mode: EnumValue<typeof TouchScreenButtonVisibilityMode>;
}
