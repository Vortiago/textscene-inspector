/**
 * The tracks of a clip sorted by what plays them. Which node a path names decides it: one subname
 * on a Skeleton3D is a bone, and the same path on any other node moves the node.
 */

import { describe, expect, it } from 'vitest';
import type { GodotAnimation } from './animationResolver';
import { splitTracks, type TrackScene } from './drivenTracks';
import type { GodotTrack } from './trackParser';

const SCENE: TrackScene = {
  scenePathOf: (targetPath) => (targetPath.startsWith('Away') ? null : `Root/${targetPath}`),
  isSkeleton: (scenePath) => scenePath === 'Root/Skeleton3D',
};

function track(overrides: Partial<GodotTrack>): GodotTrack {
  return {
    type: 'position_3d',
    targetPath: 'Skeleton3D',
    subnames: ['b1'],
    property: 'position',
    interp: 1,
    loopWrap: true,
    keys: [
      { time: 0, transition: 1, value: [0, 0, 0] },
      { time: 1, transition: 1, value: [2, 4, 6] },
    ],
    ...overrides,
  };
}

function clip(...tracks: GodotTrack[]): GodotAnimation {
  return { name: 'a', length: 5, loopMode: 0, step: 0.1, tracks };
}

const FADE = (overrides: Partial<GodotTrack> = {}) =>
  track({
    type: 'value',
    targetPath: 'Decal',
    subnames: [],
    property: 'modulate',
    keys: [
      { time: 0, transition: 1, value: [1, 1, 1, 1] },
      { time: 5, transition: 1, value: [1, 1, 1, 0] },
    ],
    ...overrides,
  });

describe('splitTracks', () => {
  it('gives a track with one subname on a Skeleton3D to the bones', () => {
    const driven = splitTracks(clip(track({})), SCENE);

    expect(driven.bones.map(({ skeletonPath, bone }) => [skeletonPath, bone])).toEqual([
      ['Root/Skeleton3D', 'b1'],
    ]);
    expect(driven.mixer.tracks).toEqual([]);
  });

  it('leaves a track with one subname on any other node to the mixer, as Godot moves the node', () => {
    const onNode = track({ targetPath: 'Mesh', subnames: ['b1'] });

    const driven = splitTracks(clip(onNode), SCENE);

    expect(driven.mixer.tracks).toEqual([onNode]);
    expect(driven.bones).toEqual([]);
  });

  it('leaves a track with two subnames on a Skeleton3D to the mixer, which moves the skeleton node', () => {
    const twoNames = track({ subnames: ['b1', 'x'] });

    expect(splitTracks(clip(twoNames), SCENE).mixer.tracks).toEqual([twoNames]);
  });

  it('leaves a track with no subname on a Skeleton3D to the mixer', () => {
    const none = track({ subnames: [] });

    expect(splitTracks(clip(none), SCENE).mixer.tracks).toEqual([none]);
  });

  it('keeps a track whose path leaves the scene with the mixer, whose builder warns and drops it', () => {
    const away = track({ targetPath: 'Away' });
    const awayFade = FADE({ targetPath: 'Away' });

    expect(splitTracks(clip(away, awayFade), SCENE).mixer.tracks).toEqual([away, awayFade]);
  });

  it('groups the tracks of one bone, in track order, and the tracks of two bones apart', () => {
    const rotation = track({
      type: 'rotation_3d',
      property: 'quaternion',
      keys: [{ time: 0, transition: 1, value: [0, 0, 0, 1] }],
    });
    const second = track({ subnames: ['b2'] });

    const { bones } = splitTracks(clip(track({}), rotation, second, track({})), SCENE);

    expect(bones.map(({ bone, positions, rotations }) => [bone, positions.length, rotations.length])).toEqual(
      [
        ['b1', 2, 1],
        ['b2', 1, 0],
      ]
    );
  });

  it('gives a continuous value track a sampler that lerps between the keys', () => {
    const { values, mixer } = splitTracks(clip(FADE()), SCENE);

    expect(mixer.tracks).toEqual([]);
    expect(values.map(({ path, property }) => [path, property])).toEqual([['Root/Decal', 'modulate']]);
    expect(values[0]!.sample(2.5)).toEqual([1, 1, 1, 0.5]);
  });

  it('holds the endpoint keys before the start and after the end of a value track', () => {
    const [fade] = splitTracks(clip(FADE()), SCENE).values;

    expect(fade!.sample(-1)).toEqual([1, 1, 1, 1]);
    expect(fade!.sample(10)).toEqual([1, 1, 1, 0]);
  });

  it('holds the earlier key for nearest interpolation, and for a discrete update mode', () => {
    const [nearest] = splitTracks(clip(FADE({ interp: 0 })), SCENE).values;
    const [discrete] = splitTracks(clip(FADE({ updateMode: 1 })), SCENE).values;

    expect(nearest!.sample(4)).toEqual([1, 1, 1, 1]);
    expect(discrete!.sample(4)).toEqual([1, 1, 1, 1]);
  });

  it('eases and splines a value track as Godot does: transition 2 bends the span and cubic leaves the line', () => {
    const eased = FADE({
      interp: 2,
      keys: [
        { time: 0, transition: 2, value: [0, 0, 0, 0] },
        { time: 2, transition: 1, value: [1, 1, 1, 1] },
        { time: 4, transition: 1, value: [0, 0, 0, 0] },
      ],
    });
    const [target] = splitTracks(clip(eased), SCENE).values;

    expect(target!.sample(1)[0]).not.toBeCloseTo(0.5, 2);
  });

  it('steps a frame track and gives the stepped key as a one-tuple', () => {
    const frame = track({
      type: 'value',
      targetPath: 'Sprite',
      subnames: [],
      property: 'frame',
      keys: [
        { time: 0, transition: 1, value: 0 },
        { time: 1, transition: 1, value: 3 },
      ],
    });
    const [target] = splitTracks(clip(frame), SCENE).values;

    expect(target!.sample(0.5)).toEqual([0]);
    expect(target!.sample(1.5)).toEqual([3]);
  });

  it('returns an empty tuple for a value track with no key to give', () => {
    const [target] = splitTracks(clip(FADE({ keys: [] })), SCENE).values;

    expect(target!.sample(1)).toEqual([]);
  });
});
