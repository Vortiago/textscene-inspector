/**
 * Godot's per-track `interp` mode reaches the THREE KeyframeTrack.
 *
 * `buildTracks` never called `setInterpolation`, so every track played back
 * LINEAR whatever the scene said — a NEAREST track that should hold its value
 * between keys eased through them instead.
 *
 * `Animation.InterpolationType`: NEAREST 0, LINEAR 1 (the default when the key
 * is absent — `animation.h`: `InterpolationType interpolation = INTERPOLATION_LINEAR`),
 * CUBIC 2, LINEAR_ANGLE 3, CUBIC_ANGLE 4. NEAREST is a step/hold —
 * `animation.cpp` returns `p_keys[idx].value` for the key at-or-before the
 * time, not a round-to-nearest — so it maps to three's InterpolateDiscrete.
 *
 * One extra constraint from the same file: a VALUE track whose
 * `update_mode` is UPDATE_DISCRETE (1) is FORCED to NEAREST regardless of
 * `interp`.
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
  const clip = buildClip(animation(track));
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
