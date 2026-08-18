/**
 * Contract: a heading attribute value is captured WHOLE, whatever its form.
 *
 * Godot writes a space after every comma, so a value scanner that is not
 * delimiter-balanced truncates at that space —
 * `parent_id_path=PackedInt32Array(840561040, 1598164129)` down to
 * `PackedInt32Array(840561040,`, silently dropping the rest.
 *
 * Non-gameable by construction, in three directions:
 *
 *  1. GENERALITY. `Vector2(1, 2)` is pinned deliberately, so no list of
 *     constructor names can satisfy this file — the capture must accept ANY
 *     `Name(...)` call rather than an enumeration. (Godot does not emit
 *     `Vector2(...)` in a heading; the rung constrains the GRAMMAR, not
 *     Godot's writer.)
 *  2. NO OVER-CAPTURE. A greedy `\w+\(.*\)` would swallow two adjacent
 *     constructor attributes into one, so every multi-attribute rung asserts the
 *     COMPLETE attribute set, not just the value under test.
 *  3. STRING-AWARENESS. A delimiter inside a quoted string (`"Foo (copy)"`,
 *     `"a]b"`) must not close the value. Both are legal Godot node/group names,
 *     and both defeat a character-class scan however many constructor names it
 *     knows, so the capture has to track quotes rather than count characters.
 *
 * Asserted at `parseHeading`'s own boundary on purpose: nothing in the tree reads
 * `parent_id_path` or `node_paths`, so there is no downstream layer to assert at
 * and none should be invented to create one.
 *
 * `heading-array-attrs.test.ts` beside it pins the same grammar for the two
 * array-shaped values with simpler cases; the two files together, plus
 * `heading-value-scan.test.ts`, cover the whole value grammar.
 */

import { describe, it, expect } from 'vitest';
import { parseHeading } from './utils';

describe('parseHeading captures a complete attribute value', () => {
  it('captures a multi-element PackedInt32Array (the reported truncation)', () => {
    const result = parseHeading(
      '[node name="Robot" parent="Player" parent_id_path=PackedInt32Array(840561040, 1598164129)]',
    );
    expect(result).not.toBeNull();
    expect(result!.attributes.parent_id_path).toBe('PackedInt32Array(840561040, 1598164129)');
    expect(Object.keys(result!.attributes).sort()).toEqual(['name', 'parent', 'parent_id_path']);
  });

  it('captures a constructor whose name is NOT a Packed*Array', () => {
    // The generality rung: a fix that enumerates constructor names fails here.
    const result = parseHeading('[node name="X" type="Node2D" position=Vector2(1, 2) parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'X',
      type: 'Node2D',
      position: 'Vector2(1, 2)',
      parent: '.',
    });
  });

  it('keeps two adjacent constructor attributes separate', () => {
    const result = parseHeading(
      '[node name="X" node_paths=PackedStringArray("a", "b") parent_id_path=PackedInt32Array(1, 2) parent="."]',
    );
    expect(result).not.toBeNull();
    expect(result!.attributes.node_paths).toBe('PackedStringArray("a", "b")');
    expect(result!.attributes.parent_id_path).toBe('PackedInt32Array(1, 2)');
    // a greedy capture would run to the LAST ')' and eat both the second
    // constructor and the plain attribute after it
    expect(Object.keys(result!.attributes).sort()).toEqual([
      'name',
      'node_paths',
      'parent',
      'parent_id_path',
    ]);
  });

  it('does not end a constructor at a ")" inside one of its quoted strings', () => {
    const result = parseHeading(
      '[node name="X" node_paths=PackedStringArray("Foo (copy)", "Bar") parent="."]',
    );
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'X',
      node_paths: 'PackedStringArray("Foo (copy)", "Bar")',
      parent: '.',
    });
  });

  it('does not end a bracketed array at a "]" inside one of its quoted strings', () => {
    const result = parseHeading('[node name="X" groups=["a]b", "c"] parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', groups: '["a]b", "c"]', parent: '.' });
  });

  it('captures a constructor nested inside a bracketed array', () => {
    const result = parseHeading('[node name="X" bounds=[Vector2(0, 0), Vector2(1, 1)] parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'X',
      bounds: '[Vector2(0, 0), Vector2(1, 1)]',
      parent: '.',
    });
  });

  // --- regression guards: these pass today and must keep passing ---

  it('still unescapes a quoted value containing escaped quotes', () => {
    const result = parseHeading('[node name="He said \\"hi\\"" type="Node"]');
    expect(result).not.toBeNull();
    expect(result!.attributes.name).toBe('He said "hi"');
    expect(result!.attributes.type).toBe('Node');
  });

  it('still treats brackets and parens inside a quoted value as literal text', () => {
    const result = parseHeading(
      '[ext_resource type="Texture2D" path="res://art/Foo (1)/[x].png" id="1_a"]',
    );
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      type: 'Texture2D',
      path: 'res://art/Foo (1)/[x].png',
      id: '1_a',
    });
  });

  it('still parses a heading of bare unquoted values', () => {
    const result = parseHeading('[gd_scene load_steps=3 format=3 uid="uid://abc"]');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('gd_scene');
    expect(result!.attributes.load_steps).toBe('3');
    expect(result!.attributes.format).toBe('3');
    expect(result!.attributes.uid).toBe('uid://abc');
  });

  it('still returns null for a line that is not a heading, and {} for a bare type', () => {
    expect(parseHeading('name="X" type="Node"')).toBeNull();
    expect(parseHeading('[editable]')).toEqual({ type: 'editable', attributes: {} });
  });
});
