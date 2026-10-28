/**
 * The bone tracks of a clip, `position_3d`, `rotation_3d` and `scale_3d` on `Skeleton3D:<bone>`, and
 * the poses they write to the skeletons at a time. `AnimationMixer` writes each sampled part to the
 * bone pose (`animation_mixer.cpp:1878-1891`), and the Skeleton3D pass skins the result.
 */

import type { Quaternion } from '../../../godot/math/quaternion.js';
import { storedReal } from '../../../godot/math/real.js';
import type { Vector3 } from '../../../godot/math/vector.js';
import {
  sampleQuaternionTrack,
  sampleVector3Track,
  type SampleSetup,
  type TrackKey,
} from '../../../godot/scene/animationTrackSampler.js';
import type { AnimatedPose, BonePose } from '../../3d/skeleton3d/skeletonPose';
import type { GodotAnimation, GodotKeyframe, GodotTrack } from './animationResolver';

type BoneTrackKeys =
  | { part: 'position' | 'scale'; keys: TrackKey<Vector3>[] }
  | { part: 'rotation'; keys: TrackKey<Quaternion>[] };

/** One track that writes a part of the pose of `bone` on the Skeleton3D at `skeletonPath`. */
export type BoneTrack = BoneTrackKeys & { skeletonPath: string; bone: string; setup: SampleSetup };

/** The poses a clip writes, by the live path of each Skeleton3D. */
export type SkeletonPoses = ReadonlyMap<string, AnimatedPose>;

/**
 * The bone tracks of `animation`, each on the skeleton `scenePathOf` finds for it. A track whose
 * path leaves the scene has no skeleton to write, and a track on no bone is a track on a node.
 */
export function boneTracksOf(
  animation: GodotAnimation,
  scenePathOf: (targetPath: string) => string | null
): BoneTrack[] {
  const tracks: BoneTrack[] = [];
  for (const track of animation.tracks) {
    const skeletonPath = track.bone === undefined ? null : scenePathOf(track.targetPath);
    if (track.bone === undefined || skeletonPath === null) continue;
    const setup: SampleSetup = {
      interp: track.interp,
      loopWrap: track.loopWrap,
      length: storedReal(animation.length),
      loopMode: animation.loopMode,
    };
    tracks.push({ skeletonPath, bone: track.bone, setup, ...keysOf(track) });
  }
  return tracks;
}

/** The keys of a bone track as `real_t` values, which are what `Animation` holds. */
function keysOf(track: GodotTrack): BoneTrackKeys {
  switch (track.property) {
    case 'quaternion':
      return { part: 'rotation', keys: track.keys.map((key) => keyOf(key, quaternionOf)) };
    case 'scale':
      return { part: 'scale', keys: track.keys.map((key) => keyOf(key, vector3Of)) };
    default:
      return { part: 'position', keys: track.keys.map((key) => keyOf(key, vector3Of)) };
  }
}

function keyOf<T>(key: GodotKeyframe, read: (components: number[]) => T): TrackKey<T> {
  return {
    time: storedReal(key.time),
    transition: storedReal(key.transition),
    value: read(Array.isArray(key.value) ? (key.value as number[]) : []),
  };
}

function vector3Of([x = 0, y = 0, z = 0]: number[]): Vector3 {
  return { x: storedReal(x), y: storedReal(y), z: storedReal(z) };
}

function quaternionOf([x = 0, y = 0, z = 0, w = 1]: number[]): Quaternion {
  return { x: storedReal(x), y: storedReal(y), z: storedReal(z), w: storedReal(w) };
}

/**
 * The poses `tracks` write at `time`, by skeleton. A track with no sample at that time, as one with
 * every key past the clip, writes nothing, so the bone keeps the pose of the file for that part.
 * Where two tracks write one part of one bone, the later one wins.
 */
export function sampleBonePoses(tracks: readonly BoneTrack[], time: number): SkeletonPoses {
  const poses = new Map<string, Map<string, BonePose>>();
  for (const track of tracks) {
    const sampled =
      track.part === 'rotation'
        ? sampleQuaternionTrack(track.keys, time, track.setup)
        : sampleVector3Track(track.keys, time, track.setup);
    if (sampled === null) continue;
    const bones = poses.get(track.skeletonPath) ?? new Map<string, BonePose>();
    bones.set(track.bone, { ...bones.get(track.bone), [track.part]: sampled });
    poses.set(track.skeletonPath, bones);
  }
  return poses;
}
