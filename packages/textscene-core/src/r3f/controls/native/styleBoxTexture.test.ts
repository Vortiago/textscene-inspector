/**
 * `parseStyleBoxTexture` against `scene/resources/style_box_texture.h`/`.cpp`
 * (Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import { parseStyleBoxTexture } from './styleBoxTexture';

const internalResources: TscnInternalResource[] = [
  {
    id: 'Tex_full',
    type: 'StyleBoxTexture',
    data: {
      texture: 'ExtResource("1_tex")',
      texture_margin_left: '2',
      texture_margin_top: '3',
      texture_margin_right: '4',
      texture_margin_bottom: '5',
      content_margin_left: '10',
      content_margin_top: '11',
      content_margin_right: '12',
      content_margin_bottom: '13',
      expand_margin_left: '1',
      expand_margin_top: '2',
      expand_margin_right: '3',
      expand_margin_bottom: '4',
      region_rect: 'Rect2(1, 2, 64, 32)',
      axis_stretch_horizontal: '1',
      axis_stretch_vertical: '2',
      draw_center: 'false',
      modulate_color: 'Color(1, 0, 0, 0.5)',
    },
  },
  { id: 'Tex_empty', type: 'StyleBoxTexture', data: {} },
  {
    id: 'Tex_content_margin_diverges',
    type: 'StyleBoxTexture',
    data: { texture_margin_left: '4', content_margin_left: '9' },
  },
  { id: 'StyleBoxFlat_x', type: 'StyleBoxFlat', data: {} },
];

describe('parseStyleBoxTexture', () => {
  it('resolves every field of a fully-specified StyleBoxTexture SubResource', () => {
    const box = parseStyleBoxTexture('SubResource("Tex_full")', [], internalResources);
    expect(box).toEqual({
      texture: 'ExtResource("1_tex")',
      resources: { externalResources: [], internalResources },
      margin: { left: 2, top: 3, right: 4, bottom: 5 },
      contentMargin: { left: 10, top: 11, right: 12, bottom: 13 },
      expandMargin: { left: 1, top: 2, right: 3, bottom: 4 },
      regionRect: { x: 1, y: 2, width: 64, height: 32 },
      axisStretchHorizontal: 1,
      axisStretchVertical: 2,
      drawCenter: false,
      modulateColor: { r: 1, g: 0, b: 0, a: 0.5 },
    });
  });

  it('falls back to style_box_texture.h defaults for every absent key', () => {
    const box = parseStyleBoxTexture('SubResource("Tex_empty")', [], internalResources);
    expect(box).toEqual({
      texture: undefined,
      resources: { externalResources: [], internalResources },
      margin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      regionRect: undefined,
      axisStretchHorizontal: 0,
      axisStretchVertical: 0,
      drawCenter: true,
      modulateColor: { r: 1, g: 1, b: 1, a: 1 },
    });
  });

  it('falls content_margin back to texture_margin when content_margin is absent (the -1 sentinel, StyleBoxTexture::get_style_margin)', () => {
    const resources: TscnInternalResource[] = [
      { id: 'Tex_margin_only', type: 'StyleBoxTexture', data: { texture_margin_left: '7' } },
    ];
    const box = parseStyleBoxTexture('SubResource("Tex_margin_only")', [], resources);
    expect(box?.contentMargin.left).toBe(7);
    expect(box?.margin.left).toBe(7);
  });

  it('keeps content_margin and texture_margin independent once content_margin is authored', () => {
    const box = parseStyleBoxTexture('SubResource("Tex_content_margin_diverges")', [], internalResources);
    expect(box?.margin.left).toBe(4);
    expect(box?.contentMargin.left).toBe(9);
  });

  it('degrades to null for an absent ref, a non-SubResource form, an unknown id, and a non-StyleBoxTexture resource', () => {
    expect(parseStyleBoxTexture(undefined, [], internalResources)).toBeNull();
    expect(parseStyleBoxTexture('ExtResource("1_abc")', [], internalResources)).toBeNull();
    expect(parseStyleBoxTexture('SubResource("nope")', [], internalResources)).toBeNull();
    expect(parseStyleBoxTexture('SubResource("StyleBoxFlat_x")', [], internalResources)).toBeNull();
  });
});
