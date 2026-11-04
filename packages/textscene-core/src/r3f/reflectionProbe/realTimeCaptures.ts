/**
 * The renders Godot draws in each frame for the ALWAYS probes of a scene, before its views: the six
 * faces of each capture (`renderer_scene_cull.cpp:3755-3762`, `:3700-3716`). Ours captures such a
 * probe again only once its content changes, so a sky's radiance update replays the renders it skips.
 */

import type * as THREE from 'three';

/** The faces of one capture. */
const CAPTURE_FACES = 6;

/**
 * The capture renders of each scene's frame that no view has replayed yet. Written by
 * `noteRealTimeProbes` once a frame, and cleared by the first view that takes them.
 */
// eslint-disable-next-line no-restricted-syntax -- the taking view deletes the scene's entry
const pendingRenders = new WeakMap<THREE.Scene, number>();

/** Notes that `scene` draws `count` probes that update ALWAYS in this frame. */
export function noteRealTimeProbes(scene: THREE.Scene, count: number): void {
  if (count === 0) pendingRenders.delete(scene);
  else pendingRenders.set(scene, count * CAPTURE_FACES);
}

/**
 * The renders of `scene` Godot draws for its ALWAYS probes at the world's exposure in this frame,
 * before its first view. Answers them once a frame, so a second view of the scene replays none.
 *
 * @canonical The renders an ALWAYS reflection probe draws in each frame
 */
export function takeRealTimeCaptureRenders(scene: THREE.Scene): number {
  const renders = pendingRenders.get(scene) ?? 0;
  pendingRenders.delete(scene);
  return renders;
}
