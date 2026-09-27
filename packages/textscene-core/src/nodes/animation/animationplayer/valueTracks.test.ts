import { describe, it, expect } from 'vitest';
import {
  sampleSteppedValue,
  sampleInterpolatedValue,
} from './valueTracks';
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

describe('sampleInterpolatedValue', () => {
  // A Color fade (1,1,1,1) → (1,1,1,0) over 5s, linear (interp=1).
  const fade: GodotKeyframe[] = [
    { time: 0, value: [1, 1, 1, 1], transition: 1 },
    { time: 5, value: [1, 1, 1, 0], transition: 1 },
  ];
  // A Vector3 grow (0,0,0) → (2,2,2) over 0.2s, linear.
  const grow: GodotKeyframe[] = [
    { time: 0, value: [0, 0, 0], transition: 1 },
    { time: 0.2, value: [2, 2, 2], transition: 1 },
  ];

  it('linearly interpolates each component between bracketing keyframes', () => {
    expect(sampleInterpolatedValue(fade, 2.5, 1)).toEqual([1, 1, 1, 0.5]);
    expect(sampleInterpolatedValue(grow, 0.1, 1)).toEqual([1, 1, 1]);
    expect(sampleInterpolatedValue(grow, 0.05, 1)).toEqual([0.5, 0.5, 0.5]);
  });

  it('holds the endpoint keys before the start and after the end', () => {
    expect(sampleInterpolatedValue(fade, -1, 1)).toEqual([1, 1, 1, 1]);
    expect(sampleInterpolatedValue(fade, 10, 1)).toEqual([1, 1, 1, 0]);
  });

  it('returns the exact keyframe value at a key time', () => {
    expect(sampleInterpolatedValue(fade, 0, 1)).toEqual([1, 1, 1, 1]);
    expect(sampleInterpolatedValue(fade, 5, 1)).toEqual([1, 1, 1, 0]);
  });

  it('interp=0 (nearest) holds the earlier key instead of lerping', () => {
    expect(sampleInterpolatedValue(grow, 0.1, 0)).toEqual([0, 0, 0]);
    expect(sampleInterpolatedValue(grow, 0.19, 0)).toEqual([0, 0, 0]);
  });

  it('returns an empty tuple for an empty track', () => {
    expect(sampleInterpolatedValue([], 1, 1)).toEqual([]);
  });
});
