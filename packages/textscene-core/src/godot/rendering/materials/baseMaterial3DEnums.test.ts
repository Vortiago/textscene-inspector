import { describe, expect, it } from 'vitest';
import { BLEND_MODE_NAMES } from './blendMode';
import { CULL_MODE_NAMES, CullMode } from './cullMode';
import { DEPTH_DRAW_MODE_NAMES, DepthDrawMode } from './depthDrawMode';
import { DEPTH_TEST_NAMES, DepthTest } from './depthTest';
import { DISTANCE_FADE_MODE_NAMES, DistanceFadeMode } from './distanceFadeMode';
import { SHADING_MODE_NAMES, ShadingMode } from './shadingMode';
import {
  STENCIL_COMPARE_NAMES,
  STENCIL_FLAG_LABELS,
  STENCIL_MODE_NAMES,
  StencilCompare,
  StencilFlag,
  StencilMode,
} from './stencil';
import { TRANSPARENCY_NAMES, Transparency } from './transparency';

/** The BaseMaterial3D enums of `scene/resources/material.h:187-352`, as the integers a `.tscn` stores. */
describe('BaseMaterial3D enums', () => {
  it('stores Transparency in the order of material.h:187-193', () => {
    expect(TRANSPARENCY_NAMES).toEqual({
      0: 'DISABLED',
      1: 'ALPHA',
      2: 'ALPHA_SCISSOR',
      3: 'ALPHA_HASH',
      4: 'ALPHA_DEPTH_PRE_PASS',
    });
    expect(Transparency.ALPHA_DEPTH_PRE_PASS).toBe(4);
  });

  it('names the five blend modes of material.h:227-233', () => {
    expect(BLEND_MODE_NAMES).toEqual({ 0: 'MIX', 1: 'ADD', 2: 'SUB', 3: 'MUL', 4: 'PREMULT_ALPHA' });
  });

  it('stores CullMode as BACK, FRONT, DISABLED (material.h:249-254)', () => {
    expect(CULL_MODE_NAMES).toEqual({ 0: 'BACK', 1: 'FRONT', 2: 'DISABLED' });
    expect(CullMode.DISABLED).toBe(2);
  });

  it('stores DepthDrawMode as OPAQUE_ONLY, ALWAYS, DISABLED (material.h:236-241)', () => {
    expect(DEPTH_DRAW_MODE_NAMES).toEqual({ 0: 'OPAQUE_ONLY', 1: 'ALWAYS', 2: 'DISABLED' });
    expect(DepthDrawMode.OPAQUE_ONLY).toBe(0);
  });

  it('stores DepthTest as DEFAULT, INVERTED (material.h:243-247)', () => {
    expect(DEPTH_TEST_NAMES).toEqual({ 0: 'DEFAULT', 1: 'INVERTED' });
    expect(DepthTest.INVERTED).toBe(1);
  });

  it('stores ShadingMode as UNSHADED, PER_PIXEL, PER_VERTEX (material.h:203-207)', () => {
    expect(SHADING_MODE_NAMES).toEqual({ 0: 'UNSHADED', 1: 'PER_PIXEL', 2: 'PER_VERTEX' });
    expect(ShadingMode.PER_PIXEL).toBe(1);
  });

  it('stores DistanceFadeMode in the order of material.h:323-329', () => {
    expect(DISTANCE_FADE_MODE_NAMES).toEqual({
      0: 'DISABLED',
      1: 'PIXEL_ALPHA',
      2: 'PIXEL_DITHER',
      3: 'OBJECT_DITHER',
    });
    expect(DistanceFadeMode.OBJECT_DITHER).toBe(3);
  });

  it('stores StencilMode in the order of material.h:331-337', () => {
    expect(STENCIL_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'OUTLINE', 2: 'XRAY', 3: 'CUSTOM' });
    expect(StencilMode.CUSTOM).toBe(3);
  });

  it('stores StencilCompare in the order of material.h:347-355', () => {
    expect(STENCIL_COMPARE_NAMES).toEqual({
      0: 'ALWAYS',
      1: 'LESS',
      2: 'EQUAL',
      3: 'LESS_OR_EQUAL',
      4: 'GREATER',
      5: 'NOT_EQUAL',
      6: 'GREATER_OR_EQUAL',
    });
    expect(StencilCompare.GREATER_OR_EQUAL).toBe(6);
  });

  it('stores StencilFlag as the bits 1, 2 and 4 (material.h:339-344)', () => {
    expect(STENCIL_FLAG_LABELS).toEqual({ 1: 'READ', 2: 'WRITE', 4: 'WRITE_DEPTH_FAIL' });
    expect(StencilFlag.WRITE_DEPTH_FAIL).toBe(4);
  });
});
