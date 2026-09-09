/**
 * `anim_player` NodePath resolution tests.
 *
 * An AnimationTree's `anim_player = NodePath("../Player/AnimationPlayer")` is
 * relative to the tree node (Godot semantics: a leading `..` is the tree's
 * parent). `resolveAnimPlayerPath` turns it into the absolute, slash-joined
 * scene-tree path used to look up the target driver.
 */

import { describe, it, expect } from 'vitest';
import { resolveAnimPlayerPath } from './resolveAnimPlayer';

describe('resolveAnimPlayerPath', () => {
  it('resolves a sibling-relative path (platformer GLB driver)', () => {
    expect(
      resolveAnimPlayerPath('Player/AnimationTree', 'NodePath("../Player/AnimationPlayer")')
    ).toBe('Player/Player/AnimationPlayer');
  });

  it('resolves a direct sibling', () => {
    expect(resolveAnimPlayerPath('Root/Tree', 'NodePath("../AnimationPlayer")')).toBe(
      'Root/AnimationPlayer'
    );
  });

  it('resolves a child path with no leading `..`', () => {
    expect(resolveAnimPlayerPath('Root/Tree', 'NodePath("Inner/Player")')).toBe(
      'Root/Tree/Inner/Player'
    );
  });

  it('resolves `.` to the tree node itself', () => {
    expect(resolveAnimPlayerPath('Root/Tree', 'NodePath(".")')).toBe('Root/Tree');
  });

  it('returns null for an empty NodePath', () => {
    expect(resolveAnimPlayerPath('Root/Tree', 'NodePath("")')).toBeNull();
  });

  it('returns null when `..` climbs above the scene root', () => {
    expect(resolveAnimPlayerPath('Tree', 'NodePath("../../Foo")')).toBeNull();
  });

  it('returns null for a single `..` from a root-level tree (no node above the scene root)', () => {
    expect(resolveAnimPlayerPath('Tree', 'NodePath("../Foo")')).toBeNull();
  });

  it('returns null for a non-NodePath value', () => {
    expect(resolveAnimPlayerPath('Root/Tree', 'garbage')).toBeNull();
  });

  it('returns null for a %Name segment, which no claim table here can resolve', () => {
    // `get_node_or_null` looks the name up in the owner's table and descends
    // from whatever it finds (node.cpp:1930-1938). Without one there is nothing
    // to look it up in, and `%` is an invalid node-name character
    // (ustring.cpp:5071), so treating it as an ordinary child would build a
    // path no node can occupy.
    expect(resolveAnimPlayerPath('Root/Tree', 'NodePath("%Hud/Player")')).toBeNull();
  });
});
