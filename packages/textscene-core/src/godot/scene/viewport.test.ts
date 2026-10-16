import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NAMES,
  DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_NAMES,
  DefaultCanvasItemTextureFilter,
  VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER,
  viewportPositionalShadowAtlas,
} from './viewport';

describe('viewportPositionalShadowAtlas', () => {
  it('reads the authored size and quadrant subdivisions', () => {
    expect(viewportPositionalShadowAtlas(4096, [1, 2, 3, 6])).toEqual({
      size: 4096,
      quadrantShadows: [1, 4, 16, 1024],
    });
  });

  it('keeps the Viewport defaults where the scene authors nothing (edge case)', () => {
    expect(viewportPositionalShadowAtlas(undefined, [])).toEqual({
      size: 2048,
      quadrantShadows: [4, 4, 16, 64],
    });
  });

  it('keeps the default for a value the setter refuses (error case)', () => {
    expect(viewportPositionalShadowAtlas(-1, [7, -1, 2.5, undefined])).toEqual({
      size: 2048,
      quadrantShadows: [4, 4, 16, 64],
    });
  });
});

describe('Viewport.DefaultCanvasItemTextureFilter', () => {
  it('lists LINEAR_WITH_MIPMAPS before NEAREST_WITH_MIPMAPS (4.6.3 viewport.h:188-193)', () => {
    expect(DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NAMES).toEqual({
      0: 'NEAREST',
      1: 'LINEAR',
      2: 'LINEAR_WITH_MIPMAPS',
      3: 'NEAREST_WITH_MIPMAPS',
      4: 'PARENT_NODE',
    });
  });

  it('defaults to LINEAR (viewport.h:419)', () => {
    expect(VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER).toBe(DefaultCanvasItemTextureFilter.LINEAR);
  });
});

describe('Viewport.DefaultCanvasItemTextureRepeat', () => {
  it('puts PARENT_NODE last, unlike CanvasItem.TextureRepeat (4.7.2 viewport.h:201-206)', () => {
    expect(DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_NAMES).toEqual({
      0: 'DISABLED',
      1: 'ENABLED',
      2: 'MIRROR',
      3: 'PARENT_NODE',
    });
  });
});
