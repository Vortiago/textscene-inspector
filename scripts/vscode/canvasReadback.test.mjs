import { describe, expect, it } from 'vitest';
import { PNG_DATA_URL_PREFIX, stabilizeCanvas } from './canvasReadback.mjs';
import { frameReading } from './frameReading.testkit.mjs';

const FIRST = `${PNG_DATA_URL_PREFIX}AAAA`;
const SECOND = `${PNG_DATA_URL_PREFIX}BBBB`;

/** A frame whose readbacks never repeat. */
function frameChanging() {
  let index = 0;
  return { evaluate: async () => `${PNG_DATA_URL_PREFIX}${index++}` };
}

const QUICK = { timeoutMs: 200, intervalMs: 1 };

describe('stabilizeCanvas', () => {
  it('settles once two consecutive readbacks match', async () => {
    const frame = frameReading([FIRST, SECOND]);

    expect(await stabilizeCanvas(frame, QUICK)).toEqual({ dataUrl: SECOND, stable: true });
  });

  it('never settles while every readback differs (error path)', async () => {
    expect((await stabilizeCanvas(frameChanging(), QUICK)).stable).toBe(false);
  });

  it('settles past two matching readbacks that are no PNG (edge case)', async () => {
    const frame = frameReading(['error:SecurityError', 'error:SecurityError', SECOND]);

    expect(await stabilizeCanvas(frame, QUICK)).toEqual({ dataUrl: SECOND, stable: true });
  });
});
