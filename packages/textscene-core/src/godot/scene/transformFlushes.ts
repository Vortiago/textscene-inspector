/**
 * Godot's transform flushes: the walks of the SceneTree's transform-change list that send
 * `NOTIFICATION_TRANSFORM_CHANGED`, and how many of them run before the `ref:godot` harness
 * captures a scene. Measured on Godot 4.6.3 with the harness's `--fixed-fps 1000`.
 */

import { physicsTicksThrough, type PhysicsClock } from './physicsTicks.js';

/**
 * The process frame the `ref:godot` harness captures a scene at when its transforms never hold
 * still: six convergence frames, then every frame of the render wait. `run.test.mjs` checks it
 * against the harness's own counts.
 *
 * @canonical The process frame the ref:godot harness captures a never-settling scene at
 */
export const HARNESS_FRAME = 923;

/**
 * The transform flushes Godot runs from the moment a scene enters the tree to the end of process
 * frame `frame`: three in each process frame (`scene_tree.cpp:706,712,721`) and two in each
 * physics tick (`:631`, `:652`) that `clock` paces.
 */
export function transformFlushesThrough(frame: number, clock: PhysicsClock): number {
  return 3 * (frame + 1) + 2 * physicsTicksThrough(frame, clock);
}

/** Puts an entry on the transform-change list, unless it is on the list already. */
export type QueueTransformChange<T> = (entry: T) => void;

/**
 * Replays `flushes` walks of the transform-change list and calls `notify` for each entry a walk
 * reaches. `entered` holds the entries in the order they enter the tree. An add puts an entry at
 * the front (`self_list.h:43-58`), so the list starts in reverse order. A walk takes the entries
 * the list held when it began (`scene_tree.cpp:193-204`): one that `notify` queues waits for the
 * next walk, and one still on the list keeps its place. The replay ends early on an empty list.
 */
export function replayTransformFlushes<T>(
  entered: readonly T[],
  flushes: number,
  notify: (entry: T, queue: QueueTransformChange<T>) => void
): void {
  const onList = new Set(entered);
  let list = [...entered].reverse();
  for (let flush = 0; flush < flushes && list.length > 0; flush++) {
    const queuedNewestLast: T[] = [];
    const queue: QueueTransformChange<T> = (entry) => {
      if (onList.has(entry)) return;
      onList.add(entry);
      queuedNewestLast.push(entry);
    };
    for (const entry of list) {
      onList.delete(entry);
      notify(entry, queue);
    }
    list = queuedNewestLast.reverse();
  }
}
