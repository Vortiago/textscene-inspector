/**
 * Port of `TextServer::get_hex_code_box_size`/`draw_hex_code_box`/
 * `_draw_hex_code_box_number` (`servers/text/text_server.cpp:737-812`): the box of
 * 7-segment hex digits a control character draws as under `preserve_control`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Vec2 } from '../rect';
import { round as godotRound } from '../../../../godot/math';

// Pure geometry in `shaped_text_draw`'s pen-relative space: `(0, 0)` is the glyph's
// advance-box origin on the baseline, and the box extends up and right from it
// (`pos = p_pos - Point2i(0, size.y * 0.85)`). `TextRun.tsx` places rects from there.
export interface HexCodeBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** `w`/`sp`/`sz` (`text_server.cpp:737-742,771-778`), shared by the advance size and the drawn geometry. */
function hexCodeBoxCells(fontSizePx: number, codepoint: number): { byteWidth: number; spacer: number; cellPx: number } {
  const byteWidth = codepoint <= 0xff ? 1 : codepoint <= 0xffff ? 2 : 3;
  const spacer = Math.max(0, byteWidth - 1);
  const cellPx = Math.max(1, godotRound(fontSizePx / 15));
  return { byteWidth, spacer, cellPx };
}

/**
 * `TextServer::get_hex_code_box_size` (`:737-742`): the advance the shaper
 * reserves. The `+ 1` makes it one cell wider than the drawn frame, the gap
 * Godot leaves between one hex box and the next.
 */
export function hexCodeBoxAdvanceSize(fontSizePx: number, codepoint: number): Vec2 {
  const { byteWidth, spacer, cellPx } = hexCodeBoxCells(fontSizePx, codepoint);
  return { x: (4 + 3 * byteWidth + spacer + 1) * cellPx, y: 15 * cellPx };
}

/** `text_server.cpp:745-767`: the bitmask of a 7-segment digit's rectangles (top/upper-right/lower-right/bottom/lower-left/upper-left/middle), one entry per hex nibble 0x0-0xF. */
const HEX_DIGIT_SEGMENTS = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b, 0x77, 0x1f, 0x4e, 0x3d, 0x4f, 0x47];

/** `TextServer::_draw_hex_code_box_number` (`:745-767`), one digit at `(x, y)`, cell size `sz`. */
function hexDigitRects(x: number, y: number, sz: number, nibble: number): HexCodeBoxRect[] {
  const seg = HEX_DIGIT_SEGMENTS[nibble] ?? 0;
  const rects: HexCodeBoxRect[] = [];
  if (seg & (1 << 6)) rects.push({ x, y, w: 3 * sz, h: sz });
  if (seg & (1 << 5)) rects.push({ x: x + 2 * sz, y, w: sz, h: 3 * sz });
  if (seg & (1 << 4)) rects.push({ x: x + 2 * sz, y: y + 2 * sz, w: sz, h: 3 * sz });
  if (seg & (1 << 3)) rects.push({ x, y: y + 4 * sz, w: 3 * sz, h: sz });
  if (seg & (1 << 2)) rects.push({ x, y: y + 2 * sz, w: sz, h: 3 * sz });
  if (seg & (1 << 1)) rects.push({ x, y, w: sz, h: 3 * sz });
  if (seg & (1 << 0)) rects.push({ x, y: y + 2 * sz, w: 3 * sz, h: sz });
  return rects;
}

/**
 * `TextServer::draw_hex_code_box` (`:771-812`): the four frame borders, then
 * 2/4/6 digits (two nibbles per codepoint byte) at fixed cell offsets.
 * `codepoint <= 0` draws nothing, the source's `index == 0` guard (`:772-774`).
 */
export function hexCodeBoxRects(fontSizePx: number, codepoint: number): HexCodeBoxRect[] {
  if (codepoint <= 0) return [];
  const { byteWidth, spacer, cellPx } = hexCodeBoxCells(fontSizePx, codepoint);
  const sizeX = (4 + 3 * byteWidth + spacer) * cellPx;
  const sizeY = 15 * cellPx;
  const originY = -sizeY * 0.85;

  const rects: HexCodeBoxRect[] = [
    { x: 0, y: originY, w: cellPx, h: sizeY },
    { x: sizeX - cellPx, y: originY, w: cellPx, h: sizeY },
    { x: 0, y: originY, w: sizeX, h: cellPx },
    { x: 0, y: originY + sizeY - cellPx, w: sizeX, h: cellPx },
  ];

  const nibble = (n: number): number => (codepoint >> (n * 4)) & 0xf;
  const digit = (col: number, row: number, value: number): void => {
    rects.push(...hexDigitRects(col * cellPx, originY + row * cellPx, cellPx, value));
  };
  if (codepoint <= 0xff) {
    digit(2, 2, nibble(1));
    digit(2, 8, nibble(0));
  } else if (codepoint <= 0xffff) {
    digit(2, 2, nibble(3));
    digit(6, 2, nibble(2));
    digit(2, 8, nibble(1));
    digit(6, 8, nibble(0));
  } else {
    digit(2, 2, nibble(5));
    digit(6, 2, nibble(4));
    digit(10, 2, nibble(3));
    digit(2, 8, nibble(2));
    digit(6, 8, nibble(1));
    digit(10, 8, nibble(0));
  }
  return rects;
}
