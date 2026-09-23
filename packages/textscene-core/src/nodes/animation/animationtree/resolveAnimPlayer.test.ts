/**
 * `anim_player` resolution: `NodePath("../Player/AnimationPlayer")` is relative to the tree node,
 * so a leading `..` is the tree's parent. `resolveAnimPlayerPath` turns it into the absolute,
 * slash-joined scene-tree path of the target driver.
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
    // `get_node_or_null` looks a `%` name up in the owner's table (node.cpp:1930-1938). With no
    // owner there is no table, and `%` is an invalid node-name character (ustring.cpp:5071), so
    // an ordinary child of that name would be a path no node can occupy.
    expect(resolveAnimPlayerPath('Root/Tree', 'NodePath("%Hud/Player")')).toBeNull();
  });
});
