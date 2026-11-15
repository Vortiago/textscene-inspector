/** What a sub-viewport's properties ask of its target. */
import { describe, expect, it } from 'vitest';

import { viewportCanvasColorSpace } from './viewportTargetOptions';
import { canvasColorSpaceOf } from '../canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

describe('viewportCanvasColorSpace', () => {
  it('draws the canvas of a viewport with use_hdr_2d in linear, over a 3D world too', () => {
    expect(viewportCanvasColorSpace({ use_hdr_2d: true })).toBe(LINEAR_CANVAS);
  });

  it('draws the canvas of a viewport without use_hdr_2d in sRGB', () => {
    expect(viewportCanvasColorSpace({ use_hdr_2d: false })).toBe(canvasColorSpaceOf(false));
  });
});
