/**
 * Resolves an AnimationPlayer's libraries into typed GodotAnimations, THREE-free and React-free, so a
 * linter rule can use it too. The tracks of each Animation are read by `trackParser.ts`.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { EXT_RESOURCE_CALL_ANYWHERE_RE, dictSubResourceEntries } from '../../../godot/variant/resourceRef.js';
import { literalText } from '../../../godot/string/string.js';
import { findSubResource } from '../../../resources/SubResourceResolver.js';
import { AnimationLoopMode } from '../../../godot/scene/animation.js';
import type { AnimationLibraryRef } from './types';
import { extractNodePathInner, numberOr, parseTracks, trackEnabled, type GodotTrack } from './trackParser';

export interface GodotAnimation {
  name: string;
  length: number;
  loopMode: number;
  step: number;
  tracks: GodotTrack[];
}

export function resolveAnimations(
  libraries: readonly AnimationLibraryRef[],
  internalResources: readonly TscnInternalResource[]
): GodotAnimation[] {
  const animations: GodotAnimation[] = [];
  for (const lib of libraries) {
    const libResource = findSubResource(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') continue;

    const dataStr = libResource.data['_data'];
    if (!dataStr) continue;

    for (const [name, animId] of parseLibraryData(dataStr)) {
      const animResource = findSubResource(internalResources, animId);
      if (!animResource || animResource.type !== 'Animation') continue;
      animations.push(parseAnimation(name, animResource));
    }
  }
  return animations;
}

/**
 * Raw relative NodePath strings on every 'audio' track, for the AudioStreamPlayer linters:
 * `AnimationMixer` plays an audio track through its own playback and never reads the target's
 * `stream` (animation_mixer.cpp:891-898). Separate from `resolveAnimations`, which drops 'audio'
 * tracks, so this never touches the render path.
 */
export function resolveAudioTrackPaths(
  libraries: readonly AnimationLibraryRef[],
  internalResources: readonly TscnInternalResource[]
): string[] {
  const paths: string[] = [];
  for (const lib of libraries) {
    const libResource = findSubResource(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') continue;

    const dataStr = libResource.data['_data'];
    if (!dataStr) continue;

    for (const [, animId] of parseLibraryData(dataStr)) {
      const animResource = findSubResource(internalResources, animId);
      if (!animResource || animResource.type !== 'Animation') continue;
      paths.push(...audioTrackPaths(animResource.data));
    }
  }
  return paths;
}

/** Every enabled audio track's raw NodePath inner string within one Animation resource's data. */
function audioTrackPaths(data: Readonly<Record<string, string>>): string[] {
  const paths: string[] = [];
  for (let i = 0; data[`tracks/${i}/type`] !== undefined; i++) {
    if (!trackEnabled(data, i)) continue;
    const type = literalText(data[`tracks/${i}/type`] ?? '');
    if (type !== 'audio') continue;
    const inner = extractNodePathInner(data[`tracks/${i}/path`] ?? '');
    if (inner !== null) paths.push(inner);
  }
  return paths;
}

/**
 * Whether any of these libraries holds a clip {@link resolveAnimations} cannot enumerate. A clip in
 * its own `.tres` is an `ExtResource`, which {@link parseLibraryData} does not read, so a caller that
 * treats the resolved set as complete would call a live clip name dangling.
 */
export function hasUnresolvableClips(
  libraries: readonly AnimationLibraryRef[],
  internalResources: readonly TscnInternalResource[]
): boolean {
  return libraries.some((lib) => {
    const libResource = findSubResource(internalResources, lib.subResourceId);
    if (!libResource || libResource.type !== 'AnimationLibrary') return false;
    const dataStr = libResource.data['_data'];
    return dataStr !== undefined && EXT_RESOURCE_CALL_ANYWHERE_RE.test(dataStr);
  });
}

/**
 * `_data`'s `"name": SubResource(…)` clips. An empty name is skipped:
 * `add_animation` refuses it (`animation_library.cpp:35-36,48`,
 * `is_valid_animation_name`: `!(p_name.is_empty() || …)`).
 */
function parseLibraryData(dataStr: string): Array<[string, string]> {
  return dictSubResourceEntries(dataStr)
    .filter(({ key }) => key !== '')
    .map(({ key, id }) => [key, id]);
}

function parseAnimation(name: string, resource: TscnInternalResource): GodotAnimation {
  const data = resource.data;
  return {
    name,
    length: numberOr(data['length'], 1.0),
    loopMode: numberOr(data['loop_mode'], AnimationLoopMode.NONE),
    step: numberOr(data['step'], 0.1),
    tracks: parseTracks(data),
  };
}
