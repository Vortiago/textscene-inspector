import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { RECT2_METHODS, RECT2I_METHODS } from './rectMethods.js';

const rect2 = (x: number, y: number, w: number, h: number) => variant('RECT2', { x, y, w, h });
const rect2i = (x: number, y: number, w: number, h: number) => variant('RECT2I', { x, y, w, h });

describe('RECT2_METHODS', () => {
  it('merges two rects into the smallest rect that holds both', () => {
    expect(RECT2_METHODS.merge!.run(rect2(0, 0, 1, 1), [rect2(2, 3, 1, 1)])).toEqual(rect2(0, 0, 3, 4));
  });

  it('gives the empty rect for two rects that do not meet', () => {
    expect(RECT2_METHODS.intersection!.run(rect2(0, 0, 1, 1), [rect2(2, 2, 1, 1)])).toEqual(
      rect2(0, 0, 0, 0)
    );
  });

  it('makes a negative size positive in abs', () => {
    expect(RECT2_METHODS.abs!.run(rect2(1, 2, -3, -4), [])).toEqual(rect2(-2, -2, 3, 4));
  });
});

describe('RECT2I_METHODS', () => {
  it('wraps the int32 end of a rect that grows past the range', () => {
    expect(RECT2I_METHODS.grow!.run(rect2i(2147483647, 0, 0, 0), [1])).toEqual(rect2i(2147483646, -1, 2, 2));
  });

  it('declares int32 parameters for the scalar forms', () => {
    expect(RECT2I_METHODS.grow!.parameters).toEqual(['int32_t']);
  });
});
