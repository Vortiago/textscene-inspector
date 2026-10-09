import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { PNG_DATA_URL_PREFIX, stabilizeCanvas } from './canvasReadback.mjs';

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

const INKED = { ...QUICK, expectsInk: true };

describe('stabilizeCanvas', () => {
  it('settles on two identical readbacks', async () => {
    const frame = frameReading([readback(false)]);

    expect(await stabilizeCanvas(frame, QUICK)).toEqual({ dataUrl: readback(false), stable: true });
  });

  it('waits through blank readbacks until two with ink match, for a scene that must draw', async () => {
    const frame = frameReading([readback(false), readback(false), readback(true)]);

    expect(await stabilizeCanvas(frame, INKED)).toEqual({ dataUrl: readback(true), stable: true });
  });

  it('never settles while a scene that must draw stays blank (error path)', async () => {
    const frame = frameReading([readback(false)]);

    expect((await stabilizeCanvas(frame, INKED)).stable).toBe(false);
  });

  it('keeps polling through a readback that is no PNG (edge case)', async () => {
    const frame = frameReading([null, 'error:SecurityError', readback(true)]);

    expect(await stabilizeCanvas(frame, INKED)).toEqual({ dataUrl: readback(true), stable: true });
  });
});
