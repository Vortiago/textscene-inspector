import type { Rect2 } from '../../../godot/math/rect2.js';
import { parseOptionalRect2 } from '../../../parser/valueParsers.js';

/** back_buffer_copy.cpp:49-55, with the default `rect` of back_buffer_copy.h:46. */
export function backBufferCopyEditRect(raw: Readonly<Record<string, string>>): Rect2 {
  const rect = parseOptionalRect2(raw.rect);
  return rect
    ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    : { x: -100, y: -100, w: 200, h: 200 };
}
