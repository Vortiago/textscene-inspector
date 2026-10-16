import { describe, expect, it } from 'vitest';
import {
  CANVAS_ITEM_TEXTURE_FILTER_NAMES,
  CANVAS_ITEM_TEXTURE_REPEAT_NAMES,
  CanvasItemTextureFilter,
  CanvasItemTextureRepeat,
  canvasItemSamplerFilter,
} from './canvasItem';

describe('CanvasItem texture filter', () => {
  it('prepends PARENT_NODE to the seven filters (canvas_item.h:52-60)', () => {
    expect(CANVAS_ITEM_TEXTURE_FILTER_NAMES).toEqual({
      0: 'PARENT_NODE',
      1: 'NEAREST',
      2: 'LINEAR',
      3: 'NEAREST_WITH_MIPMAPS',
      4: 'LINEAR_WITH_MIPMAPS',
      5: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
      6: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
    });
  });

  it('samples every nearest variant nearest', () => {
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.NEAREST)).toBe('nearest');
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.NEAREST_WITH_MIPMAPS)).toBe('nearest');
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC)).toBe('nearest');
  });

  it('samples every linear variant, and a resolved PARENT_NODE, linearly', () => {
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.LINEAR)).toBe('linear');
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC)).toBe('linear');
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.PARENT_NODE)).toBe('linear');
  });

  it('samples linearly where no ancestor sets a filter (edge case)', () => {
    expect(canvasItemSamplerFilter(undefined)).toBe('linear');
  });
});

describe('CanvasItem texture repeat', () => {
  it('prepends PARENT_NODE to the three repeats (canvas_item.h:63-69)', () => {
    expect(CANVAS_ITEM_TEXTURE_REPEAT_NAMES).toEqual({
      0: 'PARENT_NODE',
      1: 'DISABLED',
      2: 'ENABLED',
      3: 'MIRROR',
    });
    expect(CanvasItemTextureRepeat.MIRROR).toBe(3);
  });
});
