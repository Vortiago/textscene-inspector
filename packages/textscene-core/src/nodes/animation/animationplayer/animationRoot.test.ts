import { describe, expect, it } from 'vitest';
import { resolveAnimationRootPath } from './animationRoot';

describe('resolveAnimationRootPath', () => {
  it('resolves the default root_node (..) to the player’s parent', () => {
    expect(resolveAnimationRootPath('Root/Coin/AnimationPlayer', 'NodePath("..")')).toBe('Root/Coin');
  });

  it('defaults to the parent when root_node is absent', () => {
    expect(resolveAnimationRootPath('Root/Coin/AP', '')).toBe('Root/Coin');
  });

  it('resolves a self root_node (.) to the player', () => {
    expect(resolveAnimationRootPath('Root/Coin/AP', 'NodePath(".")')).toBe('Root/Coin/AP');
  });

  it('resolves a root_node that descends past a sibling', () => {
    expect(resolveAnimationRootPath('Root/Rig/AP', 'NodePath("../../Body/Mesh")')).toBe('Root/Body/Mesh');
  });

  it('accepts the bare path text as well as the NodePath literal', () => {
    expect(resolveAnimationRootPath('Root/Rig/AP', '..')).toBe('Root/Rig');
  });

  it('is null for a root_node that climbs above the scene root', () => {
    expect(resolveAnimationRootPath('Root/AP', 'NodePath("../..")')).toBeNull();
  });
});
