import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { loadFailures } from './loadFailures.mjs';

/** A 2 x 2 PNG of one colour, as base64. */
function png([r, g, b]) {
  const image = new PNG({ width: 2, height: 2 });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([r, g, b, 255], i);
  return PNG.sync.write(image).toString('base64');
}

const NOISE = png([90, 90, 90]);
const WHITE = png([255, 255, 255]);
const RED = png([255, 0, 0]);
const BLUE = png([0, 0, 255]);

const PASSING = {
  workersStarted: 1,
  noisePng: NOISE,
  untexturedPng: WHITE,
  redPng: RED,
  repaintedPng: BLUE,
  freshBluePng: BLUE,
  isSameCanvas: true,
};

describe('loadFailures', () => {
  it('passes a worker that drew the noise and a swatch repainted in place', () => {
    expect(loadFailures(PASSING)).toEqual([]);
  });

  it('fails a page that started no worker', () => {
    expect(loadFailures({ ...PASSING, workersStarted: 0 })).toEqual([
      'load: a NoiseTexture2D: expected the package to start a worker, got 0',
    ]);
  });

  it('fails a noise texture that left the quad untextured', () => {
    expect(loadFailures({ ...PASSING, noisePng: WHITE })).toEqual([
      'load: a NoiseTexture2D: expected the noise to change the quad, got the untextured frame',
    ]);
  });

  it('fails a swatch that kept its old colour', () => {
    expect(loadFailures({ ...PASSING, repaintedPng: RED })).toEqual([
      'load: a watched swatch: expected the repainted frame to change, got the red frame',
      expect.stringContaining('load: a watched swatch: expected the frame of a fresh blue view, got'),
    ]);
  });

  it('fails a view that remounted its canvas', () => {
    expect(loadFailures({ ...PASSING, isSameCanvas: false })).toEqual([
      'load: a watched swatch: expected the view to keep its canvas, got a new one',
    ]);
  });
});
