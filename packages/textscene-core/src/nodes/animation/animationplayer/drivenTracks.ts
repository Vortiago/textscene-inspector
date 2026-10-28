/**
 * Sorts the tracks of a clip by what plays them, once. THREE's mixer plays the transforms of nodes,
 * the Skeleton3D pass plays the bone poses (ADR-0011), and the value registry plays the properties
 * that no THREE object holds (ADR-0016, ADR-0017). A track that finds no scene path stays with the
 * mixer's clip builder, which warns and drops it.
 */

import { storedReal } from '../../../godot/math/real.js';
import {
  sampleTupleTrack,
  type SampleSetup,
  type TrackKey,
} from '../../../godot/scene/animationTrackSampler.js';
import type { GodotAnimation } from './animationResolver';
import type { PushedClip } from '../../../r3f/animation/usePushedWrites';
import { animatedValueKey } from '../../../r3f/contexts/AnimatedValueContext';
import type { AnimatedPose } from '../../3d/skeleton3d/skeletonPose';
import { boneTracksOf, sampleBonePoses, type BoneTrack, type BoneTrackSource } from './boneTracks';
import type { GodotTrack } from './trackParser';
import { VALUE_PUSH_PROPERTIES, sampleSteppedValue } from './valueTracks';

/** A property of a node that a clip pushes through the AnimatedValue registry. */
export interface ValueTarget {
  path: string;
  property: string;
  /** The components of the value at `time`; empty where the track has none. */
  sample: (time: number) => readonly number[];
}

export interface DrivenClip {
  name: string;
  /** The tracks THREE's mixer plays, as a clip for `buildClip`. */
  mixer: GodotAnimation;
  bones: BoneTrack[];
  values: ValueTarget[];
}

/** What a scene path names, for the binder to decide what a track path means (`animation_mixer.cpp:795`). */
export interface TrackScene {
  scenePathOf: (targetPath: string) => string | null;
  /** Whether the node at the scene path is a Skeleton3D. */
  isSkeleton: (scenePath: string) => boolean;
}

export function splitTracks(animation: GodotAnimation, scene: TrackScene): DrivenClip {
  const mixer: GodotTrack[] = [];
  const boneSources: BoneTrackSource[] = [];
  const values: ValueTarget[] = [];
  for (const track of animation.tracks) {
    const scenePath = scene.scenePathOf(track.targetPath);
    if (scenePath === null) mixer.push(track);
    else if (isBoneTrack(track, scenePath, scene)) boneSources.push({ track, skeletonPath: scenePath });
    else if (track.type === 'value' && Object.hasOwn(VALUE_PUSH_PROPERTIES, track.property)) {
      values.push(valueTargetOf(track, scenePath, animation));
    } else mixer.push(track);
  }
  return {
    name: animation.name,
    mixer: { ...animation, tracks: mixer },
    bones: boneTracksOf(boneSources, animation),
    values,
  };
}

/** Whether the track has the shape of a bone track: a transform track with one subname. */
function namesOneSubname(track: GodotTrack): boolean {
  return track.type !== 'value' && track.subnames.length === 1;
}

/** One subname on a Skeleton3D names a bone. Any other transform track moves the node. */
function isBoneTrack(track: GodotTrack, scenePath: string, scene: TrackScene): boolean {
  return namesOneSubname(track) && scene.isSkeleton(scenePath);
}

/**
 * The scene paths that `isSkeleton` decides for these animations: the targets of a track with one
 * subname. The caller keys the split on the answer, so a scene that changes elsewhere does not split
 * the tracks again.
 */
export function boneCandidatePaths(
  animations: readonly GodotAnimation[],
  scenePathOf: TrackScene['scenePathOf']
): string[] {
  const paths = new Set<string>();
  for (const { tracks } of animations) {
    for (const track of tracks) {
      const scenePath = namesOneSubname(track) ? scenePathOf(track.targetPath) : null;
      if (scenePath !== null) paths.add(scenePath);
    }
  }
  return [...paths];
}

function valueTargetOf(track: GodotTrack, path: string, animation: GodotAnimation): ValueTarget {
  const { property } = track;
  if (!VALUE_PUSH_PROPERTIES[property]) {
    return { path, property, sample: (time) => [sampleSteppedValue(track.keys, time)] };
  }
  const keys: TrackKey<readonly number[]>[] = track.keys.map((key) => ({
    time: storedReal(key.time),
    transition: storedReal(key.transition),
    value: (Array.isArray(key.value) ? (key.value as unknown[]) : [key.value]).map((component) =>
      storedReal(typeof component === 'number' ? component : 0)
    ),
  }));
  // A DISCRETE update mode holds the key whatever `interp` says (`animation.cpp`).
  const setup: SampleSetup = {
    interp: track.updateMode === 1 ? 0 : track.interp,
    loopWrap: track.loopWrap,
    length: storedReal(animation.length),
    loopMode: animation.loopMode,
  };
  return { path, property, sample: (time) => sampleTupleTrack(keys, time, setup) ?? [] };
}

/** The value tracks of `clip` as a clip for the value registry. */
export function valuesPushedBy(clip: DrivenClip): PushedClip<readonly number[]> {
  return {
    name: clip.name,
    sample: (time, out) => {
      for (const { path, property, sample } of clip.values)
        out.set(animatedValueKey(path, property), sample(time));
    },
  };
}

/** The bone tracks of `clip` as a clip for the bone pose registry. */
export function bonesPushedBy(clip: DrivenClip): PushedClip<AnimatedPose> {
  return {
    name: clip.name,
    sample: (time, out) => sampleBonePoses(clip.bones, time).forEach((pose, path) => out.set(path, pose)),
  };
}
