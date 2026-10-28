import { describe, it, expect } from 'vitest';
import { sampleSteppedValue } from './valueTracks';
import type { GodotKeyframe } from './trackParser';

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

  it('reads a boolean key as 1 or 0 on a numeric property, as Godot converts it', () => {
    const flips: GodotKeyframe[] = [
      { time: 0, value: false, transition: 1 },
      { time: 0.1, value: true, transition: 1 },
    ];
    expect(sampleSteppedValue(flips, 0)).toBe(0);
    expect(sampleSteppedValue(flips, 0.1)).toBe(1);
  });

  it('returns the first value before the track starts, and 0 for an empty track', () => {
    expect(sampleSteppedValue(keys, -1)).toBe(0);
    expect(sampleSteppedValue([], 1)).toBe(0);
  });
});
