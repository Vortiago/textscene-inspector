import { rect2Intersection, type Rect2 } from '../../godot/math/rect2';
import type { AtlasCellRects } from '../../resources/useTexture2D';

/** `canvas_item_add_texture_rect_region` with a white modulate (`renderer_canvas_cull.cpp:1624`). */
export interface CanvasRectRegion {
  /** In the item's pixels. */
  readonly rect: Rect2;
  /** In the texture's texels. */
  readonly source: Rect2;
  readonly clipUv: boolean;
}

/** `AtlasTexture::get_rect_region` (`atlas_texture.cpp:193-224`): the rect on the atlas, or null for none. */
export function atlasRectRegion(
  { rect, source }: CanvasRectRegion,
  atlas: AtlasCellRects
): CanvasRectRegion | null {
  const { cell, region } = atlas;
  const size = source.w === 0 && source.h === 0 ? { w: region.w, h: region.h } : { w: source.w, h: source.h };
  const scaleX = rect.w / size.w;
  const scaleY = rect.h / size.h;
  const moved = { x: source.x + cell.x, y: source.y + cell.y, ...size };
  const clipped = rect2Intersection(
    { x: cell.x + region.x, y: cell.y + region.y, w: region.w, h: region.h },
    moved
  );
  if (clipped.w === 0 && clipped.h === 0) return null;
  const offsetX = clipped.x - moved.x + (scaleX < 0 ? clipped.w - moved.w : 0);
  const offsetY = clipped.y - moved.y + (scaleY < 0 ? clipped.h - moved.h : 0);
  return {
    rect: {
      x: rect.x + offsetX * scaleX,
      y: rect.y + offsetY * scaleY,
      w: clipped.w * scaleX,
      h: clipped.h * scaleY,
    },
    source: clipped,
    clipUv: atlas.filterClip,
  };
}
