/**
 * `TextureProgressBar`'s non-radial, non-nine-patch progress crop (the `draw_texture_rect_region` calls
 * in `texture_progress_bar.cpp:445-482`). With `nine_patch_stretch` a linear mode takes
 * `draw_nine_patch_stretched` (`:452`), so `s` here is always `progress->get_size()`. Each branch's `region`
 * and `source` share the ratio-scaled size, and `region` adds `progress_offset`: a crop-and-place, not a stretch.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import { FillMode } from './types';
import type { Vector2 } from '../../../../godot/vector';

interface LinearProgressDraw {
  /** Where the cropped region draws, control-local Godot px (`progress_offset` folded in). */
  offset: Vector2;
  /** The drawn (== cropped) size. */
  size: Vector2;
  /** The texture-pixel-space crop window. */
  region: Rect2;
}

/** `null` for `FILL_MODE_MAX` or a radial mode, which never reach here: the caller passes only the six linear and bilinear modes. */
export function linearProgressDraw(
  mode: number | undefined,
  ratio: number,
  textureSize: Vector2,
  progressOffset: Vector2
): LinearProgressDraw | null {
  const s = textureSize;
  switch (mode) {
    case FillMode.LEFT_TO_RIGHT: {
      const w = s.x * ratio;
      return {
        region: { x: 0, y: 0, w, h: s.y },
        offset: { x: progressOffset.x, y: progressOffset.y },
        size: { x: w, y: s.y },
      };
    }
    case FillMode.RIGHT_TO_LEFT: {
      const w = s.x * ratio;
      const x = s.x - w;
      return {
        region: { x, y: 0, w, h: s.y },
        offset: { x: progressOffset.x + x, y: progressOffset.y },
        size: { x: w, y: s.y },
      };
    }
    case FillMode.TOP_TO_BOTTOM: {
      const h = s.y * ratio;
      return {
        region: { x: 0, y: 0, w: s.x, h },
        offset: { x: progressOffset.x, y: progressOffset.y },
        size: { x: s.x, y: h },
      };
    }
    case FillMode.BOTTOM_TO_TOP: {
      const h = s.y * ratio;
      const y = s.y - h;
      return {
        region: { x: 0, y, w: s.x, h },
        offset: { x: progressOffset.x, y: progressOffset.y + y },
        size: { x: s.x, y: h },
      };
    }
    case FillMode.BILINEAR_LEFT_AND_RIGHT: {
      const w = s.x * ratio;
      const x = s.x / 2 - w / 2;
      return {
        region: { x, y: 0, w, h: s.y },
        offset: { x: progressOffset.x + x, y: progressOffset.y },
        size: { x: w, y: s.y },
      };
    }
    case FillMode.BILINEAR_TOP_AND_BOTTOM: {
      const h = s.y * ratio;
      const y = s.y / 2 - h / 2;
      return {
        region: { x: 0, y, w: s.x, h },
        offset: { x: progressOffset.x, y: progressOffset.y + y },
        size: { x: s.x, y: h },
      };
    }
    default:
      return null;
  }
}
