/** `styleBoxDrawHeight` is the height of each StyleBox kind's `get_draw_rect`, which sets the flip's translation. */
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../../parser/types';
import { parseStyleBox, type ResolvedStyleBox } from '../../../../r3f/controls/native/parseStyleBox';
import { NODE_PROPERTY } from '../../../../resources/useTexture2D';
import { styleBoxDrawHeight } from './FlippableStyleBox';

const HEIGHT = 30;

function box(type: string, data: Record<string, string>): ResolvedStyleBox {
  const resource: TscnInternalResource = { id: 'Box_1', type, data };
  return parseStyleBox('SubResource("Box_1")', [], [resource], NODE_PROPERTY)!;
}

describe('styleBoxDrawHeight', () => {
  it('grows a flat box by its top and bottom expand margins (style_box_flat.cpp:445)', () => {
    const flat = box('StyleBoxFlat', { expand_margin_top: '3.0', expand_margin_bottom: '2.0' });
    expect(styleBoxDrawHeight(flat, HEIGHT)).toBe(35);
  });

  it("merges a flat box's shadow, grown by shadow_size and moved by shadow_offset (style_box_flat.cpp:447-451)", () => {
    const shadowed = box('StyleBoxFlat', { shadow_size: '4', shadow_offset: 'Vector2(0, 6)' });
    // The shadow spans -4 + 6 to 30 + 4 + 6, so the union runs from 0 to 40.
    expect(styleBoxDrawHeight(shadowed, HEIGHT)).toBe(40);
  });

  it('grows a texture box by its expand margins (style_box_texture.cpp:161-163)', () => {
    const texture = box('StyleBoxTexture', { expand_margin_top: '3.0', expand_margin_bottom: '2.0' });
    expect(styleBoxDrawHeight(texture, HEIGHT)).toBe(35);
  });

  it('keeps the rect for a line box, the base StyleBox::get_draw_rect (style_box.cpp:96-102)', () => {
    const line = box('StyleBoxLine', { grow_begin: '5.0', thickness: '4' });
    expect(styleBoxDrawHeight(line, HEIGHT)).toBe(HEIGHT);
  });
});
