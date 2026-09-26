/**
 * Godot's per-track `interp` reaches the THREE KeyframeTrack. `Animation.InterpolationType` is
 * NEAREST 0, LINEAR 1 (the default when the key is absent, `animation.h`), CUBIC 2, LINEAR_ANGLE 3,
 * CUBIC_ANGLE 4. NEAREST holds the key at or before the time (`animation.cpp`), so it maps to
 * InterpolateDiscrete. A VALUE track with `update_mode` UPDATE_DISCRETE (1) is always NEAREST.
 */
import { describe, expect, it } from 'vitest';
import { InterpolateDiscrete, InterpolateLinear, InterpolateSmooth } from 'three';
import { buildClip } from './clipBuilder';
import type { GodotAnimation, GodotTrack } from './animationResolver';

function animation(track: Partial<GodotTrack>): GodotAnimation {
  return {
    name: 'A',
    length: 1,
    loopMode: 0,
    step: 0.1,
    tracks: [
      {
        type: 'value',
        targetPath: 'Target',
        property: 'position',
        interp: 1,
        keys: [
          { time: 0, value: [0, 0, 0] },
          { time: 1, value: [1, 0, 0] },
        ],
        ...track,
      } as GodotTrack,
    ],
  };
}

function interpolationOf(track: Partial<GodotTrack>) {
  // The path is irrelevant to interpolation, so the NodePath stands in for the scene path.
  const clip = buildClip(animation(track), (targetPath) => targetPath);
  return (clip.tracks[0] as unknown as { getInterpolation(): number }).getInterpolation();
}

describe('track interpolation', () => {
  it('holds the previous value for NEAREST (a step, not a round)', () => {
    expect(interpolationOf({ interp: 0 })).toBe(InterpolateDiscrete);
  });

  it('interpolates linearly for LINEAR, the absent-key default', () => {
    expect(interpolationOf({ interp: 1 })).toBe(InterpolateLinear);
  });

  it('smooths CUBIC', () => {
    expect(interpolationOf({ interp: 2 })).toBe(InterpolateSmooth);
  });

  it('treats the shortest-path angle variants as their base mode', () => {
    expect(interpolationOf({ interp: 3 })).toBe(InterpolateLinear);
    expect(interpolationOf({ interp: 4 })).toBe(InterpolateSmooth);
  });

  it('forces NEAREST for a VALUE track in UPDATE_DISCRETE mode', () => {
    expect(interpolationOf({ interp: 2, updateMode: 1 })).toBe(InterpolateDiscrete);
  });

  it('leaves UPDATE_CONTINUOUS value tracks alone', () => {
    expect(interpolationOf({ interp: 2, updateMode: 0 })).toBe(InterpolateSmooth);
  });
});
