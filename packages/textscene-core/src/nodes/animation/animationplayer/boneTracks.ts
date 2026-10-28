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
import type { GodotAnimation } from './animationResolver';
import type { GodotKeyframe, GodotTrack } from './trackParser';

type Sampler<T> = (time: number) => T | null;

/** The tracks of a clip that write the bone `bone` of the Skeleton3D at `skeletonPath`, in track order. */
export interface BoneTrack {
  skeletonPath: string;
  bone: string;
  positions: Sampler<Vector3>[];
  rotations: Sampler<Quaternion>[];
  scales: Sampler<Vector3>[];
}

/** A track of a clip that names one bone, with the live path of the Skeleton3D it names it on. */
export interface BoneTrackSource {
  track: GodotTrack;
  skeletonPath: string;
}

/** The tracks of `sources` grouped by bone, once, so a frame only samples them. */
export function boneTracksOf(
  sources: readonly BoneTrackSource[],
  animation: Pick<GodotAnimation, 'length' | 'loopMode'>
): BoneTrack[] {
  const grouped = new Map<string, BoneTrack>();
  for (const { track, skeletonPath } of sources) {
    const bone = track.subnames[0]!;
    const key = `${skeletonPath}\0${bone}`;
    let group = grouped.get(key);
    if (!group) {
      group = { skeletonPath, bone, positions: [], rotations: [], scales: [] };
      grouped.set(key, group);
    }
    const setup: SampleSetup = {
      interp: track.interp,
      loopWrap: track.loopWrap,
      length: storedReal(animation.length),
      loopMode: animation.loopMode,
    };
    if (track.property === 'quaternion') {
      const keys = track.keys.map((key) => keyOf(key, quaternionOf));
      group.rotations.push((time) => sampleQuaternionTrack(keys, time, setup));
    } else {
      const keys = track.keys.map((key) => keyOf(key, vector3Of));
      const samplers = track.property === 'scale' ? group.scales : group.positions;
      samplers.push((time) => sampleVector3Track(keys, time, setup));
    }
  }
  return [...grouped.values()];
}

/** A key as `real_t` values, which are what `Animation` holds. */
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
 */
export function sampleBonePoses(
  tracks: readonly BoneTrack[],
  time: number
): ReadonlyMap<string, AnimatedPose> {
  const poses = new Map<string, Map<string, BonePose>>();
  for (const track of tracks) {
    const position = valuesAt(track.positions, time);
    const rotation = valuesAt(track.rotations, time);
    const scale = valuesAt(track.scales, time);
    if (!position && !rotation && !scale) continue;
    const bones = poses.get(track.skeletonPath) ?? new Map<string, BonePose>();
    bones.set(track.bone, { position, rotation, scale });
    poses.set(track.skeletonPath, bones);
  }
  return poses;
}

/** The value of each sampler that gives one at `time`, or undefined where none does. */
function valuesAt<T>(samplers: readonly Sampler<T>[], time: number): T[] | undefined {
  const values: T[] = [];
  for (const sample of samplers) {
    const value = sample(time);
    if (value !== null) values.push(value);
  }
  return values.length === 0 ? undefined : values;
}
