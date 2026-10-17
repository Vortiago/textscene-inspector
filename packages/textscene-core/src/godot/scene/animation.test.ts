import { describe, it, expect } from 'vitest';
import {
  ANIMATION_CALLBACK_MODE_DISCRETE_NAMES,
  ANIMATION_CALLBACK_MODE_METHOD_NAMES,
  ANIMATION_CALLBACK_MODE_PROCESS_NAMES,
} from './animation.js';

describe('AnimationMixer callback mode names', () => {
  it('names each process mode without its prefix', () => {
    expect(ANIMATION_CALLBACK_MODE_PROCESS_NAMES).toEqual({ 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' });
  });

  it('names each method mode without its prefix', () => {
    expect(ANIMATION_CALLBACK_MODE_METHOD_NAMES).toEqual({ 0: 'DEFERRED', 1: 'IMMEDIATE' });
  });

  it('names each discrete mode without its prefix', () => {
    expect(ANIMATION_CALLBACK_MODE_DISCRETE_NAMES).toEqual({
      0: 'DOMINANT',
      1: 'RECESSIVE',
      2: 'FORCE_CONTINUOUS',
    });
  });
});
