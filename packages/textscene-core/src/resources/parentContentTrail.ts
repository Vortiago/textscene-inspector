/**
 * A host child seated below an instance for a `parent_id_path=` that enters the instance's content
 * (`RawNode.parentContentTrail`). The instance's graft follows the rest of the trail in its scene
 * and places the child where Godot's lookup finds the node (`packed_scene.cpp:161-163`, `:1985-2005`).
 */

import { hostChildOf, type LiveNode } from './liveNode';
import type { InstanceNames } from './instanceNameTable';
import type { FollowTrail } from './sceneTrail';
import { SCENE_ROOT_PATH } from '../utils/nodePath';

/** Where the graft seats a host child once its content trail is followed, or a child that has none. */
export interface FollowedChild {
  /** The child as the graft seats it: with the sub-path the trail found, and without the trail itself. */
  readonly child: LiveNode;
  /**
   * `waiting` where a scene the trail enters is not loaded yet, so the child waits in the instance.
   * `missing` where no heading answers the trail, so the file that wrote the child re-roots it.
   */
  readonly status: 'placed' | 'waiting' | 'missing';
}

/**
 * `hosted` with its content trail followed through `follow`. The copy keeps the host child it stands
 * for, so the file that seats it removes the heading it came from (`hostChildOf`).
 */
export function followedChild(hosted: LiveNode, follow: FollowTrail): FollowedChild {
  if (hosted.parentContentTrail === undefined) return { child: hosted, status: 'placed' };
  const walk = follow(hosted.parentContentTrail);
  if (walk.status === 'pending') return { child: hosted, status: 'waiting' };
  if (walk.status === 'missing') return { child: reanchoredAt(hosted, SCENE_ROOT_PATH), status: 'missing' };
  return { child: reanchoredAt(hosted, walk.path), status: 'placed' };
}

/**
 * `child` re-aimed at the sub-path its `parent_id_path=` finds in the base the root inherits, for a
 * `parent=` walk that found nothing there (packed_scene.cpp:1960-1979). Undefined for a child with
 * no such trail, an instance below the root, or a base that finds nothing. Waiting where a scene
 * the trail enters is not loaded yet.
 */
export function enteredThroughBase(
  child: LiveNode,
  { isInheritedRoot, followTrail }: Pick<InstanceNames, 'isInheritedRoot' | 'followTrail'>
): FollowedChild | undefined {
  const { parentTrailFallback } = child;
  if (!isInheritedRoot || parentTrailFallback?.path !== SCENE_ROOT_PATH) return undefined;
  const walk = parentTrailFallback.contentTrail && followTrail(parentTrailFallback.contentTrail);
  if (walk?.status === 'pending') return { child, status: 'waiting' };
  return walk?.status === 'found' ? { child: reanchoredAt(child, walk.path), status: 'placed' } : undefined;
}

/** `child` seated at `path` below the instance: it keeps its host child, and sheds both trails. */
function reanchoredAt(child: LiveNode, path: string): LiveNode {
  const { parentContentTrail: _followed, parentTrailFallback: _spent, ...rest } = child;
  const reanchored: LiveNode = { ...rest, reanchoredFrom: hostChildOf(child) };
  return path === SCENE_ROOT_PATH ? reanchored : { ...reanchored, instanceSubPath: path };
}
