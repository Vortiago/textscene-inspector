/**
 * The buffer every clipping group of one canvas fills. The pass fills a group's buffer and draws its
 * owner before it fills the next group's, so the groups take turns and one frame-sized target
 * serves all of them. A target for each group would cost 500 frames of memory for 500 owners.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { CanvasColorSpace } from '../canvasColorSpace';
import { createCanvasFrame } from '../components/Canvas2DStage/canvasFrame';
import { perObject } from '../../utils/perObject';

type CanvasFrame = ReturnType<typeof createCanvasFrame>;

/** Written only by `sharedClipBuffer`. Collected with its canvas's scene. */
const buffersOf = perObject((_scene: THREE.Object3D) => new Map<CanvasColorSpace, CanvasFrame>());

/** The clip buffer of the canvas `scene` draws, in the colour space of its frame. */
export function sharedClipBuffer(scene: THREE.Object3D, space: CanvasColorSpace): CanvasFrame {
  const buffers = buffersOf(scene);
  let buffer = buffers.get(space);
  if (!buffer) {
    buffer = createCanvasFrame(space);
    buffers.set(space, buffer);
  }
  return buffer;
}

/** The mounted groups using each buffer. Written only by `useSharedClipBuffer`. */
const usersOf = perObject((_buffer: CanvasFrame) => ({ count: 0 }));

/**
 * `sharedClipBuffer` for a mounted group. The last group to unmount frees the target, which three
 * allocates again if a group mounts later.
 */
export function useSharedClipBuffer(scene: THREE.Object3D, space: CanvasColorSpace): CanvasFrame {
  const buffer = useMemo(() => sharedClipBuffer(scene, space), [scene, space]);
  useEffect(() => {
    const users = usersOf(buffer);
    users.count += 1;
    return () => {
      users.count -= 1;
      if (users.count === 0) buffer.dispose();
    };
  }, [buffer]);
  return buffer;
}
