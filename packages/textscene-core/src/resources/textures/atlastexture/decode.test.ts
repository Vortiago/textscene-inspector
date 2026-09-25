/**
 * AtlasTexture decode and layout, against `scene/resources/atlas_texture.cpp`:
 * `set_region` (:92-99) floors the size, `get_width`/`get_height` (:33-53) add
 * `margin.size` or fall back to the atlas, `_get_region_rect` (:126-137) does the
 * same, and `draw` (:158-164) places the rect at `margin.position`.
 */

import { describe, expect, it } from 'vitest';
import { atlasTextureLayout, decodeAtlasTexture } from './decode';

describe('decodeAtlasTexture', () => {
  it('reads atlas, region, margin and filter_clip', () => {
    const parsed = decodeAtlasTexture({
      atlas: 'ExtResource("1_sheet")',
      region: 'Rect2(96, 0, 32, 32)',
      margin: 'Rect2(8, 6, 16, 20)',
      filter_clip: 'true',
    });

    expect(parsed).toEqual({
      atlas: 'ExtResource("1_sheet")',
      region: { x: 96, y: 0, width: 32, height: 32 },
      margin: { x: 8, y: 6, width: 16, height: 20 },
      filterClip: true,
    });
  });

  it('defaults an omitted region/margin/filter_clip to Godot’s own (Rect2(), Rect2(), false)', () => {
    expect(decodeAtlasTexture({ atlas: 'ExtResource("1")' })).toEqual({
      atlas: 'ExtResource("1")',
      region: { x: 0, y: 0, width: 0, height: 0 },
      margin: { x: 0, y: 0, width: 0, height: 0 },
      filterClip: false,
    });
  });

  it('reads a malformed region as the zero rect and a missing atlas as null', () => {
    expect(decodeAtlasTexture({ region: 'Rect2(1, 2)' })).toEqual({
      atlas: null,
      region: { x: 0, y: 0, width: 0, height: 0 },
      margin: { x: 0, y: 0, width: 0, height: 0 },
      filterClip: false,
    });
  });
});

describe('atlasTextureLayout', () => {
  const tex = (region: string, margin?: string) =>
    decodeAtlasTexture(margin ? { region, margin } : { region });

  it('reports the region as the whole texture when there is no margin', () => {
    expect(atlasTextureLayout(tex('Rect2(0, 0, 64, 64)'), { width: 128, height: 128 })).toEqual({
      width: 64,
      height: 64,
      source: { x: 0, y: 0, width: 64, height: 64 },
      dest: { x: 0, y: 0 },
    });
  });

  it('samples the region at its own offset in the atlas', () => {
    expect(atlasTextureLayout(tex('Rect2(32, 32, 64, 64)'), { width: 128, height: 128 })).toEqual({
      width: 64,
      height: 64,
      source: { x: 32, y: 32, width: 64, height: 64 },
      dest: { x: 0, y: 0 },
    });
  });

  it('floors the region SIZE and the sampled POSITION', () => {
    // Godot floors only the size (`set_region`, :97); the position stays
    // fractional there, but a pixel crop has to land on whole texels.
    expect(atlasTextureLayout(tex('Rect2(10.5, 20.75, 32.9, 16.2)'), { width: 128, height: 128 })).toEqual({
      width: 32,
      height: 16,
      source: { x: 10, y: 20, width: 32, height: 16 },
      dest: { x: 0, y: 0 },
    });
  });

  it('adds margin.size to the reported box and places the region at margin.position', () => {
    expect(
      atlasTextureLayout(tex('Rect2(96, 0, 32, 32)', 'Rect2(8, 6, 16, 20)'), {
        width: 128,
        height: 128,
      })
    ).toEqual({
      width: 48,
      height: 52,
      source: { x: 96, y: 0, width: 32, height: 32 },
      dest: { x: 8, y: 6 },
    });
  });

  it('falls back to the atlas size on a zero-size axis, WITHOUT adding that margin', () => {
    // `get_width` returns `atlas->get_width()` on a zero region axis (:34-38),
    // without the `+ margin.size` term.
    expect(
      atlasTextureLayout(tex('Rect2(0, 0, 0, 0)', 'Rect2(2, 3, 10, 20)'), { width: 128, height: 256 })
    ).toEqual({
      width: 128,
      height: 256,
      source: { x: 0, y: 0, width: 128, height: 256 },
      dest: { x: 2, y: 3 },
    });
  });

  it('substitutes per AXIS, so a zero width still reports a margined height', () => {
    expect(
      atlasTextureLayout(tex('Rect2(0, 0, 0, 48)', 'Rect2(0, 0, 4, 6)'), { width: 128, height: 256 })
    ).toEqual({
      width: 128,
      height: 54,
      source: { x: 0, y: 0, width: 128, height: 48 },
      dest: { x: 0, y: 0 },
    });
  });

  it('cannot answer a zero-size axis without the atlas size', () => {
    expect(atlasTextureLayout(tex('Rect2(0, 0, 0, 48)'), null)).toBeNull();
    // Both axes authored, so the atlas is not consulted at all.
    expect(atlasTextureLayout(tex('Rect2(4, 8, 16, 24)'), null)).toEqual({
      width: 16,
      height: 24,
      source: { x: 4, y: 8, width: 16, height: 24 },
      dest: { x: 0, y: 0 },
    });
  });

  it('declines a region that rounds away to nothing on either axis', () => {
    expect(atlasTextureLayout(tex('Rect2(0, 0, -5, 10)'), { width: 128, height: 128 })).toBeNull();
    expect(atlasTextureLayout(tex('Rect2(0, 0, 16, 16)', 'Rect2(0, 0, -32, 0)'), { width: 128, height: 128 })).toBeNull();
  });
});
