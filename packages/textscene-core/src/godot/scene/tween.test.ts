import { describe, it, expect } from 'vitest';
import {
  EASE_TYPE_CONSTANT_NAMES,
  EASE_TYPE_NAMES,
  TRANSITION_TYPE_CONSTANT_NAMES,
  TRANSITION_TYPE_NAMES,
} from './tween.js';

describe('Tween type names', () => {
  it('names each transition type in the order of `tween.h:83-94`', () => {
    expect(Object.values(TRANSITION_TYPE_NAMES)).toEqual([
      'Linear',
      'Sine',
      'Quint',
      'Quart',
      'Quad',
      'Expo',
      'Elastic',
      'Cubic',
      'Circ',
      'Bounce',
      'Back',
      'Spring',
    ]);
  });

  it('names each ease type in the order of `tween.h:99-102`', () => {
    expect(EASE_TYPE_NAMES).toEqual({ 0: 'In', 1: 'Out', 2: 'InOut', 3: 'OutIn' });
  });

  it('spells the constant names in upper case', () => {
    expect(TRANSITION_TYPE_CONSTANT_NAMES[11]).toBe('SPRING');
    expect(EASE_TYPE_CONSTANT_NAMES).toEqual({ 0: 'IN', 1: 'OUT', 2: 'IN_OUT', 3: 'OUT_IN' });
  });
});
