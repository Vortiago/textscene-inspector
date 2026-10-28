/**
 * Sorts the tracks of a clip by what plays them, once. THREE's mixer plays the transforms of nodes,
 * the Skeleton3D pass plays the bone poses (ADR-0011), and the value registry plays the properties
 * that no THREE object holds (ADR-0016, ADR-0017). A track that finds no scene path stays with the
 * mixer's clip builder, which warns and drops it.
 */

import { sampleTupleTrack } from '../../../godot/scene/animationTrackSampler.js';
import type { GodotAnimation } from './animationResolver';
import type { PushedClip } from '../../../r3f/animation/usePushedWrites';
import { animatedValueKey } from '../../../r3f/contexts/AnimatedValueContext';
import type { AnimatedPose } from '../../3d/skeleton3d/skeletonPose';
import { boneTracksOf, sampleBonePoses, type BoneTrack, type BoneTrackSource } from './boneTracks';
import type { GodotTrack } from './trackParser';
import { componentsOf, sampleSetupOf, trackKeyOf } from './trackSampling';

/**
 * The non-transform properties the AnimationPlayer pushes through the AnimatedValue registry
 * (ADR-0016, ADR-0017), mapped to whether they interpolate: `frame` and `visible` are stepped (a
 * flipbook, a bool), `modulate` and `size` follow the `interp` of the track.
 */
const VALUE_PUSH_PROPERTIES: Record<string, boolean> = {
  frame: false,
  visible: false,
  modulate: true,
  size: true,
};

/** A property of a node that a clip pushes through the AnimatedValue registry. */
export interface ValueTarget {
  path: string;
  property: string;
  /** Where the value is pushed: the key of the property of the node. */
  key: string;
  /** The components of the value at `time`, or null where the track has none. */
  sample: (time: number) => readonly number[] | null;
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
  const keys = track.keys.map((key) => trackKeyOf(key, componentsOf));
  // `frame` and `visible` hold a key until the next one, whatever `interp` says.
  const setup = sampleSetupOf(track, animation);
  if (!VALUE_PUSH_PROPERTIES[property]) setup.interp = 0;
  return {
    path,
    property,
    key: animatedValueKey(path, property),
    sample: (time) => sampleTupleTrack(keys, time, setup),
  };
}

/**
 * The value tracks of `clip` as a clip for the value registry. A track with no value at `time`
 * writes nothing, so the registry releases its key and the authored value shows: a reader would
 * decode an empty tuple as a value (`visible` as true).
 */
export function valuesPushedBy(clip: DrivenClip): PushedClip<readonly number[]> {
  return {
    name: clip.name,
    sample: (time, out) => {
      for (const { key, sample } of clip.values) {
        const value = sample(time);
        if (value !== null) out.set(key, value);
      }
    },
  };
}

/** The bone tracks of `clip` as a clip for the bone pose registry. */
export function bonesPushedBy(clip: DrivenClip): PushedClip<AnimatedPose> {
  return {
    name: clip.name,
    sample: (time, out) => sampleBonePoses(clip.bones, time, out),
  };
}
