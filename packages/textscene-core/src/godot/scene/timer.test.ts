import { describe, expect, it } from 'vitest';
import { TIMER_PROCESS_CALLBACK_NAMES } from './timer.js';

describe('TIMER_PROCESS_CALLBACK_NAMES', () => {
  it('names the timer process callbacks without their TIMER_PROCESS_ prefix (timer.h:52-55)', () => {
    expect(TIMER_PROCESS_CALLBACK_NAMES).toEqual({ 0: 'PHYSICS', 1: 'IDLE' });
  });
});
