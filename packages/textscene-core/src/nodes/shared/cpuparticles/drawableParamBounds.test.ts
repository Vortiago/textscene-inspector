import { describe, it, expect } from 'vitest';
import { drawableParamBounds } from './drawableParamBounds.js';

describe('drawableParamBounds', () => {
  it('names each bound that is non-finite once stored, with its stored value', () => {
    const { nonFinite } = drawableParamBounds({ angle_min: 'inf', angle_max: '1e39', spread: 'inf' });
    expect(nonFinite).toEqual([
      { key: 'angle_min', stored: Infinity },
      { key: 'angle_max', stored: Infinity },
    ]);
  });

  it('names nothing for a finite bound, a refused value and an absent key (edge)', () => {
    expect(drawableParamBounds({ angle_min: '3', angle_max: '"fast"' }).nonFinite).toEqual([]);
  });

  it('drops the non-finite bounds and keeps every other key in file order', () => {
    const { drawable } = drawableParamBounds({ angle_min: 'inf', amount: '8', angle_max: '2' });
    expect(Object.entries(drawable)).toEqual([
      ['amount', '8'],
      ['angle_max', '2'],
    ]);
  });

  it('hands back the properties themselves when every bound is finite', () => {
    const properties = { angle_min: '3', amount: '8' };
    expect(drawableParamBounds(properties).drawable).toBe(properties);
  });
});
