import { describe, it, expect } from 'vitest';
import { finiteParamBounds, nonFiniteParamBounds } from './finiteParamBounds.js';

describe('nonFiniteParamBounds', () => {
  it('names a bound that is non-finite once stored', () => {
    expect(nonFiniteParamBounds({ angle_min: 'inf', angle_max: '1e39', spread: 'inf' })).toEqual([
      'angle_min',
      'angle_max',
    ]);
  });

  it('names nothing for a finite bound, a refused value and an absent key (edge)', () => {
    expect(nonFiniteParamBounds({ angle_min: '3', angle_max: '"fast"' })).toEqual([]);
  });
});

describe('finiteParamBounds', () => {
  it('drops the non-finite bounds and keeps every other key in file order', () => {
    const kept = finiteParamBounds({ angle_min: 'inf', amount: '8', angle_max: '2' });
    expect(Object.entries(kept)).toEqual([
      ['amount', '8'],
      ['angle_max', '2'],
    ]);
  });
});
