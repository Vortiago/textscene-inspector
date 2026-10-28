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

/** One track that writes a part of the pose of `bone` on the Skeleton3D at `skeletonPath`. */
export interface BoneTrack {
  skeletonPath: string;
  bone: string;
  /** The part this track writes at `time`, or null where `Animation` has no sample. */
  sample: (time: number) => BonePose | null;
}

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
    tracks.push({ skeletonPath, bone: track.bone, sample: samplerOf(track, setup) });
  }
  return tracks;
}

/** The sampler of the part a track writes, over its keys as `real_t` values, which are what `Animation` holds. */
function samplerOf(track: GodotTrack, setup: SampleSetup): BoneTrack['sample'] {
  if (track.property === 'quaternion') {
    const keys = track.keys.map((key) => keyOf(key, quaternionOf));
    return (time) => {
      const rotation = sampleQuaternionTrack(keys, time, setup);
      return rotation && { rotation };
    };
  }
  const keys = track.keys.map((key) => keyOf(key, vector3Of));
  const part = track.property === 'scale' ? 'scale' : 'position';
  return (time) => {
    const value = sampleVector3Track(keys, time, setup);
    return value && { [part]: value };
  };
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
export function sampleBonePoses(
  tracks: readonly BoneTrack[],
  time: number
): ReadonlyMap<string, AnimatedPose> {
  const poses = new Map<string, Map<string, BonePose>>();
  for (const track of tracks) {
    const sampled = track.sample(time);
    if (sampled === null) continue;
    const bones = poses.get(track.skeletonPath) ?? new Map<string, BonePose>();
    bones.set(track.bone, { ...bones.get(track.bone), ...sampled });
    poses.set(track.skeletonPath, bones);
  }
  return poses;
}
