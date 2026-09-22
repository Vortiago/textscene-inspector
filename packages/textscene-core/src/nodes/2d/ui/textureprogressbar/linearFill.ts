/**
 * `TextureProgressBar`'s non-radial, non-nine-patch progress crop
 * (`texture_progress_bar.cpp:445-482`'s `draw_texture_rect_region` calls).
 * Reached only when `nine_patch_stretch` is false — a linear mode with it
 * true takes `draw_nine_patch_stretched` instead (`:452`'s own gate), so `s`
 * here is always `progress->get_size()`, never `get_size()`.
 *
 * Every branch's `region`/`source` share one SIZE (the ratio-scaled crop);
 * they differ only in position (`region` adds `progress_offset`) — an
 * unscaled crop-and-place, not a stretch.
 *
 * Pure TS, no React/THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';

export const FILL_LEFT_TO_RIGHT = 0;
export const FILL_RIGHT_TO_LEFT = 1;
export const FILL_TOP_TO_BOTTOM = 2;
export const FILL_BOTTOM_TO_TOP = 3;
export const FILL_BILINEAR_LEFT_AND_RIGHT = 6;
export const FILL_BILINEAR_TOP_AND_BOTTOM = 7;

export interface LinearProgressDraw {
  /** Where the cropped region draws, control-local Godot px (`progress_offset` folded in). */
  offset: Vec2;
  /** The drawn (== cropped) size. */
  size: Vec2;
  /** The texture-pixel-space crop window. */
  region: Rect2;
}

/** `null` for `FILL_MODE_MAX`/a radial mode (never reached — the caller only calls this for the six linear/bilinear modes). */
export function linearProgressDraw(
  mode: number | undefined,
  ratio: number,
  textureSize: Vec2,
  progressOffset: Vec2
): LinearProgressDraw | null {
  const s = textureSize;
  switch (mode) {
    case FILL_LEFT_TO_RIGHT: {
      const w = s.x * ratio;
      return { region: { x: 0, y: 0, w, h: s.y }, offset: { x: progressOffset.x, y: progressOffset.y }, size: { x: w, y: s.y } };
    }
    case FILL_RIGHT_TO_LEFT: {
      const w = s.x * ratio;
      const x = s.x - w;
      return {
        region: { x, y: 0, w, h: s.y },
        offset: { x: progressOffset.x + x, y: progressOffset.y },
        size: { x: w, y: s.y },
      };
    }
    case FILL_TOP_TO_BOTTOM: {
      const h = s.y * ratio;
      return { region: { x: 0, y: 0, w: s.x, h }, offset: { x: progressOffset.x, y: progressOffset.y }, size: { x: s.x, y: h } };
    }
    case FILL_BOTTOM_TO_TOP: {
      const h = s.y * ratio;
      const y = s.y - h;
      return {
        region: { x: 0, y, w: s.x, h },
        offset: { x: progressOffset.x, y: progressOffset.y + y },
        size: { x: s.x, y: h },
      };
    }
    case FILL_BILINEAR_LEFT_AND_RIGHT: {
      const w = s.x * ratio;
      const x = s.x / 2 - w / 2;
      return {
        region: { x, y: 0, w, h: s.y },
        offset: { x: progressOffset.x + x, y: progressOffset.y },
        size: { x: w, y: s.y },
      };
    }
    case FILL_BILINEAR_TOP_AND_BOTTOM: {
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
