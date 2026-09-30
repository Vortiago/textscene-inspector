/**
 * The worker job registry: each job is a pure function whose input survives a
 * structured clone and whose output buffers transfer back.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  NOISE_PIXEL_CASES,
  PINNED_PIXEL_HASHES,
} from '../resources/textures/noisetexture2d/pixelCases.testkit';
import { isWorkerJobName, WORKER_JOBS } from './jobs';

const [firstCase] = NOISE_PIXEL_CASES;
if (!firstCase) throw new Error('expected at least one noise pixel case');

describe('noise-texture-2d job', () => {
  const job = WORKER_JOBS['noise-texture-2d'];

  it.each(NOISE_PIXEL_CASES)('gives the pinned bytes for $name', ({ name, tex, noise, colorRamp }) => {
    const { pixels } = job.run({ tex, noise, colorRamp });
    expect(createHash('sha256').update(pixels).digest('hex')).toBe(PINNED_PIXEL_HASHES[name]);
  });

  it('transfers exactly the pixel buffer', () => {
    const output = job.run(firstCase);
    expect(job.transfer(output)).toEqual([output.pixels.buffer]);
  });

  it('takes an input that survives a structured clone unchanged', () => {
    const input = { tex: firstCase.tex, noise: firstCase.noise, colorRamp: firstCase.colorRamp };
    expect(structuredClone(input)).toEqual(input);
  });
});

describe('isWorkerJobName', () => {
  it('accepts a registered job', () => {
    expect(isWorkerJobName('noise-texture-2d')).toBe(true);
  });

  it('refuses an unknown name', () => {
    expect(isWorkerJobName('gradient-texture-2d')).toBe(false);
  });

  it('refuses an inherited property name', () => {
    expect(isWorkerJobName('toString')).toBe(false);
  });
});
