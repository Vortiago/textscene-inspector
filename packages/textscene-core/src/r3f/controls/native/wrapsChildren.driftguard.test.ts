/**
 * Drift guard: the types whose native painter establishes an ambient scope for
 * its subtree must declare `wrapsChildren` on their REAL registration.
 *
 * Written after that flag went missing from `CanvasLayer`'s registration for a
 * whole commit without a single test failing. The walker's own tests register a
 * local stub and set the flag on THAT, so they proved the walker honours the
 * flag while saying nothing about whether any shipped registration sets it —
 * and each painter's own test passes children in directly, so it never exercises
 * the walker's placement at all. The consequence was silent and total: a
 * CanvasLayer's descendants rendered as siblings, so the draw-order band and
 * modulate scope it publishes reached nothing, and `visible = false` on the
 * layer stopped hiding its subtree.
 *
 * This asserts against the barrel-registered types, in both directions, so
 * losing the flag fails and adding it to a type that does not wrap fails too.
 */

import { describe, expect, it } from 'vitest';
// Side-effect import: registers every Control slice's native painter.
import { controlComponentRegistry } from '../index';

/**
 * A painter wraps its children only to give them a scope they must inherit:
 * `CanvasLayer` and `ParallaxBackground` (a `CanvasLayer` subclass,
 * `parallax_background.h:34`) publish a draw-order band plus a fresh modulate
 * scope, and `ScrollContainer` and `GraphEdit` publish clip planes (both set
 * `clip_contents` — one from the property, one from its own constructor).
 * Chrome-only painters must not — the walker places their children as siblings.
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
