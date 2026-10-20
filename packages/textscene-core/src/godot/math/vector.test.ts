import { describe, expect, it } from 'vitest';
import { normalizedVector3 } from './vector';

describe('normalizedVector3', () => {
  it('scales a vector to unit length', () => {
    expect(normalizedVector3(3, 0, 4)).toEqual([0.6, 0, 0.8]);
  });

  it('keeps a negative component negative', () => {
    expect(normalizedVector3(0, -2, 0)).toEqual([0, -1, 0]);
  });

  it('leaves a zero vector zero, as Vector3::normalize does (edge case)', () => {
    expect(normalizedVector3(0, 0, 0)).toEqual([0, 0, 0]);
  });
});
