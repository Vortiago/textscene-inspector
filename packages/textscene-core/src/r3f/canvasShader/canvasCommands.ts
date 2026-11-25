import type { Rect2 } from '../../godot/math/rect2';

/** `canvas_item_add_texture_rect_region` with a white modulate (`renderer_canvas_cull.cpp:1624`). */
export interface CanvasRectRegion {
  /** In the item's pixels. */
  readonly rect: Rect2;
  /** In the texture's texels. */
  readonly source: Rect2;
  readonly clipUv: boolean;
}
