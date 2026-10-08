/**
 * A capped list's buffer is read only where its items lie, so its passes clip to their rect.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { listWindow, windowScissor } from './lightListWindow';

describe('listWindow', () => {
  const windows = new Map([
    ['a', { x: 0, y: 0, w: 10, h: 10 }],
    ['b', { x: 20, y: -5, w: 5, h: 5 }],
  ]);

  it('is the union of the windows of every placement on the list', () => {
    expect(listWindow(['a', 'b'], windows)).toEqual({ x: 0, y: -5, w: 25, h: 15 });
  });

  it('is null when one placement has no window, as its items were never measured', () => {
    expect(listWindow(['a', 'c'], windows)).toBeNull();
  });

  it('is null for a list with no placement', () => {
    expect(listWindow([], windows)).toBeNull();
  });
});

describe('windowScissor', () => {
  /** A 2D view of world x in [0, 100] and y in [0, 50], drawn into a 200x100 buffer. */
  function camera(): THREE.OrthographicCamera {
    const view = new THREE.OrthographicCamera(0, 100, 50, 0, -10, 10);
    view.updateMatrixWorld();
    return view;
  }

  it('covers the world rect in buffer pixels, with a pixel or two to spare each side', () => {
    // World 10..30 x 10..15 lands on pixels 20..60 x 20..30.
    const [x, y, width, height] = windowScissor(
      { x: 10, y: 10, w: 20, h: 5 },
      camera(),
      new THREE.Vector2(200, 100)
    ).toArray();
    for (const [edge, from, to] of [
      [x, 18, 19],
      [y, 18, 19],
      [x + width, 61, 62],
      [y + height, 31, 32],
    ]) {
      expect(edge).toBeGreaterThanOrEqual(from!);
      expect(edge).toBeLessThanOrEqual(to!);
    }
  });

  it('clamps to the buffer', () => {
    const scissor = windowScissor({ x: -50, y: -50, w: 500, h: 500 }, camera(), new THREE.Vector2(200, 100));
    expect(scissor.toArray()).toEqual([0, 0, 200, 100]);
  });

  it('is empty for a window off the buffer', () => {
    const scissor = windowScissor({ x: 500, y: 500, w: 5, h: 5 }, camera(), new THREE.Vector2(200, 100));
    expect(scissor.z * scissor.w).toBe(0);
  });
});
