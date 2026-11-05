/**
 * The skin of a Polygon2D bound to a Skeleton2D: the four bone weights each vertex keeps
 * (`polygon_2d.cpp:242-305`), and the vertex the skeleton pass moves it to
 * (`skeleton.glsl:157-182`). Every expected point is worked by hand.
 */
import { describe, expect, it } from 'vitest';
import { TRANSFORM2D_IDENTITY, type Transform2DColumns } from '../../../godot/math/transform2d';
import { skinnedPoints, vertexInfluences } from './polygonSkin';

const QUARTER_TURN: Transform2DColumns = { a: 0, b: 1, c: -1, d: 0, tx: 0, ty: 0 };

function translation(tx: number, ty: number): Transform2DColumns {
  return { ...TRANSFORM2D_IDENTITY, tx, ty };
}

describe('vertexInfluences', () => {
  it('normalises the weights a vertex keeps', () => {
    const influences = vertexInfluences(1, [
      { bone: 0, weights: [0.25] },
      { bone: 1, weights: [0.75] },
    ]);
    expect(Array.from(influences.bones.slice(0, 2))).toEqual([1, 0]);
    expect(influences.weights[0]).toBeCloseTo(0.75, 4);
    expect(influences.weights[1]).toBeCloseTo(0.25, 4);
  });

  it('keeps the four largest weights of a vertex', () => {
    const influences = vertexInfluences(
      1,
      [0.1, 0.5, 0.2, 0.4, 0.3].map((weight, bone) => ({ bone, weights: [weight] }))
    );
    expect(Array.from(influences.bones)).toEqual([1, 3, 4, 2]);
  });

  it('skips an entry whose weight count differs from the vertex count', () => {
    const influences = vertexInfluences(2, [
      { bone: 0, weights: [1] },
      { bone: 1, weights: [1, 1] },
    ]);
    expect(Array.from(influences.bones)).toEqual([1, 0, 0, 0, 1, 0, 0, 0]);
  });

  it('leaves an unpainted vertex with no weight at all', () => {
    const influences = vertexInfluences(1, [{ bone: 0, weights: [0] }]);
    expect(Array.from(influences.weights)).toEqual([0, 0, 0, 0]);
  });

  it('gives a NaN weight no slot, as no weight compares less than it', () => {
    const influences = vertexInfluences(1, [
      { bone: 0, weights: [NaN] },
      { bone: 1, weights: [1] },
    ]);
    expect(Array.from(influences.bones)).toEqual([1, 0, 0, 0]);
    expect(Array.from(influences.weights)).toEqual([1, 0, 0, 0]);
  });

  it('stores each weight as a 16-bit unorm, truncated', () => {
    const influences = vertexInfluences(1, [
      { bone: 0, weights: [1] },
      { bone: 1, weights: [1] },
    ]);
    // 0.5 * 65535 is 32767.5, stored 32767.
    expect(influences.weights[0]).toBe(Math.fround(32767 / 65535));
  });
});

describe('skinnedPoints', () => {
  it('turns a vertex by its one bone', () => {
    const influences = vertexInfluences(1, [{ bone: 0, weights: [1] }]);
    const [point] = skinnedPoints([{ x: 100, y: 0 }], influences, [QUARTER_TURN], TRANSFORM2D_IDENTITY);
    expect(point!.x).toBeCloseTo(0, 4);
    expect(point!.y).toBeCloseTo(100, 4);
  });

  it('blends the bones of a vertex by their weights', () => {
    const influences = vertexInfluences(1, [
      { bone: 0, weights: [1] },
      { bone: 1, weights: [1] },
    ]);
    const [point] = skinnedPoints(
      [{ x: 0, y: 0 }],
      influences,
      [TRANSFORM2D_IDENTITY, translation(10, 0)],
      TRANSFORM2D_IDENTITY
    );
    // Each half stores as 32767/65535, a hair under 0.5.
    expect(point!.x).toBeCloseTo((10 * 32767) / 65535, 4);
    expect(point!.y).toBeCloseTo(0, 4);
  });

  it('turns a vertex about the skeleton origin, in mesh space', () => {
    // The skeleton origin sits at mesh (10, 0), so mesh (110, 0) is skeleton (100, 0).
    const influences = vertexInfluences(1, [{ bone: 0, weights: [1] }]);
    const [point] = skinnedPoints([{ x: 110, y: 0 }], influences, [QUARTER_TURN], translation(10, 0));
    expect(point!.x).toBeCloseTo(10, 4);
    expect(point!.y).toBeCloseTo(100, 4);
  });

  it('collapses a vertex with no weight to the mesh origin', () => {
    const influences = vertexInfluences(1, [{ bone: 0, weights: [0] }]);
    const [point] = skinnedPoints([{ x: 40, y: 30 }], influences, [QUARTER_TURN], translation(5, 5));
    expect(point).toEqual({ x: 0, y: 0 });
  });

  it('collapses a vertex whose bone the skeleton lacks to the skeleton origin', () => {
    // A bone past the end reads a zero matrix, and its weight still carries the origin.
    const influences = vertexInfluences(1, [{ bone: 3, weights: [1] }]);
    const [point] = skinnedPoints([{ x: 40, y: 30 }], influences, [QUARTER_TURN], translation(5, 5));
    expect(point!.x).toBeCloseTo(5, 4);
    expect(point!.y).toBeCloseTo(5, 4);
  });
});
