import { describe, expect, it } from 'vitest';
import { MULTIPLAYER_SYNCHRONIZER_VISIBILITY_UPDATE_MODE_NAMES } from './multiplayerSynchronizer.js';

describe('MULTIPLAYER_SYNCHRONIZER_VISIBILITY_UPDATE_MODE_NAMES', () => {
  it('names the three modes by their constants (multiplayer_synchronizer.h:41-45)', () => {
    expect(MULTIPLAYER_SYNCHRONIZER_VISIBILITY_UPDATE_MODE_NAMES).toEqual({
      0: 'VISIBILITY_PROCESS_IDLE',
      1: 'VISIBILITY_PROCESS_PHYSICS',
      2: 'VISIBILITY_PROCESS_NONE',
    });
  });
});
