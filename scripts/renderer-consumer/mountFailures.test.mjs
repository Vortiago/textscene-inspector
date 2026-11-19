import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { mountFailures } from './mountFailures.mjs';

function pngOf(width, height, paint = () => [0, 0, 0, 0]) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) png.data.set(paint(x, y), (y * width + x) * 4);
  }
  return PNG.sync.write(png).toString('base64');
}

const WINDOW_PNG = pngOf(1152, 648);
const EDITOR_PNG = pngOf(320, 240, (x) => (x > 100 && x < 220 ? [200, 200, 200, 255] : [60, 48, 38, 255]));
const TRANSPARENT_PNG = pngOf(640, 240, (x, y) => {
  if (x < 160 || x >= 480) return [0, 0, 0, 255];
  return x >= 300 && x < 340 && y >= 100 && y < 140 ? [255, 0, 0, 255] : [0, 0, 0, 0];
});

const PASSING = {
  earlyCaptureError: 'expected a settled view, got no frame drawn',
  settledValue: { scriptedNodeCount: 0, hasCurrentCamera: true },
  smallElementPng: WINDOW_PNG,
  largeElementPng: WINDOW_PNG,
  noProjectSize: { width: 1152, height: 648 },
  editorSettledValue: { scriptedNodeCount: 0, hasCurrentCamera: true },
  editorCaptureSize: { width: 320, height: 240 },
  atSettledPng: EDITOR_PNG,
  laterPng: EDITOR_PNG,
  canvasesAfterDispose: 0,
  isContextLostAfterDispose: true,
  transparentPng: TRANSPARENT_PNG,
};

describe('mountFailures', () => {
  it('finds nothing wrong with results that meet every check', () => {
    expect(mountFailures(PASSING)).toEqual([]);
  });

  it('names a capture that resolved before the view settled', () => {
    expect(mountFailures({ ...PASSING, earlyCaptureError: 'resolved' })).toEqual([
      'mountScene: captureImage before settled: expected a rejection that names the pending work, got resolved',
    ]);
  });

  it('names a capture whose bytes follow the size of the element', () => {
    expect(mountFailures({ ...PASSING, largeElementPng: pngOf(1152, 648, () => [1, 0, 0, 255]) })).toEqual([
      'mountScene: captureImage: expected the same PNG bytes from a 320 x 240 and a 1920 x 1080 element, got others',
    ]);
  });

  it('names a 3D capture that took the game window’s size, not the element’s', () => {
    expect(mountFailures({ ...PASSING, editorCaptureSize: { width: 1152, height: 648 } })).toEqual([
      'mountScene: captureImage size in 3D: expected {"width":320,"height":240}, got {"width":1152,"height":648}',
    ]);
  });

  it('names a 3D capture as settled resolves that differs from a later one', () => {
    const moved = pngOf(320, 240, (x) => (x > 110 && x < 230 ? [200, 200, 200, 255] : [60, 48, 38, 255]));
    expect(mountFailures({ ...PASSING, laterPng: moved })).toEqual([
      expect.stringMatching(
        /^mountScene: captureImage in 3D as settled resolves: expected the later capture, got 4800 px/
      ),
    ]);
  });

  it('names a 3D capture as settled resolves that lacks the late cube', () => {
    const ground = pngOf(320, 240, () => [60, 48, 38, 255]);
    expect(mountFailures({ ...PASSING, atSettledPng: ground, laterPng: ground })).toEqual([
      'mountScene: captureImage in 3D as settled resolves: expected the late cube at the centre, got a contrast of 0',
    ]);
  });

  it('names an opaque clear in a transparent window', () => {
    const opaque = pngOf(640, 240, () => [0, 0, 0, 255]);
    expect(mountFailures({ ...PASSING, transparentPng: opaque })).toContain(
      'mountScene: transparent window clear at 170, 10: expected [0,0,0,0], got [0,0,0,255]'
    );
  });
});
