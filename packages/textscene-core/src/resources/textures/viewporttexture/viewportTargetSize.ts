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
import { textureSize } from '../textureSize';

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
    const size = textureSize(key === null ? null : targets.get(key)?.plain.texture);
    return size ? { x: size.width, y: size.height } : null;
  };
}
