/**
 * Exact binding for an animation's transform tracks. A clip template names each track by its
 * target's scene path (`Root/Right/Arm.position`). Binding renames it to that object's `uuid`, which
 * `PropertyBinding.findNode` matches anywhere below the mixer root. Two same-named nodes never
 * collide, and a path through a missing node binds nothing, as Godot's `get_node` does.
 */

import { AnimationClip, type KeyframeTrack, type Matrix4, type Object3D } from 'three';
import { warn } from '../../logger';
import {
  godotBoneRest,
  godotNodeName,
  isGlbObject,
  isGodotSceneRoot,
} from '../../resources/formats/glb/godotNodes';
import { composeTracksOntoRestPose } from './restPoseTracks';
import { findGlbObject } from '../internal/glb-scene-root/glbPathLookup';

/** A node name never holds a `.` (`godot/string/nodeName.ts`), so the first one ends the path. */
export function splitTrackName(name: string): { path: string; property: string } {
  const dot = name.indexOf('.');
  return { path: name.slice(0, dot), property: name.slice(dot) };
}

/** Every scene path the clips' tracks name, once each, in first-seen order. */
export function trackTargetPaths(clips: readonly AnimationClip[]): string[] {
  const paths = new Set<string>();
  for (const clip of clips) for (const track of clip.tracks) paths.add(splitTrackName(track.name).path);
  return [...paths];
}

/**
 * The nearest object named `name` below `object`, breadth first. A glTF object answers to the name
 * Godot's importer gives it. It never enters a registered wrapper: that is another node, which
 * answers to its own path.
 */
function namedBelow(object: Object3D, name: string, wrappers: ReadonlySet<Object3D>): Object3D | null {
  // Indexed, not `shift`: shifting re-copies the queue on every visit.
  const queue = [...object.children];
  for (let i = 0; i < queue.length; i++) {
    const next = queue[i]!;
    if (wrappers.has(next)) continue;
    if ((godotNodeName(next) ?? next.name) === name) return next;
    queue.push(...next.children);
  }
  return null;
}

/** The object reached from `object` by the nearest object of each name in turn, or null where one is missing. */
function namedPathBelow(
  object: Object3D,
  names: readonly string[],
  wrappers: ReadonlySet<Object3D>
): Object3D | null {
  let target: Object3D | null = object;
  for (const name of names) {
    target &&= namedBelow(target, name, wrappers);
  }
  return target;
}

/** The loaded glTF that the content of `wrapper` holds, breadth first, never inside another registered wrapper. */
function glbRootBelow(wrapper: Object3D, wrappers: ReadonlySet<Object3D>): Object3D | null {
  const queue = [...wrapper.children];
  for (let i = 0; i < queue.length; i++) {
    const next = queue[i]!;
    if (isGodotSceneRoot(next)) return next;
    if (!wrappers.has(next)) queue.push(...next.children);
  }
  return null;
}

/**
 * Finds the object a transform track at a scene path drives: the named group inside the wrapper
 * registered for that path. A path below the longest registered prefix names a glTF node of the
 * glTF the prefix instances (`godotNodes.ts`), or else content no path registers, one name for each
 * segment. `null` when nothing matches. It reads the registry once, so one finder serves every path.
 */
export function trackTargetFinder(
  nodeObjects: ReadonlyMap<string, Object3D>
): (path: string) => Object3D | null {
  const wrappers = new Set(nodeObjects.values());
  // The registry also holds the glTF's own objects, which are no wrapper.
  const glbRoots = new Map<Object3D, Object3D | null>();
  const glbRootOf = (wrapper: Object3D): Object3D | null => {
    if (!glbRoots.has(wrapper)) glbRoots.set(wrapper, glbRootBelow(wrapper, wrappers));
    return glbRoots.get(wrapper)!;
  };
  return (path) => {
    const segments = path.split('/');
    for (let depth = segments.length; depth > 0; depth--) {
      const wrapper = nodeObjects.get(segments.slice(0, depth).join('/'));
      if (!wrapper || isGlbObject(wrapper)) continue;
      const glb = depth < segments.length ? glbRootOf(wrapper) : null;
      if (glb) return findGlbObject(glb, segments.slice(depth).join('/'));
      return namedPathBelow(wrapper, segments.slice(depth - 1), wrappers);
    }
    return null;
  };
}

/**
 * The clip with each track renamed to its target's uuid. A track whose path has no target is
 * dropped with a warning, so the rest of the clip still plays.
 */
export function bindClip(clip: AnimationClip, targets: ReadonlyMap<string, Object3D>): AnimationClip {
  const restByUuid = new Map<string, Matrix4>();
  const tracks = clip.tracks.flatMap((track): KeyframeTrack[] => {
    const { path, property } = splitTrackName(track.name);
    const target = targets.get(path);
    if (!target) {
      warn(`[AnimationPlayer] "${clip.name}": no node at "${path}", so its ${property} track binds nothing`);
      return [];
    }
    const rest = restByUuid.has(target.uuid) ? undefined : godotBoneRest(target);
    if (rest) restByUuid.set(target.uuid, rest);
    const renamed = track.clone();
    renamed.name = `${target.uuid}${property}`;
    return [renamed];
  });
  const bound = restByUuid.size === 0 ? tracks : composeTracksOntoRestPose(tracks, restByUuid);
  return new AnimationClip(clip.name, clip.duration, bound, clip.blendMode);
}
