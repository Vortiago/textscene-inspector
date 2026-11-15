/** `styleBoxDrawRect` is each StyleBox kind's `get_draw_rect`. */
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import type { Rect2 } from '../../../godot/math/rect2';
import { parseStyleBox, type ResolvedStyleBox } from './parseStyleBox';
import { styleBoxDrawRect } from './styleBoxDrawRect';

const RECT: Rect2 = { x: 10, y: 20, w: 40, h: 30 };

function box(type: string, data: Record<string, string>): ResolvedStyleBox {
  const resource: TscnInternalResource = { id: 'Box_1', type, data };
  return parseStyleBox('SubResource("Box_1")', [], [resource], true)!;
}

describe('styleBoxDrawRect', () => {
  it('grows a flat box by each expand margin (style_box_flat.cpp:445)', () => {
    const flat = box('StyleBoxFlat', {
      expand_margin_left: '1.0',
      expand_margin_top: '3.0',
      expand_margin_bottom: '2.0',
    });
    expect(styleBoxDrawRect(flat, RECT)).toEqual({ x: 9, y: 17, w: 41, h: 35 });
  });

  it("merges a flat box's shadow, grown by shadow_size and moved by shadow_offset (style_box_flat.cpp:447-451)", () => {
    const shadowed = box('StyleBoxFlat', { shadow_size: '4', shadow_offset: 'Vector2(0, 6)' });
    // The shadow spans y 20 - 4 + 6 to 50 + 4 + 6, so the union runs from 20 to 60.
    expect(styleBoxDrawRect(shadowed, RECT)).toEqual({ x: 6, y: 20, w: 48, h: 40 });
  });

  it('grows a texture box by its expand margins (style_box_texture.cpp:161-163)', () => {
    const texture = box('StyleBoxTexture', { expand_margin_top: '3.0', expand_margin_bottom: '2.0' });
    expect(styleBoxDrawRect(texture, RECT)).toEqual({ x: 10, y: 17, w: 40, h: 35 });
  });

  it('keeps the rect for a line box, the base StyleBox::get_draw_rect (style_box.cpp:96-102)', () => {
    const line = box('StyleBoxLine', { grow_begin: '5.0', thickness: '4' });
    expect(styleBoxDrawRect(line, RECT)).toEqual(RECT);
  });
});
