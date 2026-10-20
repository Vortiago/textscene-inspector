import { describe, expect, it } from 'vitest';
import {
  ANISOTROPIC_FILTERING_NAMES,
  DEBUG_DRAW_NAMES,
  DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NAMES,
  DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_NAMES,
  DefaultCanvasItemTextureFilter,
  VIEWPORT_DEFAULT_CANVAS_ITEM_TEXTURE_FILTER,
  POSITIONAL_SHADOW_ATLAS_QUADRANT_SUBDIV_NAMES,
  SCALING_3D_MODE_NAMES,
  SCREEN_SPACE_AA_NAMES,
  SUB_VIEWPORT_CLEAR_MODE_NAMES,
  SUB_VIEWPORT_UPDATE_MODE_NAMES,
  SubViewportUpdateMode,
  SDF_OVERSIZE_NAMES,
  SDF_SCALE_NAMES,
  viewportPositionalShadowAtlas,
  VRS_MODE_NAMES,
  VRS_UPDATE_MODE_NAMES,
} from './viewport';

describe('viewportPositionalShadowAtlas', () => {
  it('counts the shadows each subdivision label names, 0 for Disabled', () => {
    for (const [value, label] of Object.entries(POSITIONAL_SHADOW_ATLAS_QUADRANT_SUBDIV_NAMES)) {
      const subdiv = Number(value);
      expect(viewportPositionalShadowAtlas(undefined, [subdiv]).quadrantShadows[0]).toBe(
        label === 'DISABLED' ? 0 : Number(label)
      );
    }
  });

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

describe('Viewport enum label tables (viewport.h:99-234)', () => {
  it('names the screen space AA modes before SCREEN_SPACE_AA_MAX', () => {
    expect(SCREEN_SPACE_AA_NAMES).toEqual({ 0: 'DISABLED', 1: 'FXAA', 2: 'SMAA' });
  });

  it('names the SDF oversize and scale steps as Godot spells them', () => {
    expect(SDF_OVERSIZE_NAMES).toEqual({
      0: '100_PERCENT',
      1: '120_PERCENT',
      2: '150_PERCENT',
      3: '200_PERCENT',
    });
    expect(SDF_SCALE_NAMES).toEqual({ 0: '100_PERCENT', 1: '50_PERCENT', 2: '25_PERCENT' });
  });

  it('names a shadow atlas quadrant subdivision by its shadow count', () => {
    expect(POSITIONAL_SHADOW_ATLAS_QUADRANT_SUBDIV_NAMES).toEqual({
      0: 'DISABLED',
      1: '1',
      2: '4',
      3: '16',
      4: '64',
      5: '256',
      6: '1024',
    });
  });

  it('names the anisotropic filtering levels', () => {
    expect(ANISOTROPIC_FILTERING_NAMES).toEqual({ 0: 'DISABLED', 1: '2X', 2: '4X', 3: '8X', 4: '16X' });
  });

  it('names the 3D scaling modes, with NEAREST last from 4.7.2 (viewport.h:99-107)', () => {
    expect(SCALING_3D_MODE_NAMES).toEqual({
      0: 'BILINEAR',
      1: 'FSR',
      2: 'FSR2',
      3: 'METALFX_SPATIAL',
      4: 'METALFX_TEMPORAL',
      5: 'NEAREST',
    });
  });

  it('names the VRS modes and update modes', () => {
    expect(VRS_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'TEXTURE', 2: 'XR' });
    expect(VRS_UPDATE_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'ONCE', 2: 'ALWAYS' });
  });

  it('names the debug draw modes from DISABLED to AREA_LIGHT_ATLAS (edge case: no MAX sentinel)', () => {
    expect(Object.keys(DEBUG_DRAW_NAMES)).toHaveLength(29);
    expect(DEBUG_DRAW_NAMES[0]).toBe('DISABLED');
    expect(DEBUG_DRAW_NAMES[26]).toBe('INTERNAL_BUFFER');
  });

  it('adds the two area light debug draws after INTERNAL_BUFFER in 4.7.2 (viewport.h:188-189)', () => {
    expect(DEBUG_DRAW_NAMES[27]).toBe('CLUSTER_AREA_LIGHTS');
    expect(DEBUG_DRAW_NAMES[28]).toBe('AREA_LIGHT_ATLAS');
  });
});

describe('SubViewport enum label tables (viewport.h:871-883)', () => {
  it('names the update modes with WHEN_VISIBLE at 2', () => {
    expect(SUB_VIEWPORT_UPDATE_MODE_NAMES).toEqual({
      0: 'DISABLED',
      1: 'ONCE',
      2: 'WHEN_VISIBLE',
      3: 'WHEN_PARENT_VISIBLE',
      4: 'ALWAYS',
    });
    expect(SubViewportUpdateMode.WHEN_VISIBLE).toBe(2);
  });

  it('names the clear modes', () => {
    expect(SUB_VIEWPORT_CLEAR_MODE_NAMES).toEqual({ 0: 'ALWAYS', 1: 'NEVER', 2: 'ONCE' });
  });
});
