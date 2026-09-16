/**
 * `hexCodeBoxAdvanceSize`/`hexCodeBoxRects` vs Godot 4.6.3
 * (`servers/text/text_server.cpp:737-812`). Expected numbers are hand-derived
 * from the ported formula against the Godot source, never the implementation's
 * own output.
 */
import { describe, expect, it } from 'vitest';
import { hexCodeBoxAdvanceSize, hexCodeBoxRects } from './hexCodeBox';

describe('hexCodeBoxAdvanceSize — TextServer::get_hex_code_box_size (text_server.cpp:737-742)', () => {
  it('a one-byte codepoint (<=0xFF) at fontSize 15 (cellPx=1): x=(4+3*1+0+1)*1=8, y=15*1=15', () => {
    expect(hexCodeBoxAdvanceSize(15, 0x01)).toEqual({ x: 8, y: 15 });
  });

  it('a two-byte codepoint (<=0xFFFF) at fontSize 15: x=(4+3*2+1+1)*1=12, y=15', () => {
    expect(hexCodeBoxAdvanceSize(15, 0x1234)).toEqual({ x: 12, y: 15 });
  });

  it('a three-byte codepoint (>0xFFFF) at fontSize 15: x=(4+3*3+2+1)*1=16, y=15', () => {
    expect(hexCodeBoxAdvanceSize(15, 0x10000)).toEqual({ x: 16, y: 15 });
  });

  it('cellPx floors at 1 for a tiny font (round(4/15)=0, MAX(1,0)=1) — fontSize 4, one byte: x=8, y=15', () => {
    expect(hexCodeBoxAdvanceSize(4, 0x01)).toEqual({ x: 8, y: 15 });
  });

  it('cellPx scales with font size — fontSize 30 (round(30/15)=2), one byte: x=8*2=16, y=15*2=30', () => {
    expect(hexCodeBoxAdvanceSize(30, 0x01)).toEqual({ x: 16, y: 30 });
  });
});

describe('hexCodeBoxRects — TextServer::draw_hex_code_box/_draw_hex_code_box_number (text_server.cpp:771-812)', () => {
  it('draws nothing for a non-positive codepoint (the index==0 guard, :772-774)', () => {
    expect(hexCodeBoxRects(15, 0)).toEqual([]);
  });

  it('the four frame rects sit at the drawn (ONE CELL NARROWER than advance) size, shifted up by 85% of the height', () => {
    // fontSize 15 -> cellPx=1; one-byte codepoint -> sizeX=(4+3+0)*1=7, sizeY=15*1=15, originY=-15*0.85=-12.75.
    const rects = hexCodeBoxRects(15, 0x00 + 1); // 0x01: a=1 ("1" digit, 2 segments), b=0 ("0" digit, 6 segments)
    const [left, right, top, bottom] = rects;
    expect(left).toEqual({ x: 0, y: -12.75, w: 1, h: 15 });
    expect(right).toEqual({ x: 6, y: -12.75, w: 1, h: 15 });
    expect(top).toEqual({ x: 0, y: -12.75, w: 7, h: 1 });
    expect(bottom).toEqual({ x: 0, y: 1.25, w: 7, h: 1 });
  });

  it('digit "0" (segment mask 0x7E) draws its 6 segments, digit "1" (0x30) draws 2 — codepoint 0x01 totals 4 frame + 6 + 2 = 12 rects', () => {
    expect(hexCodeBoxRects(15, 0x01)).toHaveLength(4 + 6 + 2);
  });

  it('a two-byte codepoint draws FOUR digits (4 nibbles) on top of the same 4-rect frame', () => {
    // 0x00FF: a=0xF (0x71, 5 segments), b=0x0 (0x7E, 6), c=0x0 (0x7E, 6), d=0x0 (0x7E, 6) -- wait d/c read from bits 8-15, both 0 for 0x00FF.
    // Use 0x1234 instead so every nibble is distinct and non-degenerate to avoid hand-picking a coincidental zero.
    const rects = hexCodeBoxRects(15, 0x1234);
    // 4 frame + 4 digits, each with a nonzero segment count (every nibble 1/2/3/4 has >=2 segments).
    expect(rects.length).toBeGreaterThanOrEqual(4 + 4 * 2);
  });

  it('a three-byte codepoint draws SIX digits on top of the same 4-rect frame', () => {
    const rects = hexCodeBoxRects(15, 0x123456);
    expect(rects.length).toBeGreaterThanOrEqual(4 + 6 * 2);
  });

  it("the advance size is exactly one cell wider than the drawn frame's own width — the gap between consecutive boxes", () => {
    const advance = hexCodeBoxAdvanceSize(15, 0x01);
    const [, , top] = hexCodeBoxRects(15, 0x01);
    expect(advance.x).toBe(top!.w + 1);
  });
});
