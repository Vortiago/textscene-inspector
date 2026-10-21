/** Each expected hint is Godot 4.6.3's `lightmap_size_hint` after it loads the same properties. */

import { describe, expect, it } from 'vitest';
import { planeMeshLightmapSizeHint } from './lightmapSizeHint';
import { QUAD_MESH_DEFAULTS } from '../quadmesh/decode';

const TEXEL_SIZE = 0.2;

describe('planeMeshLightmapSizeHint', () => {
  it('sizes the hint from size over the texel size, plus the padding, truncated', () => {
    const data = { add_uv2: 'true', uv2_padding: '7.0', size: 'Vector2(3, 1.3)' };

    expect(planeMeshLightmapSizeHint(data, TEXEL_SIZE)).toEqual({ x: 22, y: 13 });
  });

  it('sizes a QuadMesh from its own default size', () => {
    expect(planeMeshLightmapSizeHint({ add_uv2: 'true' }, TEXEL_SIZE, QUAD_MESH_DEFAULTS)).toEqual({
      x: 7,
      y: 7,
    });
  });

  it('rewrites a stored hint that a later property change follows, as an editor-saved file orders them', () => {
    const data = {
      lightmap_size_hint: 'Vector2i(50, 60)',
      add_uv2: 'true',
      uv2_padding: '7.0',
      size: 'Vector2(3, 1.3)',
    };

    expect(planeMeshLightmapSizeHint(data, TEXEL_SIZE)).toEqual({ x: 22, y: 13 });
  });

  it('keeps a stored hint that comes after every change', () => {
    const data = {
      add_uv2: 'true',
      uv2_padding: '7.0',
      size: 'Vector2(3, 1.3)',
      lightmap_size_hint: 'Vector2i(50, 60)',
    };

    expect(planeMeshLightmapSizeHint(data, TEXEL_SIZE)).toEqual({ x: 50, y: 60 });
  });

  it('keeps a stored hint that only an unchanged size follows (edge case)', () => {
    const data = { add_uv2: 'true', lightmap_size_hint: 'Vector2i(50, 60)', size: 'Vector2(2, 2)' };

    expect(planeMeshLightmapSizeHint(data, TEXEL_SIZE)).toEqual({ x: 50, y: 60 });
  });

  it('floors the hint at one texel (edge case)', () => {
    const data = { add_uv2: 'true', uv2_padding: '0.0', size: 'Vector2(0.01, 0.01)' };

    expect(planeMeshLightmapSizeHint(data, TEXEL_SIZE)).toEqual({ x: 1, y: 1 });
  });

  it('is zero without add_uv2 and no stored hint (edge case)', () => {
    expect(planeMeshLightmapSizeHint({ size: 'Vector2(3, 1.3)' }, TEXEL_SIZE)).toEqual({ x: 0, y: 0 });
  });
});
