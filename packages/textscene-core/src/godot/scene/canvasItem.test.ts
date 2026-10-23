import { describe, expect, it } from 'vitest';
import {
  CANVAS_ITEM_TEXTURE_FILTER_NAMES,
  CANVAS_ITEM_TEXTURE_REPEAT_NAMES,
  CANVAS_ITEM_CLIP_CHILDREN_MODE_NAMES,
  CANVAS_ITEM_CLIP_CHILDREN_MODE_COUNT,
  CanvasItemClipChildrenMode,
  CanvasItemTextureFilter,
  CanvasItemTextureRepeat,
  canvasItemSamplerFilter,
  canvasItemSamplerRepeat,
} from './canvasItem';
import { TextureFilter } from '../rendering/materials/textureFilter';

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

  it('maps each concrete filter to the BaseMaterial3D filter of the same name', () => {
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.NEAREST)).toBe(TextureFilter.NEAREST);
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.LINEAR)).toBe(TextureFilter.LINEAR);
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.NEAREST_WITH_MIPMAPS)).toBe(
      TextureFilter.NEAREST_WITH_MIPMAPS
    );
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC)).toBe(
      TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC
    );
  });

  it('samples linearly for a resolved PARENT_NODE, an out-of-range value and no filter', () => {
    expect(canvasItemSamplerFilter(CanvasItemTextureFilter.PARENT_NODE)).toBe(TextureFilter.LINEAR);
    expect(canvasItemSamplerFilter(7)).toBe(TextureFilter.LINEAR);
    expect(canvasItemSamplerFilter(undefined)).toBe(TextureFilter.LINEAR);
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

describe('CanvasItem clip children mode', () => {
  it('names the three modes before CLIP_CHILDREN_MAX (canvas_item.h:71-75)', () => {
    expect(CANVAS_ITEM_CLIP_CHILDREN_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'ONLY', 2: 'AND_DRAW' });
  });

  it('counts the modes as CLIP_CHILDREN_MAX does, one past AND_DRAW (edge case)', () => {
    expect(CANVAS_ITEM_CLIP_CHILDREN_MODE_COUNT).toBe(CanvasItemClipChildrenMode.AND_DRAW + 1);
  });
});

describe('canvasItemSamplerRepeat (canvas_item.h:63-69)', () => {
  it('maps ENABLED to repeat and MIRROR to mirror', () => {
    expect(canvasItemSamplerRepeat(CanvasItemTextureRepeat.ENABLED)).toBe('repeat');
    expect(canvasItemSamplerRepeat(CanvasItemTextureRepeat.MIRROR)).toBe('mirror');
  });

  it('maps DISABLED to clamp', () => {
    expect(canvasItemSamplerRepeat(CanvasItemTextureRepeat.DISABLED)).toBe('clamp');
  });

  it('clamps where the repeat defers to a parent or is absent (edge case, canvas_item.h:122)', () => {
    expect(canvasItemSamplerRepeat(CanvasItemTextureRepeat.PARENT_NODE)).toBe('clamp');
    expect(canvasItemSamplerRepeat(undefined)).toBe('clamp');
  });
});
