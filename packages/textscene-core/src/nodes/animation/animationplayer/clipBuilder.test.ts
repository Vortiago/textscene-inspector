/**
 * clipBuilder tests — GodotAnimation -> THREE.AnimationClip.
 *
 * Verifies KeyframeTrack names (name-path binding targets), times, and the
 * value mapping (incl. rotation_degrees -> radians, and 2D Vector2/scalar
 * decomposition into per-component tracks).
 */

import { describe, it, expect } from 'vitest';
import { AnimationMixer, LoopOnce, LoopPingPong, LoopRepeat, Object3D } from 'three';
import { buildClip, loopSettingsFor } from './clipBuilder';
import type { GodotAnimation, GodotTrack } from './animationResolver';

const DEG2RAD = Math.PI / 180;

function anim(name: string, length: number, tracks: GodotTrack[]): GodotAnimation {
  return { name, length, loopMode: 0, step: 0.1, tracks };
}

function track(property: string, keys: GodotTrack['keys'], targetPath = 'Target'): GodotTrack {
  return { type: 'value', targetPath, property, interp: 1, keys };
}

function findTrack(clip: ReturnType<typeof buildClip>, name: string) {
  return clip.tracks.find((t) => t.name === name);
}

/** THREE stores KeyframeTrack values as Float32Array, so compare with tolerance. */
function expectValuesCloseTo(actual: ArrayLike<number>, expected: number[]) {
  expect(actual.length).toBe(expected.length);
  expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 5));
}

describe('loopSettingsFor — Godot loop_mode mapping', () => {
  it('maps loop_mode 0 (none) to play-once, clamped', () => {
    expect(loopSettingsFor(0)).toEqual({ loop: LoopOnce, repetitions: 1, clampWhenFinished: true });
  });

  it('maps loop_mode 1 (linear) to repeat', () => {
    expect(loopSettingsFor(1)).toEqual({
      loop: LoopRepeat,
      repetitions: Infinity,
      clampWhenFinished: false,
    });
  });

  it('maps loop_mode 2 (ping-pong) to LoopPingPong', () => {
    expect(loopSettingsFor(2).loop).toBe(LoopPingPong);
  });
});

describe('buildClip — clip metadata', () => {
  it('names the clip and sets its duration from the animation length', () => {
    const clip = buildClip(anim('idle', 2.5, []));
    expect(clip.name).toBe('idle');
    expect(clip.duration).toBe(2.5);
  });
});

describe('buildClip — position (C1)', () => {
  it('maps a Vector3 position track to <path>.position with flattened values', () => {
    const clip = buildClip(
      anim('a', 1, [
        track('position', [
          { time: 0, value: [0, 0, 0], transition: 1 },
          { time: 1, value: [1, 2, 3], transition: 1 },
        ]),
      ])
    );
    const t = findTrack(clip, 'Target.position');
    expect(t).toBeDefined();
    expect(Array.from(t!.times)).toEqual([0, 1]);
    expect(Array.from(t!.values)).toEqual([0, 0, 0, 1, 2, 3]);
  });
});

describe('buildClip — rotation (C2/C3)', () => {
  it('converts a Vector3 rotation_degrees track to per-component radians on <path>.rotation[xyz]', () => {
    const clip = buildClip(
      anim('a', 1, [track('rotation_degrees', [{ time: 0, value: [90, 0, 180], transition: 1 }])])
    );
    expectValuesCloseTo(findTrack(clip, 'Target.rotation[x]')!.values, [90 * DEG2RAD]);
    expectValuesCloseTo(findTrack(clip, 'Target.rotation[y]')!.values, [0]);
    expectValuesCloseTo(findTrack(clip, 'Target.rotation[z]')!.values, [180 * DEG2RAD]);
  });

  it('passes a Vector3 rotation (radians) track through per component', () => {
    const clip = buildClip(
      anim('a', 1, [track('rotation', [{ time: 0, value: [0, 1.5708, 0], transition: 1 }])])
    );
    expectValuesCloseTo(findTrack(clip, 'Target.rotation[y]')!.values, [1.5708]);
    expect(findTrack(clip, 'Target.rotation')).toBeUndefined();
  });

  it('maps a scalar 2D rotation track to <path>.rotation[z]', () => {
    const clip = buildClip(
      anim('a', 1, [track('rotation', [{ time: 0, value: 0, transition: 1 }, { time: 1, value: 1.5708, transition: 1 }])])
    );
    const t = findTrack(clip, 'Target.rotation[z]');
    expect(t).toBeDefined();
    expectValuesCloseTo(t!.values, [0, 1.5708]);
  });
});

describe('buildClip — rotation actually drives the quaternion (regression)', () => {
  it('a built rotation clip updates the target quaternion through a mixer', () => {
    const child = new Object3D();
    child.name = 'Target';
    const root = new Object3D();
    root.add(child);

    const clip = buildClip(
      anim('spin', 2, [
        track('rotation', [
          { time: 0, value: [0, 0, 0], transition: 1 },
          { time: 2, value: [0, Math.PI, 0], transition: 1 },
        ]),
      ])
    );
    const mixer = new AnimationMixer(root);
    mixer.clipAction(clip).play();
    mixer.update(1); // half a 180° turn about Y

    // The matrix is built from the quaternion — assert IT moved, not just euler.
    expect(Math.abs(child.quaternion.y)).toBeGreaterThan(0.1);
  });
});

describe('buildClip — scale (C4) and 2D decomposition', () => {
  it('maps a Vector3 scale track to <path>.scale', () => {
    const clip = buildClip(
      anim('a', 1, [track('scale', [{ time: 0, value: [2, 2, 2], transition: 1 }])])
    );
    expect(findTrack(clip, 'Target.scale')).toBeDefined();
  });

  it('decomposes a Vector2 position track into <path>.position[x] and [y]', () => {
    const clip = buildClip(
      anim('a', 1, [
        track('position', [
          { time: 0, value: [0, 0], transition: 1 },
          { time: 1, value: [10, -5], transition: 1 },
        ]),
      ])
    );
    const x = findTrack(clip, 'Target.position[x]');
    const y = findTrack(clip, 'Target.position[y]');
    expect(Array.from(x!.values)).toEqual([0, 10]);
    expect(Array.from(y!.values)).toEqual([0, -5]);
  });
});

describe('buildClip — unsupported property (C5)', () => {
  it('omits tracks for properties outside the slice-1 transform set', () => {
    const clip = buildClip(
      anim('a', 1, [
        track('modulate', [{ time: 0, value: [1, 1, 1], transition: 1 }]),
        track('position', [{ time: 0, value: [1, 2, 3], transition: 1 }]),
      ])
    );
    expect(clip.tracks.map((t) => t.name)).toEqual(['Target.position']);
  });
});
