/**
 * The bone tracks of a clip, `position_3d`, `rotation_3d` and `scale_3d` on `Skeleton3D:<bone>`, and
 * the poses they write to the skeletons at a time. `AnimationMixer` writes each sampled part to the
 * bone pose (`animation_mixer.cpp:1878-1891`), and the Skeleton3D pass skins the result.
 */

import type { Quaternion } from '../../../godot/math/quaternion.js';
import { storedReal } from '../../../godot/math/real.js';
import type { Vector3 } from '../../../godot/math/vector.js';
import { sampleQuaternionTrack, sampleVector3Track } from '../../../godot/scene/animationTrackSampler.js';
import type { AnimatedPose, BonePose } from '../../3d/skeleton3d/skeletonPose';
import type { GodotAnimation } from './animationResolver';
import type { GodotTrack } from './trackParser';
import { componentsOf, sampleSetupOf, trackKeyOf } from './trackSampling';

type Sampler<T> = (time: number) => T | null;

/** A {@link BonePose} that the sampler writes in place. */
interface ScratchPose {
  position: Vector3[] | undefined;
  rotation: Quaternion[] | undefined;
  scale: Vector3[] | undefined;
}

/** The tracks of a clip that write the bone `bone` of the Skeleton3D at `skeletonPath`, in track order. */
export interface BoneTrack {
  skeletonPath: string;
  bone: string;
  positions: Sampler<Vector3>[];
  rotations: Sampler<Quaternion>[];
  scales: Sampler<Vector3>[];
  /** Written only by `sampleBonePoses`: the pose of the last sample, whose arrays every frame reuses. */
  scratch: ScratchPose;
  /** Written only by `sampleBonePoses`: where the values of each part gather. */
  gathered: { position: Vector3[]; rotation: Quaternion[]; scale: Vector3[] };
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
      group = {
        skeletonPath,
        bone,
        positions: [],
        rotations: [],
        scales: [],
        scratch: { position: undefined, rotation: undefined, scale: undefined },
        gathered: { position: [], rotation: [], scale: [] },
      };
      grouped.set(key, group);
    }
    const setup = sampleSetupOf(track, animation);
    if (track.property === 'quaternion') {
      const keys = track.keys.map((key) => trackKeyOf(key, quaternionOf));
      group.rotations.push((time) => sampleQuaternionTrack(keys, time, setup));
    } else {
      const keys = track.keys.map((key) => trackKeyOf(key, vector3Of));
      const samplers = track.property === 'scale' ? group.scales : group.positions;
      samplers.push((time) => sampleVector3Track(keys, time, setup));
    }
  }
  return [...grouped.values()];
}

function vector3Of(value: unknown): Vector3 {
  const [x = 0, y = 0, z = 0] = componentsOf(value);
  return { x: storedReal(x), y: storedReal(y), z: storedReal(z) };
}

function quaternionOf(value: unknown): Quaternion {
  const [x = 0, y = 0, z = 0, w = 1] = componentsOf(value);
  return { x: storedReal(x), y: storedReal(y), z: storedReal(z), w: storedReal(w) };
}

/**
 * Puts the poses `tracks` write at `time` into `out`, by skeleton. Each skeleton gets a new map,
 * which tells a consumer the pose is new; the poses in it are the ones of the last call, reused. A
 * track with no sample at that time, as one with every key past the clip, writes nothing, so the
 * bone keeps the pose of the file for that part.
 */
export function sampleBonePoses(
  tracks: readonly BoneTrack[],
  time: number,
  out: Map<string, AnimatedPose>
): void {
  for (const track of tracks) {
    const { scratch, gathered } = track;
    scratch.position = gatherAt(track.positions, time, gathered.position);
    scratch.rotation = gatherAt(track.rotations, time, gathered.rotation);
    scratch.scale = gatherAt(track.scales, time, gathered.scale);
    if (!scratch.position && !scratch.rotation && !scratch.scale) continue;
    let bones = out.get(track.skeletonPath) as Map<string, BonePose> | undefined;
    if (!bones) {
      bones = new Map<string, BonePose>();
      out.set(track.skeletonPath, bones);
    }
    bones.set(track.bone, scratch);
  }
}

/** The value of each sampler that gives one at `time`, gathered in `into`, or undefined where none does. */
function gatherAt<T>(samplers: readonly Sampler<T>[], time: number, into: T[]): T[] | undefined {
  into.length = 0;
  for (const sample of samplers) {
    const value = sample(time);
    if (value !== null) into.push(value);
  }
  return into.length === 0 ? undefined : into;
}
