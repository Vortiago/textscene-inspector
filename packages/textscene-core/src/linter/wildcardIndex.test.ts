/**
 * The four wildcard key shapes, at the boundary between ROUTING and acceptance.
 *
 * Routing is deliberately WIDER than what Godot accepts: a key whose index the
 * engine refuses must still reach the family's dispatcher, or the dropped write
 * it causes has no voice. So every matcher below matches STRUCTURE — a non-empty
 * index half, a leaf where the shape declares one — and leaves the integer
 * question to `indexedFamily`'s `indexParse`.
 *
 * The negative side is asserted as hard as the positive: a matcher that accepts
 * too much routes an unrelated key to a family's dispatcher, which then reports
 * an unknown property on a type that never declared one.
 */

import { describe, expect, it } from 'vitest';
import {
  buildWildcardIndex,
  matchesIndexedKey,
  matchesIndexedSubtree,
  matchesTerminalIndex,
} from './wildcardIndex.js';
import type { PropertyValidator } from './propertyValidator.js';

const stub: PropertyValidator = () => null;

describe('wildcard index', () => {
  it('slices each shape prefix once, at registration', () => {
    const entries = buildWildcardIndex({
      'bones/*': stub,
      'item_#/*': stub,
      'terrain_set_#/**': stub,
      'pattern_#': stub,
      tile_size: stub,
    });
    expect(entries.map((e) => ({ prefix: e.prefix, kind: e.kind }))).toEqual([
      { prefix: 'bones/', kind: 'path' },
      { prefix: 'item_', kind: 'indexedLeaf' },
      { prefix: 'terrain_set_', kind: 'indexedSubtree' },
      { prefix: 'pattern_', kind: 'indexedTerminal' },
    ]);
  });

  /**
   * A FENCE for the two shapes that existed before the subtree and terminal ones
   * were added: it passes on either side, and states that adding them changed no
   * routing an existing family depends on.
   */
  it('routes every key with a `/` past the prefix, and nothing without one', () => {
    expect(matchesIndexedKey('item_0/text', 'item_')).toBe(true);
    // Wider than acceptance: `_get_property` refuses each of these
    // (property_list_helper.cpp:53 on the index half, :63 on the leaf), and
    // the dispatcher is what reports the dropped write.
    expect(matchesIndexedKey('item_x/text', 'item_')).toBe(true);
    expect(matchesIndexedKey('item_0/deep/text', 'item_')).toBe(true);
    expect(matchesIndexedKey('item_0/', 'item_')).toBe(true);
    expect(matchesIndexedKey('item_/text', 'item_')).toBe(true);
    // No `/` at all is a different key (`item_count`), never this family's.
    expect(matchesIndexedKey('item_0', 'item_')).toBe(false);
    expect(matchesIndexedKey('item_count', 'item_')).toBe(false);
    expect(matchesIndexedKey('other_0/text', 'item_')).toBe(false);
  });

  describe('glued index over a nested leaf', () => {
    it('routes both depths of the family', () => {
      // tile_set.cpp:4190 and :4193-4194 — `mode` sits beside `terrain_<m>/name`.
      expect(matchesIndexedSubtree('terrain_set_0/mode', 'terrain_set_')).toBe(true);
      expect(matchesIndexedSubtree('terrain_set_0/terrain_1/name', 'terrain_set_')).toBe(true);
    });

    it('routes an index Godot refuses, so the dispatcher can report the drop', () => {
      expect(matchesIndexedSubtree('terrain_set_x/terrain_y/name', 'terrain_set_')).toBe(true);
      expect(matchesIndexedSubtree('terrain_set_-1/mode', 'terrain_set_')).toBe(true);
    });

    it('routes an empty index or an empty leaf, which `_set` drops', () => {
      // `is_valid_int()` refuses the empty index (tile_set.cpp:3893) and an
      // empty `components[1]` matches no branch (:3897, :3904), so both writes
      // return false and only the dispatcher can say so.
      expect(matchesIndexedSubtree('terrain_set_/mode', 'terrain_set_')).toBe(true);
      expect(matchesIndexedSubtree('terrain_set_0/', 'terrain_set_')).toBe(true);
    });

    it('refuses a key with no slash past the prefix, or another prefix', () => {
      expect(matchesIndexedSubtree('terrain_set_0', 'terrain_set_')).toBe(false);
      expect(matchesIndexedSubtree('terrain_sets', 'terrain_set_')).toBe(false);
      expect(matchesIndexedSubtree('physics_layer_0/collision_layer', 'terrain_set_')).toBe(false);
    });
  });

  describe('index that terminates the key', () => {
    it('routes the family', () => {
      // tile_set.cpp:3995 / :4230 — `pattern_<n>` has no leaf at all.
      expect(matchesTerminalIndex('pattern_0', 'pattern_')).toBe(true);
      expect(matchesTerminalIndex('pattern_12', 'pattern_')).toBe(true);
    });

    it('routes an index Godot refuses, so the dispatcher can report the drop', () => {
      expect(matchesTerminalIndex('pattern_x', 'pattern_')).toBe(true);
      expect(matchesTerminalIndex('pattern_-1', 'pattern_')).toBe(true);
    });

    it('routes the bare prefix, whose empty index `is_valid_int()` refuses (tile_set.cpp:3995)', () => {
      expect(matchesTerminalIndex('pattern_', 'pattern_')).toBe(true);
    });

    it('refuses a key with a leaf, or another prefix', () => {
      expect(matchesTerminalIndex('pattern_0/x', 'pattern_')).toBe(false);
      expect(matchesTerminalIndex('patterns', 'pattern_')).toBe(false);
      expect(matchesTerminalIndex('tile_size', 'pattern_')).toBe(false);
    });
  });
});
