/**
 * useSpriteFrames resolves an AnimatedSprite2D's `sprite_frames` reference into
 * its animations map and the resource pools its frame textures resolve against.
 * Both homes hand the same property bag to `decodeSpriteFrames`, so the decode
 * never learns which one it came from.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import {
  findSubResource,
  parseResourceReference,
  resolveExtResourcePath,
} from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { decodeSpriteFrames } from '../../../resources/textures/spriteframes/decode';
import type { SpriteFramesAnimation } from '../../../resources/textures/spriteframes/types';

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

export function useSpriteFrames(spriteFramesRef: string | undefined): SpriteFramesResult {
  const { internalResources, externalResources } = useSceneResources();

  const ref = spriteFramesRef ? parseResourceReference(spriteFramesRef) : null;
  const isExternal =
    !!spriteFramesRef && (ref?.type === 'ExtResource' || spriteFramesRef.startsWith('res://'));
  const resolvedPath = isExternal ? resolveExtResourcePath(spriteFramesRef, externalResources) : null;
  // Only a text resource parses. No processor handles a binary `.res`, so its
  // load would stay in flight forever.
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  // `''` is the no-request idiom: the hook-call count stays constant on the
  // synchronous branch, as in useTileSetModel.
  const tresResult = useResource<ParsedResource>(tresPath ?? '', 'resource');

  return useMemo((): SpriteFramesResult => {
    if (!spriteFramesRef) return EMPTY;

    // An in-scene SubResource resolves synchronously against the scene's pools, so
    // it is never `pending`.
    if (ref?.type === 'SubResource') {
      const sub = findSubResource(internalResources, ref.id);
      const decoded = sub ? decodeSpriteFrames(sub.data) : null;
      return decoded
        ? {
            spriteFrames: {
              animations: decoded.animations,
              subResources: internalResources,
              externalResources,
            },
            status: 'loaded',
          }
        : EMPTY;
    }

    // An external `.tres` loads through useResource, which also supplies the
    // missing-file rows and the late-upload recovery. Its frames resolve against
    // the file's own sections, since its frame ids are scoped to the .tres. A
    // binary `.res` leaves tresPath null, so it is unresolvable.
    if (!tresPath) return EMPTY;
    if (tresResult.status === 'pending') return { spriteFrames: null, status: 'pending' };
    if (tresResult.status === 'unavailable' || !tresResult.value) return EMPTY;

    const file = tresResult.value;
    const decoded = decodeSpriteFrames(file.properties);
    return decoded
      ? {
          spriteFrames: {
            animations: decoded.animations,
            subResources: file.subResources,
            externalResources: file.extResources,
          },
          status: 'loaded',
        }
      : EMPTY;
  }, [spriteFramesRef, ref?.type, ref?.id, internalResources, externalResources, tresPath, tresResult.status, tresResult.value]);
}
