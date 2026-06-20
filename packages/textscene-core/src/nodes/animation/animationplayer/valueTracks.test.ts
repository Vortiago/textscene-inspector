import { describe, it, expect } from 'vitest';
import { sampleSteppedValue, resolveTargetNodePath } from './valueTracks';
import type { GodotKeyframe } from './animationResolver';

const keys: GodotKeyframe[] = [
  { time: 0, value: 0, transition: 1 },
  { time: 0.1, value: 1, transition: 1 },
  { time: 0.2, value: 2, transition: 1 },
  { time: 0.3, value: 3, transition: 1 },
];

describe('sampleSteppedValue', () => {
  it('returns the value of the last key at or before the time', () => {
    expect(sampleSteppedValue(keys, 0)).toBe(0);
    expect(sampleSteppedValue(keys, 0.05)).toBe(0);
    expect(sampleSteppedValue(keys, 0.1)).toBe(1);
    expect(sampleSteppedValue(keys, 0.15)).toBe(1);
    expect(sampleSteppedValue(keys, 0.2)).toBe(2);
    expect(sampleSteppedValue(keys, 0.3)).toBe(3);
  });

  it('holds the final value past the last key', () => {
    expect(sampleSteppedValue(keys, 5)).toBe(3);
  });

  it('returns the first value before the track starts, and 0 for an empty track', () => {
    expect(sampleSteppedValue(keys, -1)).toBe(0);
    expect(sampleSteppedValue([], 1)).toBe(0);
  });
});

describe('resolveTargetNodePath', () => {
  it('resolves a direct-child target under the default root_node (..)', () => {
    expect(resolveTargetNodePath('Coin/AnimationPlayer', 'NodePath("..")', 'Sprite2D')).toBe(
      'Coin/Sprite2D'
    );
    expect(resolveTargetNodePath('Root/Coin/AnimationPlayer', 'NodePath("..")', 'Sprite2D')).toBe(
      'Root/Coin/Sprite2D'
    );
  });

  it('handles a self root_node (.) and deep relative targets', () => {
    expect(resolveTargetNodePath('Coin/AP', 'NodePath(".")', 'Sprite2D')).toBe('Coin/AP/Sprite2D');
    expect(resolveTargetNodePath('A/B/AP', 'NodePath("..")', '../C/Sprite')).toBe('A/C/Sprite');
  });

  it('defaults to the parent when root_node is absent', () => {
    expect(resolveTargetNodePath('Coin/AP', '', 'Sprite2D')).toBe('Coin/Sprite2D');
  });
});
