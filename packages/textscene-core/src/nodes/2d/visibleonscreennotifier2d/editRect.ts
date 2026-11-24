import type { Rect2 } from '../../../godot/math/rect2.js';
import { boolOr, parseOptionalRect2 } from '../../../parser/valueParsers.js';

/** visible_on_screen_notifier_2d.cpp:52-58. Null is `show_rect` off, so `_edit_use_rect` is false. */
export function visibleOnScreenNotifier2DEditRect(raw: Readonly<Record<string, string>>): Rect2 | null {
  if (!boolOr(raw.show_rect, true)) return null;
  const rect = parseOptionalRect2(raw.rect);
  return rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : { x: -10, y: -10, w: 20, h: 20 };
}
