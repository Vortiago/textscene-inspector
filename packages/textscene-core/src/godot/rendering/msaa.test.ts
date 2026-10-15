import { describe, expect, it } from 'vitest';
import { MSAA_LABELS, MSAA_MODES, msaaSampleCount, supportedSampleCount } from './msaa';

describe('Viewport.MSAA', () => {
  it('holds the four modes below MSAA_MAX', () => {
    expect(MSAA_MODES).toEqual([0, 1, 2, 3]);
  });

  it('names no value past MSAA_8X (edge case)', () => {
    expect(MSAA_LABELS[4]).toBeUndefined();
  });
});

describe('msaaSampleCount', () => {
  it('draws one sample, no multisampled buffer, for MSAA_DISABLED', () => {
    expect(msaaSampleCount(0)).toBe(0);
  });

  it('gives 2, 4 and 8 samples for MSAA_2X, MSAA_4X and MSAA_8X', () => {
    expect([1, 2, 3].map(msaaSampleCount)).toEqual([2, 4, 8]);
  });

  it('keeps MSAA_DISABLED for a mode the setter refuses (edge case)', () => {
    expect([-1, 4, 1.5, Number.NaN].map(msaaSampleCount)).toEqual([0, 0, 0, 0]);
  });
});

describe('supportedSampleCount', () => {
  it('keeps a count the device supports', () => {
    expect(supportedSampleCount(4, [2, 4, 8])).toBe(4);
  });

  it('falls to the closest lower count the device supports', () => {
    // lavapipe and SwiftShader both support 4 alone: 8X draws 4 samples there.
    expect(supportedSampleCount(8, [4])).toBe(4);
  });

  it('draws one sample when the device supports no count at or below the request (edge case)', () => {
    // 2X on those devices.
    expect(supportedSampleCount(2, [4])).toBe(0);
  });
});
