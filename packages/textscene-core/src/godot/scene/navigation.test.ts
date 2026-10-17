import { describe, it, expect } from 'vitest';
import {
  NAVIGATION_2D_PATHFINDING_ALGORITHM_NAMES,
  NAVIGATION_2D_PATH_METADATA_FLAG_NAMES,
  NAVIGATION_2D_PATH_POSTPROCESSING_NAMES,
} from './navigation.js';

describe('2D navigation names', () => {
  it('names the one pathfinding algorithm by its constant', () => {
    expect(NAVIGATION_2D_PATHFINDING_ALGORITHM_NAMES).toEqual({
      0: 'PATHFINDING_ALGORITHM_ASTAR',
    });
  });

  it('names each path post-processing by its constant', () => {
    expect(NAVIGATION_2D_PATH_POSTPROCESSING_NAMES).toEqual({
      0: 'PATH_POSTPROCESSING_CORRIDORFUNNEL',
      1: 'PATH_POSTPROCESSING_EDGECENTERED',
      2: 'PATH_POSTPROCESSING_NONE',
    });
  });

  it('names each path metadata bit, INCLUDE_NONE and INCLUDE_ALL left out', () => {
    expect(NAVIGATION_2D_PATH_METADATA_FLAG_NAMES).toEqual({
      1: 'PATH_METADATA_INCLUDE_TYPES',
      2: 'PATH_METADATA_INCLUDE_RIDS',
      4: 'PATH_METADATA_INCLUDE_OWNERS',
    });
  });
});
