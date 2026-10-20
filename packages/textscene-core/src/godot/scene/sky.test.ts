import { describe, expect, it } from 'vitest';
import { SKY_PROCESS_MODE_NAMES, SKY_RADIANCE_SIZE_NAMES } from './sky.js';

describe('SKY_PROCESS_MODE_NAMES', () => {
  it('names the four modes by their constants (sky.h:51-56)', () => {
    expect(SKY_PROCESS_MODE_NAMES).toEqual({
      0: 'PROCESS_MODE_AUTOMATIC',
      1: 'PROCESS_MODE_QUALITY',
      2: 'PROCESS_MODE_INCREMENTAL',
      3: 'PROCESS_MODE_REALTIME',
    });
  });
});

describe('SKY_RADIANCE_SIZE_NAMES', () => {
  it('names the seven sizes by their constants, without RADIANCE_SIZE_MAX (sky.h:40-49)', () => {
    expect(SKY_RADIANCE_SIZE_NAMES).toEqual({
      0: 'RADIANCE_SIZE_32',
      1: 'RADIANCE_SIZE_64',
      2: 'RADIANCE_SIZE_128',
      3: 'RADIANCE_SIZE_256',
      4: 'RADIANCE_SIZE_512',
      5: 'RADIANCE_SIZE_1024',
      6: 'RADIANCE_SIZE_2048',
    });
  });
});
