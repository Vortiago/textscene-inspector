import type { Rect2 } from '../../godot/math/rect2';

/**
 * The arguments of `canvas_item_add_texture_rect_region` (`renderer_canvas_cull.cpp:1624`) with a
 * white modulate and no transpose: a negative rect size flips that axis.
 */
export interface CanvasRectRegion {
  /** In the item's pixels. */
  readonly rect: Rect2;
  /** In the texture's texels. */
  readonly source: Rect2;
  readonly clipUv: boolean;
}
