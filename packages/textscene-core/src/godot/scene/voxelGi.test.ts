import { describe, expect, it } from 'vitest';
import { VOXEL_GI_SUBDIV_NAMES } from './voxelGi.js';

describe('VOXEL_GI_SUBDIV_NAMES', () => {
  it('names the four subdivisions, SUBDIV_MAX left out (voxel_gi.h:101-108)', () => {
    expect(VOXEL_GI_SUBDIV_NAMES).toEqual({
      0: 'SUBDIV_64',
      1: 'SUBDIV_128',
      2: 'SUBDIV_256',
      3: 'SUBDIV_512',
    });
  });
});
