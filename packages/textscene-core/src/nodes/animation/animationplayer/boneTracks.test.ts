/**
 * The bone tracks of a clip and the poses they write at a time. The sampling itself is tested
 * against Godot in `animationTrackSampler.test.ts`; these tests read what a clip hands the skeletons.
 */

import { describe, expect, it } from 'vitest';
import { boneTracksOf, sampleBonePoses } from './boneTracks';
import type { GodotAnimation, GodotTrack } from './animationResolver';

const SKELETON = 'Root/Skeleton3D';

function track(overrides: Partial<GodotTrack>): GodotTrack {
  return {
    type: 'position_3d',
    targetPath: 'Skeleton3D',
    bone: 'b1',
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

const rotation = (bone: string): GodotTrack =>
  track({
    type: 'rotation_3d',
    property: 'quaternion',
    bone,
    keys: [
      { time: 0, transition: 1, value: [0, 0, 0, 1] },
      { time: 1, transition: 1, value: [0, 0, 1, 0] },
    ],
  });

function clip(...tracks: GodotTrack[]): GodotAnimation {
  return { name: 'bend', length: 1, loopMode: 0, step: 0.1, tracks };
}

const underRoot = (targetPath: string) => `Root/${targetPath}`;

describe('boneTracksOf', () => {
  it('lists the tracks that name a bone, each on the skeleton the scene path names', () => {
    const tracks = boneTracksOf(clip(track({}), track({ bone: undefined, targetPath: 'Mesh' })), underRoot);

    expect(tracks.map(({ skeletonPath, bone, part }) => [skeletonPath, bone, part])).toEqual([
      [SKELETON, 'b1', 'position'],
    ]);
  });

  it('leaves out a track whose path leaves the scene, as the clip builder warns for it', () => {
    expect(boneTracksOf(clip(track({})), () => null)).toEqual([]);
  });

  it('names the part by the track type: position, rotation or scale', () => {
    const tracks = boneTracksOf(clip(track({}), rotation('b1'), track({ property: 'scale' })), underRoot);

    expect(tracks.map(({ part }) => part)).toEqual(['position', 'rotation', 'scale']);
  });
});

describe('sampleBonePoses', () => {
  it('writes each sampled part to its bone, and leaves a part no track keys out of the pose', () => {
    const poses = sampleBonePoses(boneTracksOf(clip(track({})), underRoot), 0.5);

    expect(poses.get(SKELETON)!.get('b1')).toEqual({ position: { x: 1, y: 2, z: 3 } });
  });

  it('gathers the parts of one bone, and the bones of one skeleton', () => {
    const poses = sampleBonePoses(
      boneTracksOf(clip(track({}), rotation('b1'), rotation('b2')), underRoot),
      0
    );

    expect([...poses.get(SKELETON)!.keys()]).toEqual(['b1', 'b2']);
    expect(Object.keys(poses.get(SKELETON)!.get('b1')!)).toEqual(['position', 'rotation']);
  });

  it('keeps the skeletons apart', () => {
    const poses = sampleBonePoses(
      boneTracksOf(clip(track({}), track({ targetPath: 'Other' })), underRoot),
      0
    );

    expect([...poses.keys()]).toEqual([SKELETON, 'Root/Other']);
  });

  it('writes nothing for a track whose every key lies past the clip length', () => {
    const late = track({ keys: [{ time: 5, transition: 1, value: [1, 1, 1] }] });

    expect(sampleBonePoses(boneTracksOf(clip(late), underRoot), 0.5).size).toBe(0);
  });

  it('rounds key values to float32, which is what Animation stores', () => {
    const exact = track({ keys: [{ time: 0, transition: 1, value: [0.1, 0, 0] }] });

    const pose = sampleBonePoses(boneTracksOf(clip(exact), underRoot), 0)
      .get(SKELETON)!
      .get('b1')!;

    expect(pose.position!.x).toBe(Math.fround(0.1));
  });
});
