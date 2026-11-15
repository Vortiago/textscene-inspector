/** What a sub-viewport's properties ask of its target. */
import { describe, expect, it } from 'vitest';

import { viewportCanvasColorSpace, viewportMsaaMode, viewportUsesDebanding } from './viewportTargetOptions';
import { canvasColorSpaceOf } from '../../../r3f/canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

describe('viewportCanvasColorSpace', () => {
  it('draws the canvas of a viewport with use_hdr_2d in linear, over a 3D world too', () => {
    expect(viewportCanvasColorSpace({ use_hdr_2d: true })).toBe(LINEAR_CANVAS);
  });

  it('draws the canvas of a viewport without use_hdr_2d in sRGB', () => {
    expect(viewportCanvasColorSpace({ use_hdr_2d: false })).toBe(canvasColorSpaceOf(false));
  });
});

describe('viewportUsesDebanding', () => {
  it('dithers the tonemap of a viewport with use_debanding (8-bit storage)', () => {
    expect(viewportUsesDebanding({ use_debanding: true, use_hdr_2d: false })).toBe(true);
  });

  it('dithers nothing in a viewport that uses HDR, whose half floats are no 8-bit store (renderer_scene_render_rd.cpp:941)', () => {
    expect(viewportUsesDebanding({ use_debanding: true, use_hdr_2d: true })).toBe(false);
  });

  it('dithers nothing without use_debanding', () => {
    expect(viewportUsesDebanding({ use_debanding: false, use_hdr_2d: false })).toBe(false);
  });
});

describe('viewportMsaaMode', () => {
  const modes = { msaa_2d: 1, msaa_3d: 3 };

  it('takes msaa_3d for a pass that draws the 3D world', () => {
    expect(viewportMsaaMode(modes, '3d')).toBe(3);
  });

  it('takes msaa_2d for a pass that draws canvas items', () => {
    expect(viewportMsaaMode(modes, '2d')).toBe(1);
  });

  it('keeps Disabled at the defaults (edge case)', () => {
    expect(viewportMsaaMode({ msaa_2d: 0, msaa_3d: 0 }, '3d')).toBe(0);
  });
});
