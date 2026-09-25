import { describe, expect, it } from 'vitest';
import { resolveAnimationRootPath, resolveTrackScenePath } from './animationRoot';

describe('resolveAnimationRootPath', () => {
  it('resolves the default root_node (..) to the player’s parent', () => {
    expect(resolveAnimationRootPath('Root/Coin/AnimationPlayer', 'NodePath("..")')).toBe('Root/Coin');
  });

  it('is null for an empty root_node, which get_node_or_null refuses (node.cpp:1894)', () => {
    expect(resolveAnimationRootPath('Root/Coin/AP', 'NodePath("")')).toBeNull();
  });

  it('is null for an absolute root_node, which measures from a SceneTree the preview has not', () => {
    expect(resolveAnimationRootPath('Root/Coin/AP', 'NodePath("/root/Main")')).toBeNull();
  });

  it('resolves a %Name root_node through the owner’s unique-name table', () => {
    const uniquePaths = new Map([['%Rig', 'Root/Body/Rig']]);
    expect(resolveAnimationRootPath('Root/AP', 'NodePath("%Rig")', uniquePaths)).toBe('Root/Body/Rig');
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

describe('resolveTrackScenePath', () => {
  it('walks a track path from the animation root', () => {
    expect(resolveTrackScenePath('Root/Rig', '../Lamp')).toBe('Root/Lamp');
  });

  it('resolves a %Name track through the owner’s unique-name table', () => {
    const uniquePaths = new Map([['%Lamp', 'Root/Props/Lamp']]);
    expect(resolveTrackScenePath('Root', '%Lamp', uniquePaths)).toBe('Root/Props/Lamp');
  });

  it('is null for a %Name no node claims', () => {
    expect(resolveTrackScenePath('Root', '%Lamp', new Map())).toBeNull();
  });

  it('is null for an absolute track path', () => {
    expect(resolveTrackScenePath('Root', '/root/Main/Lamp')).toBeNull();
  });
});
