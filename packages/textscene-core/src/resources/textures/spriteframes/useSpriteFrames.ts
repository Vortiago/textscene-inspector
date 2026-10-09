/**
 * useSpriteFrames resolves an AnimatedSprite2D's or AnimatedSprite3D's `sprite_frames` reference into
 * its animations map and the resource pools its frame textures resolve against.
 * Both homes hand the same property bag to `decodeSpriteFrames`, so the decode
 * never learns which one it came from.
 */

import { useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useResourceResolution } from '../../useSubOrExtResource';
import { decodeSpriteFrames } from './decode';
import type { SpriteFramesAnimation } from './types';

export interface ResolvedSpriteFrames {
  /** animation name → its parsed frames + timing. */
  animations: Map<string, SpriteFramesAnimation>;
  /** SubResource pool the frame refs resolve against (scene's, or the .tres's own). */
  subResources: readonly TscnInternalResource[];
  /** ExtResource pool the frame/atlas refs resolve against (scene's, or the .tres's own). */
  externalResources: readonly TscnExternalResource[];
}

export interface SpriteFramesResult {
  spriteFrames: ResolvedSpriteFrames | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

const EMPTY: SpriteFramesResult = { spriteFrames: null, status: 'unavailable' };
const PENDING: SpriteFramesResult = { spriteFrames: null, status: 'pending' };

export function useSpriteFrames(spriteFramesRef: string | undefined): SpriteFramesResult {
  const { scoped, status } = useResourceResolution(spriteFramesRef, useSceneResources());

  return useMemo((): SpriteFramesResult => {
    if (status === 'pending') return PENDING;
    const decoded = scoped ? decodeSpriteFrames(scoped.resource.data) : null;
    if (!scoped || !decoded) return EMPTY;
    return {
      spriteFrames: {
        animations: decoded.animations,
        subResources: scoped.resources.internalResources,
        externalResources: scoped.resources.externalResources,
      },
      status: 'loaded',
    };
  }, [scoped, status]);
}
