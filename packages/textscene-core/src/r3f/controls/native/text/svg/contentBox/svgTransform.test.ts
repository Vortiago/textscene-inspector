import { describe, expect, it } from 'vitest';
import { parseTransform } from './svgTransform';

describe('parseTransform', () => {
  it('multiplies a transform list left to right', () => {
    expect(parseTransform('translate(10,20) scale(2)')).toMatchObject({ e11: 2, e13: 10, e22: 2, e23: 20 });
  });

  it('rotates about a point', () => {
    const m = parseTransform('rotate(90 10 10)')!;
    expect(m.e13).toBeCloseTo(20, 5);
    expect(m.e23).toBeCloseTo(0, 5);
    expect(m.e12).toBe(-1);
  });

  it('rejects an unknown function or the wrong count of numbers', () => {
    expect(parseTransform('spin(3)')).toBeNull();
    expect(parseTransform('translate(1,2,3)')).toBeNull();
  });
});
