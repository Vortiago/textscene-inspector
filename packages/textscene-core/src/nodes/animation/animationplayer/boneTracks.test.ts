/**
 * The bone tracks of a clip and the poses they write at a time. The sampling itself is tested
 * against Godot in `animationTrackSampler.test.ts`; these tests read what a clip hands the skeletons.
 */

import { describe, expect, it } from 'vitest';
import { boneTracksOf, sampleBonePoses, type BoneTrackSource } from './boneTracks';
import type { GodotTrack } from './trackParser';

const SKELETON = 'Root/Skeleton3D';
const ANIMATION = { length: 1, loopMode: 0 };

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

const rotation = (bone: string): GodotTrack =>
  track({
    type: 'rotation_3d',
    property: 'quaternion',
    subnames: [bone],
    keys: [
      { time: 0, transition: 1, value: [0, 0, 0, 1] },
      { time: 1, transition: 1, value: [0, 0, 1, 0] },
    ],
  });

/** The tracks, each on the skeleton `Root/<its target path>`. */
function sources(...tracks: GodotTrack[]): BoneTrackSource[] {
  return tracks.map((t) => ({ track: t, skeletonPath: `Root/${t.targetPath}` }));
}

describe('boneTracksOf', () => {
  it('groups the tracks that name one bone, in track order', () => {
    const grouped = boneTracksOf(sources(track({}), rotation('b1'), track({})), ANIMATION);

    expect(grouped.map(({ skeletonPath, bone }) => [skeletonPath, bone])).toEqual([[SKELETON, 'b1']]);
    expect(grouped[0]!.positions).toHaveLength(2);
    expect(grouped[0]!.rotations).toHaveLength(1);
  });

  it('keeps the bones of one skeleton, and two skeletons, apart', () => {
    const grouped = boneTracksOf(
      sources(track({}), track({ subnames: ['b2'] }), track({ targetPath: 'Other' })),
      ANIMATION
    );

    expect(grouped.map(({ skeletonPath, bone }) => [skeletonPath, bone])).toEqual([
      [SKELETON, 'b1'],
      [SKELETON, 'b2'],
      ['Root/Other', 'b1'],
    ]);
  });

  it('sorts a track into position, rotation or scale by its property', () => {
    const [bone] = boneTracksOf(sources(track({}), rotation('b1'), track({ property: 'scale' })), ANIMATION);

    expect([bone!.positions.length, bone!.rotations.length, bone!.scales.length]).toEqual([1, 1, 1]);
  });
});

describe('sampleBonePoses', () => {
  const posesOf = (time: number, ...tracks: GodotTrack[]) =>
    sampleBonePoses(boneTracksOf(sources(...tracks), ANIMATION), time);

  it('writes each sampled part to its bone, and leaves a part no track keys out of the pose', () => {
    const pose = posesOf(0.5, track({})).get(SKELETON)!.get('b1')!;

    expect(pose).toEqual({ position: [{ x: 1, y: 2, z: 3 }] });
  });

  it('gathers the parts of one bone, and the bones of one skeleton', () => {
    const poses = posesOf(0, track({}), rotation('b1'), rotation('b2'));

    expect([...poses.get(SKELETON)!.keys()]).toEqual(['b1', 'b2']);
    const keyedParts = Object.entries(poses.get(SKELETON)!.get('b1')!).filter(([, tracks]) => tracks);
    expect(keyedParts.map(([part]) => part)).toEqual(['position', 'rotation']);
  });

  it('keeps one value for each track of a part, for the accumulation of two tracks on one bone', () => {
    const second = track({ keys: [{ time: 0, transition: 1, value: [1, 1, 1] }] });

    expect(posesOf(0, track({}), second).get(SKELETON)!.get('b1')!.position).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
    ]);
  });

  it('keeps the skeletons apart', () => {
    const poses = posesOf(0, track({}), track({ targetPath: 'Other' }));

    expect([...poses.keys()]).toEqual([SKELETON, 'Root/Other']);
  });

  it('writes nothing for a track whose every key lies past the clip length', () => {
    const late = track({ keys: [{ time: 5, transition: 1, value: [1, 1, 1] }] });

    expect(posesOf(0.5, late).size).toBe(0);
  });

  it('rounds key values to float32, which is what Animation stores', () => {
    const exact = track({ keys: [{ time: 0, transition: 1, value: [0.1, 0, 0] }] });

    expect(posesOf(0, exact).get(SKELETON)!.get('b1')!.position![0]!.x).toBe(Math.fround(0.1));
  });
});
