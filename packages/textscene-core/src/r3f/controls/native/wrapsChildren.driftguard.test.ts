/**
 * A type whose painter scopes its subtree declares `wrapsChildren` on its real registration. The
 * walker's tests use a stub, so only this guard sees a lost flag, which renders descendants as
 * siblings outside the scope. It checks both directions against the barrel-registered types.
 */

import { describe, expect, it } from 'vitest';
// Side-effect import: registers every Control slice's native painter.
import { controlComponentRegistry } from '../index';

/**
 * `CanvasLayer` and its subclass `ParallaxBackground` (`parallax_background.h:34`) publish a draw-order
 * band and a modulate scope. `ScrollContainer` and `GraphEdit` publish clip planes, as both set
 * `clip_contents`. A chrome-only painter does not wrap, so the walker places its children as siblings.
 */
const WRAPS_CHILDREN = new Set([
  'CanvasLayer',
  'ParallaxBackground',
  'ScrollContainer',
  'GraphEdit',
]);

describe('wrapsChildren ↔ ControlComponentRegistry drift guard', () => {
  it('every scope-establishing type declares it on its real registration', () => {
    for (const typeName of WRAPS_CHILDREN) {
      expect(
        controlComponentRegistry.wrapsChildren(typeName),
        `${typeName} must set wrapsChildren: true in its index.r3f.ts, or the scope it publishes reaches none of its descendants`
      ).toBe(true);
    }
  });

  it('no other registered type declares it', () => {
    const declared = controlComponentRegistry
      .getAllTypeNames()
      .filter((t) => controlComponentRegistry.wrapsChildren(t));

    expect(new Set(declared)).toEqual(WRAPS_CHILDREN);
  });
});
