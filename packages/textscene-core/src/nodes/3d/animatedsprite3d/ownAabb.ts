/**
 * The box an AnimatedSprite3D gives its instance: the quad of the frame it draws, as `_draw` sizes
 * it from the frame texture (`sprite_3d.cpp:1031-1061`). A draw that returns early leaves the quad
 * mesh's `AABB()`.
 */

import { useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import { EMPTY_AABB, type Aabb } from '../../../godot/aabb';
import { frameSizePx, WHOLE_FRAME } from '../../../r3f/spriteFrame';
import { useSpriteFrames } from '../../../resources/textures/spriteframes/useSpriteFrames';
import { useTexture2D } from '../../../resources/useTexture2D';
import { spriteQuadAabb, spriteQuadRect } from '../sprite3d/quad';
import { selectedFrameTexture } from './frameSelection';
import type { AnimatedSprite3DProperties } from './types';

/** Stable empty pools, so the frame texture's memo holds between renders. */
const NO_EXTERNAL_RESOURCES: readonly TscnExternalResource[] = [];
const NO_INTERNAL_RESOURCES: readonly TscnInternalResource[] = [];

/** The box in node space, or null while the SpriteFrames or the frame texture loads. */
export function useAnimatedSprite3DAabb(node: TscnNode): Aabb | null {
  const properties = node.properties as AnimatedSprite3DProperties;
  const { spriteFrames, status } = useSpriteFrames(node.rawProperties['sprite_frames']);
  const frameRef = selectedFrameTexture(node.rawProperties, spriteFrames?.animations ?? null);
  const { texture, missing } = useTexture2D(
    frameRef ?? undefined,
    spriteFrames?.externalResources ?? NO_EXTERNAL_RESOURCES,
    spriteFrames?.subResources ?? NO_INTERNAL_RESOURCES
  );
  const isPending = status === 'pending' || (frameRef !== null && !missing && !texture);

  return useMemo(() => {
    if (isPending) return null;
    if (!texture) return EMPTY_AABB;
    const px = frameSizePx(texture, WHOLE_FRAME);
    if (px.width === 0 || px.height === 0) return EMPTY_AABB;
    const size = { width: px.width * properties.pixel_size, height: px.height * properties.pixel_size };
    return spriteQuadAabb(spriteQuadRect(size, properties), properties.axis, properties.billboard);
  }, [isPending, texture, properties]);
}
