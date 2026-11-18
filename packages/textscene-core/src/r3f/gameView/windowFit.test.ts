import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { blitShift, targetRectInPane } from './windowFit';

const WINDOW = { size: { x: 100, y: 100 }, drawRect: { x: 10, y: 20, w: 50, h: 30 } };

describe('targetRectInPane', () => {
  it('scales the window to fill the pane, and the target with it, from the bottom-left', () => {
    expect(targetRectInPane({ x: 200, y: 200 }, WINDOW)).toEqual({ x: 20, y: 100, w: 100, h: 60 });
  });

  it('centres the window at one scale in a pane of another aspect', () => {
    expect(targetRectInPane({ x: 300, y: 100 }, WINDOW)).toEqual({ x: 110, y: 50, w: 50, h: 30 });
  });
});

describe('blitShift', () => {
  const image = { width: 2304, height: 1296 };

  it('moves each sample of a nearest blit 1/1024 texel right and down the target, in clip space', () => {
    expect(blitShift({ image, magFilter: THREE.NearestFilter })).toEqual({
      x: -2 / 1024 / 2304,
      y: 2 / 1024 / 1296,
    });
  });

  it('leaves a linear blit unshifted, since a shift there moves every bilinear sample', () => {
    expect(blitShift({ image, magFilter: THREE.LinearFilter })).toEqual({ x: 0, y: 0 });
  });
});
