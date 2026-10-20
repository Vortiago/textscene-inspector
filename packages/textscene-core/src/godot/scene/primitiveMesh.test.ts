import { describe, expect, it } from 'vitest';
import { primitiveMeshTexelSize, primitiveMeshUv2Scale } from './primitiveMesh';

describe('primitiveMeshUv2Scale', () => {
  it('is one less the padding over the lightmap size', () => {
    expect(primitiveMeshUv2Scale(2, 8)).toBe(0.75);
  });

  it('measures against 1024 texels for a zero size (edge case)', () => {
    expect(primitiveMeshUv2Scale(256, 0)).toBe(0.75);
  });

  it('keeps the whole UV for no padding', () => {
    expect(primitiveMeshUv2Scale(0, 8)).toBe(1);
  });
});

describe('primitiveMeshTexelSize', () => {
  it('keeps a positive setting', () => {
    expect(primitiveMeshTexelSize(0.5)).toBe(0.5);
  });

  it('turns zero or less into the default (edge case)', () => {
    expect(primitiveMeshTexelSize(0)).toBe(0.2);
    expect(primitiveMeshTexelSize(-1)).toBe(0.2);
  });
});
