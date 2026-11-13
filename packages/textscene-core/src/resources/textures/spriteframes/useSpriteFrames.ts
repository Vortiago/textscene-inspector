/**
 * useSpriteFrames resolves an AnimatedSprite2D's or AnimatedSprite3D's `sprite_frames` reference into
 * its animations map and the resource pools its frame textures resolve against.
 * Both homes hand the same property bag to `decodeSpriteFrames`, so the decode
 * never learns which one it came from.
 */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../../../parser/types';
import { useSceneResources, type SceneResources } from '../../../r3f/SceneResourcesContext';
import { referenceHeldBy, type ScopedReference } from '../../reading';
import { useResourceResolution } from '../../useSubOrExtResource';
import { decodeSpriteFrames } from './decode';
import type { SpriteFramesAnimation } from './types';
import { isLocalToScene } from '../viewporttexture/localToScene';

interface ResolvedSpriteFrames {
  /** The SpriteFrames itself, which holds every frame texture. */
  resource: TscnInternalResource;
  /** animation name → its parsed frames + timing. */
  animations: Map<string, SpriteFramesAnimation>;
  /** The tables the frame refs resolve in: the scene's, or the .tres's own. */
  resources: SceneResources;
}

interface SpriteFramesResult {
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
        resource: scoped.resource,
        animations: decoded.animations,
        resources: scoped.resources,
      },
      status: 'loaded',
    };
  }, [scoped, status]);
}

/**
 * The frame texture `ref` names, held by `spriteFrames`. A SpriteFrames that is not local to scene
 * leaves a ViewportTexture frame unset up. Null with no SpriteFrames or no frame.
 */
export function useFrameReference(
  spriteFrames: ResolvedSpriteFrames | null,
  ref: string | null
): ScopedReference | null {
  return useMemo(
    () =>
      spriteFrames && ref !== null
        ? referenceHeldBy(ref, spriteFrames.resources, isLocalToScene(spriteFrames.resource))
        : null,
    [spriteFrames, ref]
  );
}
