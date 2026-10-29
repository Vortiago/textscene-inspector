import { describe, expect, it } from 'vitest';
import { sameData } from './sameData';

describe('sameData', () => {
  it('equals two values of the same content, however deep', () => {
    const point = () => ({ in: { x: 0, y: 0 }, position: { x: 1, y: NaN } });
    expect(sameData([point(), point()], [point(), point()])).toBe(true);
  });

  it('tells a changed number, a missing key and an extra key apart', () => {
    expect(sameData({ x: 1 }, { x: 2 })).toBe(false);
    expect(sameData({ x: 1, y: 2 }, { x: 1 })).toBe(false);
    expect(sameData({ x: 1 }, { x: 1, y: 2 })).toBe(false);
  });

  it('tells a key that holds undefined from a key that is absent', () => {
    expect(sameData({ x: 1, y: undefined }, { x: 1, z: undefined })).toBe(false);
  });

  it('tells an array from an object, and a list of another length', () => {
    expect(sameData([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(sameData([1, 2], [1, 2, 3])).toBe(false);
  });

  it('tells null from an object and from a number', () => {
    expect(sameData(null, {})).toBe(false);
    expect(sameData(null, 0)).toBe(false);
  });
});
