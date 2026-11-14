/**
 * `useSpriteQuad`: the quad of a 2D sprite frame, placed at the sprite's offset in three's frame
 * (Y negated) and mirrored by its scale for `flip_h` and `flip_v`.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type * as THREE from 'three';
import { useSpriteQuad, type SpritePlacement } from './spriteQuad';

const CENTRED: SpritePlacement = { offset: { x: 0, y: 0 }, centered: true, flip_h: false, flip_v: false };
const SIZE = { width: 40, height: 20 };

function quad(placement: SpritePlacement) {
  return renderHook(() => useSpriteQuad(placement, SIZE)).result.current[0]!;
}

describe('useSpriteQuad', () => {
  it('draws one quad of the frame size', () => {
    const { parameters } = quad(CENTRED).geometry as THREE.PlaneGeometry;
    expect([parameters.width, parameters.height]).toEqual([40, 20]);
  });

  it('centres the quad on the offset, with Y negated', () => {
    expect(quad({ ...CENTRED, offset: { x: 5, y: 7 } }).position).toEqual([5, -7, 0]);
  });

  it('puts the top-left corner on the offset when not centred', () => {
    expect(quad({ ...CENTRED, centered: false, offset: { x: 5, y: 7 } }).position).toEqual([25, -17, 0]);
  });

  it('mirrors the quad for flip_h and flip_v', () => {
    expect(quad({ ...CENTRED, flip_h: true, flip_v: true }).scale).toEqual([-1, -1, 1]);
  });

  it('keeps the quad unmirrored without a flip', () => {
    expect(quad(CENTRED).scale).toEqual([1, 1, 1]);
  });
});
