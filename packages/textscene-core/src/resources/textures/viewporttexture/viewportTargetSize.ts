/**
 * The size a set-up ViewportTexture reports, `SubViewport::size` (`viewport.cpp:156-166`), read
 * from the target its SubViewport publishes, for the minimum-size walk, which calls no hooks.
 */

import type { TscnInternalResource } from '../../../parser/types';
import type { Vector2 } from '../../../godot/math/vector';
import type { ViewportTextureEntry } from '../../../r3f/contexts/ViewportTextureContext';
import type { SharedLiveTree } from '../../../r3f/useLiveSceneTree';
import { localSceneAt } from '../../../r3f/useUniqueNames';
import { resolveViewportTexturePath, viewportTextureRegistryKey } from '../../../r3f/viewportTexturePath';

/** The size of the target `viewportTexture` names for the node at `consumerPath`, null until it publishes. */
export type ViewportTargetSize = (
  consumerPath: string,
  viewportTexture: TscnInternalResource
) => Vector2 | null;

/** Keys a `viewport_path` as the slot hook does, from the consumer's local scene. */
export function viewportTargetSizes(
  targets: ReadonlyMap<string, ViewportTextureEntry>,
  live: SharedLiveTree | null
): ViewportTargetSize {
  return (consumerPath, viewportTexture) => {
    const viewportPath = resolveViewportTexturePath(viewportTexture.data.viewport_path);
    if (viewportPath === null) return null;
    const scene = localSceneAt(consumerPath, live);
    const key = viewportTextureRegistryKey(scene.path, viewportPath, scene.uniquePaths);
    return key === null ? null : (targets.get(key)?.size ?? null);
  };
}

/** One size a walk read: the slot that asked, the ViewportTexture it named, and the answer. */
export interface ViewportSizeRead {
  readonly consumerPath: string;
  readonly viewportTexture: TscnInternalResource;
  readonly size: Vector2 | null;
}

/** `lookup`, with each answer it gives pushed onto `reads`. */
export function recordingSizes(lookup: ViewportTargetSize, reads: ViewportSizeRead[]): ViewportTargetSize {
  return (consumerPath, viewportTexture) => {
    const size = lookup(consumerPath, viewportTexture);
    reads.push({ consumerPath, viewportTexture, size });
    return size;
  };
}

/** Whether `lookup` answers every read in `reads` as the walk that made them was answered. */
export function sizesStillAnswered(reads: readonly ViewportSizeRead[], lookup: ViewportTargetSize): boolean {
  return reads.every(({ consumerPath, viewportTexture, size }) => {
    const answer = lookup(consumerPath, viewportTexture);
    return answer === null || size === null ? answer === size : answer.x === size.x && answer.y === size.y;
  });
}
