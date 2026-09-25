/**
 * Exact binding for an animation's transform tracks. A clip template names each track by its
 * target's scene path (`Root/Right/Arm.position`), and binding renames it to that object's `uuid`,
 * which `PropertyBinding.findNode` matches anywhere below the mixer root. Two nodes that share a
 * name never collide, and a path through a missing node binds nothing, as Godot's `get_node` does.
 */

import type { AnimationClip, KeyframeTrack, Object3D } from 'three';
import { warn } from '../../logger';

/** A node name never holds a `.` (`godot/nodeName.ts`), so the first one ends the path. */
function splitTrackName(name: string): { path: string; property: string } {
  const dot = name.indexOf('.');
  return { path: name.slice(0, dot), property: name.slice(dot) };
}

/**
 * The mixer root for a driver mounted at `object`: the scene it hangs in, the one ancestor of every
 * node a path can name, whether it nests or escaped its parent (`parentSpaceScope.tsx`).
 */
export function mixerRootOf(object: Object3D): Object3D {
  let root = object;
  while (root.parent) root = root.parent;
  return root;
}

/** Every scene path the clips' tracks name, once each, in first-seen order. */
export function trackTargetPaths(clips: readonly AnimationClip[]): string[] {
  const paths = new Set<string>();
  for (const clip of clips) for (const track of clip.tracks) paths.add(splitTrackName(track.name).path);
  return [...paths];
}

/**
 * The nearest object named `name` below `object`, breadth first. It never enters a registered
 * wrapper: that is another node, which answers to its own path.
 */
function namedBelow(object: Object3D, name: string, wrappers: ReadonlySet<Object3D>): Object3D | null {
  const queue = [...object.children];
  for (let next = queue.shift(); next; next = queue.shift()) {
    if (wrappers.has(next)) continue;
    if (next.name === name) return next;
    queue.push(...next.children);
  }
  return null;
}

/**
 * The object a transform track at scene `path` drives: the named group inside the wrapper the
 * dispatcher registered for that path. Content no path registers, such as a glTF scene, is reached
 * from the longest registered prefix by one name per remaining segment. `null` when nothing matches.
 */
export function findTrackTarget(path: string, nodeObjects: ReadonlyMap<string, Object3D>): Object3D | null {
  const wrappers = new Set(nodeObjects.values());
  const segments = path.split('/');
  for (let depth = segments.length; depth > 0; depth--) {
    const wrapper = nodeObjects.get(segments.slice(0, depth).join('/'));
    if (!wrapper) continue;
    let target = namedBelow(wrapper, segments[depth - 1]!, wrappers);
    for (const segment of segments.slice(depth)) {
      if (!target) return null;
      target = namedBelow(target, segment, wrappers);
    }
    return target;
  }
  return null;
}

/**
 * The clip with each track renamed to its target's uuid. A track whose path has no target is
 * dropped with a warning, so the rest of the clip still plays.
 */
export function bindClip(clip: AnimationClip, targets: ReadonlyMap<string, Object3D>): AnimationClip {
  const bound = clip.clone();
  bound.tracks = clip.tracks.flatMap((track): KeyframeTrack[] => {
    const { path, property } = splitTrackName(track.name);
    const target = targets.get(path);
    if (!target) {
      warn(`[AnimationPlayer] "${clip.name}": no node at "${path}", so its ${property} track binds nothing`);
      return [];
    }
    const renamed = track.clone();
    renamed.name = `${target.uuid}${property}`;
    return [renamed];
  });
  return bound;
}
