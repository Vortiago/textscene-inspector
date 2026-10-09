import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { PNG_DATA_URL_PREFIX, waitForInk } from './canvasReadback.mjs';

/** A 4x4 PNG data URL, flat grey, with one white pixel when `inked`. */
function readback(inked) {
  const image = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([77, 77, 77, 255], i);
  if (inked) image.data.set([255, 255, 255, 255], 0);
  return PNG_DATA_URL_PREFIX + PNG.sync.write(image).toString('base64');
}

/** A frame whose successive readbacks are `reads`, the last one repeating. */
function frameReading(reads) {
  let index = 0;
  return { evaluate: async () => reads[Math.min(index++, reads.length - 1)] };
}

const QUICK = { timeoutMs: 200, intervalMs: 1 };

describe('waitForInk', () => {
  it('waits through blank readbacks until one has ink', async () => {
    const frame = frameReading([readback(false), readback(false), readback(true)]);

    expect(await waitForInk(frame, QUICK)).toBe(true);
  });

  it('answers false when the canvas stays blank past the timeout (error path)', async () => {
    const frame = frameReading([readback(false)]);

    expect(await waitForInk(frame, QUICK)).toBe(false);
  });

  it('keeps polling through a readback that is no PNG (edge case)', async () => {
    const frame = frameReading([null, 'error:SecurityError', readback(true)]);

    expect(await waitForInk(frame, QUICK)).toBe(true);
  });
});
