import { describe, expect, it } from 'vitest';
import {
  sampleCrossedBackward,
  sampleQuaternionTrack,
  sampleTupleTrack,
  sampleVector3Track,
  type SampleSetup,
  type TrackKey,
} from './animationTrackSampler.js';
import type { Quaternion } from '../math/quaternion.js';
import type { Vector3 } from '../math/vector.js';
import measured from './animationTrackSampler.godot.json';

/**
 * Every case is a track Godot 4.6.3 built with `Animation`, and the values its
 * `position_track_interpolate` family returned at each time. Regenerate the file with
 * `testing/animationTrackSampler/measure.mjs`.
 */
type Row = number[];
interface MeasuredCase extends SampleSetup {
  keys: Row[];
  samples: Row[];
}

const SAMPLE_DIGITS = 5;

const vector = ([x, y, z]: Row): Vector3 => ({ x: x!, y: y!, z: z! });
const quaternion = ([x, y, z, w]: Row): Quaternion => ({ x: x!, y: y!, z: z!, w: w! });

function keysOf<T>(rows: Row[], read: (components: Row) => T): TrackKey<T>[] {
  return rows.map(([time, transition, ...components]) => ({
    time: time!,
    transition: transition!,
    value: read(components),
  }));
}

const cases = Object.entries(measured as Record<string, MeasuredCase>);
const vectorCases = cases.filter(([name]) => name.startsWith('vec_'));
const rotationCases = cases.filter(([name]) => name.startsWith('rot_'));
const colourCases = cases.filter(([name]) => name.startsWith('col_'));

describe('sampleVector3Track', () => {
  it.each(vectorCases)('%s samples as Godot does', (_name, track) => {
    const keys = keysOf(track.keys, vector);
    for (const [time, ...expected] of track.samples) {
      const sampled = sampleVector3Track(keys, time!, track)!;
      expect([sampled.x, sampled.y, sampled.z]).toEqual(
        expected.map((component) => expect.closeTo(component, SAMPLE_DIGITS))
      );
    }
  });

  it('has no sample for a track with no key, as the mixer leaves the bone alone', () => {
    expect(sampleVector3Track([], 0.5, { ...measured.vec_linear })).toBeNull();
  });

  it('has no sample when every key lies past the clip length', () => {
    const keys = [{ time: 2, transition: 1, value: { x: 1, y: 1, z: 1 } }];
    expect(sampleVector3Track(keys, 0.5, { ...measured.vec_linear, length: 1 })).toBeNull();
  });

  it('holds the only key', () => {
    const keys = [{ time: 0.4, transition: 1, value: { x: 1, y: 2, z: 3 } }];
    expect(sampleVector3Track(keys, 0.9, { ...measured.vec_linear })).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe('sampleQuaternionTrack', () => {
  it.each(rotationCases)('%s samples as Godot does', (_name, track) => {
    const keys = keysOf(track.keys, quaternion);
    for (const [time, ...expected] of track.samples) {
      const sampled = sampleQuaternionTrack(keys, time!, track)!;
      expect([sampled.x, sampled.y, sampled.z, sampled.w]).toEqual(
        expected.map((component) => expect.closeTo(component, SAMPLE_DIGITS))
      );
    }
  });
});

describe('sampleTupleTrack', () => {
  it.each(colourCases)('%s samples as Godot does', (_name, track) => {
    const keys = keysOf(track.keys, (components) => components);
    for (const [time, ...expected] of track.samples) {
      expect(sampleTupleTrack(keys, time!, track)).toEqual(
        expected.map((component) => expect.closeTo(component, SAMPLE_DIGITS))
      );
    }
  });

  it('has no sample for a track with no key', () => {
    expect(sampleTupleTrack([], 0.5, { ...measured.col_linear })).toBeNull();
  });
});

describe('sampleCrossedBackward', () => {
  // A flipbook of four frames. Each expected frame is what Godot 4.6.3 shows on the return pass of
  // a ping-pong of this one-second clip, as `AnimationPlayer.advance(0.1)` steps it back.
  const frames = [0, 0.25, 0.5, 0.75].map((time, frame) => ({ time, transition: 1, value: frame }));

  it.each([
    [0.9, 3],
    [0.8, 3],
    [0.7, 3],
    [0.6, 3],
    [0.5, 2],
    [0.4, 2],
    [0.3, 2],
    [0.2, 1],
    [0.1, 1],
  ])('at %f s shows the key the playhead last crossed, frame %i', (time, frame) => {
    expect(sampleCrossedBackward(frames, time, 1)).toBe(frame);
  });

  it('does not read a key past the clip length', () => {
    expect(sampleCrossedBackward(frames, 0.55, 0.6)).toBe(2);
  });

  it('has no sample for a track with no key', () => {
    expect(sampleCrossedBackward([], 0.5, 1)).toBeNull();
  });
});
