import { describe, expect, it } from 'vitest';
import { MODIFIER_CALLBACK_MODE_PROCESS_NAMES } from './skeleton3d.js';

describe('MODIFIER_CALLBACK_MODE_PROCESS_NAMES', () => {
  it('names the modifier callback modes without their prefix (skeleton_3d.h:79-83)', () => {
    expect(MODIFIER_CALLBACK_MODE_PROCESS_NAMES).toEqual({ 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' });
  });
});
