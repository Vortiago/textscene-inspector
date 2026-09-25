/**
 * parseHeading captures an array-valued attribute whole: `node_paths=PackedStringArray("a",
 * "b")` and `groups=["a", "b"]` must not stop at the space after a comma. Paired with
 * simple, quoted-with-space and after-array cases, so a greedy "match to the last
 * bracket" fix fails by over-capturing.
 */

import { describe, it, expect } from 'vitest';
import { parseHeading } from './utils';

describe('#150 parseHeading array-attribute capture', () => {
  it('captures a full PackedStringArray node_paths value (not truncated)', () => {
    const result = parseHeading('[node name="Game" type="Node" node_paths=PackedStringArray("a", "b")]');
    expect(result).not.toBeNull();
    expect(result!.attributes.node_paths).toBe('PackedStringArray("a", "b")');
  });

  it('captures a full bracketed groups value (not truncated)', () => {
    const result = parseHeading('[node name="Mob" type="Node" groups=["mobs", "enemies"]]');
    expect(result).not.toBeNull();
    expect(result!.attributes.groups).toBe('["mobs", "enemies"]');
  });

  it('keeps two array attributes on one heading separate (no over-capture)', () => {
    const result = parseHeading(
      '[node name="X" type="Node" node_paths=PackedStringArray("p1", "p2") groups=["g1", "g2"]]',
    );
    expect(result).not.toBeNull();
    expect(result!.attributes.node_paths).toBe('PackedStringArray("p1", "p2")');
    expect(result!.attributes.groups).toBe('["g1", "g2"]');
    // the array must not swallow the preceding plain attributes either
    expect(result!.attributes.name).toBe('X');
    expect(result!.attributes.type).toBe('Node');
  });

  it('still parses a plain attribute that follows an array attribute', () => {
    const result = parseHeading('[node name="Y" type="Node" groups=["a", "b"] parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes.groups).toBe('["a", "b"]');
    expect(result!.attributes.parent).toBe('.');
  });

  // --- regression guards: these pass today and must keep passing after the fix ---

  it('still parses simple unquoted values', () => {
    const result = parseHeading('[gd_scene load_steps=3 format=3]');
    expect(result).not.toBeNull();
    expect(result!.attributes.load_steps).toBe('3');
    expect(result!.attributes.format).toBe('3');
  });

  it('still parses a quoted value containing spaces', () => {
    const result = parseHeading('[node name="My Node" type="Node"]');
    expect(result).not.toBeNull();
    expect(result!.attributes.name).toBe('My Node');
    expect(result!.attributes.type).toBe('Node');
  });
});
